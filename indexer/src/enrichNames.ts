import "dotenv/config";

import {
  createPublicClient,
  fallback,
  http,
  toCoinType,
  type Address,
} from "viem";
import { base, mainnet } from "viem/chains";
import { normalize } from "viem/ens";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Resolve Basenames (*.base.eth) and ENS (*.eth) names for classified
 * EOAs, plus the avatar URL when a name resolves. Writes back to
 * zora_csw_owner_class. Each name is a single CCIP-gated ENSIP-19
 * lookup on Ethereum mainnet — Basenames share mainnet ENS
 * infrastructure via a coinType parameter.
 *
 * Priority: seasoned self-custody wallets first (order by mainnet_nonce
 * desc) because the outreach value is highest for those users and a
 * named identity is what makes outreach possible at all.
 */

const TARGET_COUNT = Number(process.env.NAMES_TARGET_COUNT ?? "2000");
const CONCURRENCY = Number(process.env.NAMES_CONCURRENCY ?? "12");
const PERSIST_BATCH_SIZE = Number(process.env.NAMES_PERSIST_BATCH ?? "100");
/** Only resolve for wallets that passed as self-custody by default. */
const MODE = (process.env.NAMES_MODE ?? "extension") as "extension" | "all";
/**
 * CCIP gateway for ENS/Basenames off-chain resolution. ENS's own gateway
 * (ccip.ens.xyz) routes to the authoritative resolver for each name.
 */
const ENS_GATEWAY_URLS = ["https://ccip.ens.xyz"];

function createMainnetClient() {
  const rpcUrl = (process.env.MAINNET_RPC_URL ?? "").trim();
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      (rpcUrl
        ? [rpcUrl]
        : [
            // Fallback to multiple public Ethereum RPCs; ENS reverse
            // resolution hits the gateway regardless so the underlying
            // chain client just needs to be reachable.
            "https://ethereum-rpc.publicnode.com",
            "https://rpc.ankr.com/eth",
            "https://eth.llamarpc.com",
          ]
      ).map((url) => http(url, { retryCount: 2, retryDelay: 300 })),
    ),
  });
}

async function resolveBasename(
  client: ReturnType<typeof createMainnetClient>,
  address: Address,
): Promise<{ name: string | null; avatar: string | null }> {
  try {
    const name = await client.getEnsName({
      address,
      coinType: toCoinType(base.id),
      gatewayUrls: ENS_GATEWAY_URLS,
    });
    if (!name) return { name: null, avatar: null };
    // Guardrail: coinType reverse lookup can occasionally surface a
    // non-.base.eth name via ENS config. Only accept the canonical suffix.
    if (!name.toLowerCase().endsWith(".base.eth")) {
      return { name: null, avatar: null };
    }
    let avatar: string | null = null;
    try {
      avatar = await client.getEnsAvatar({
        name: normalize(name),
        gatewayUrls: ENS_GATEWAY_URLS,
      });
    } catch {
      // Avatar fetch is best-effort; a missing avatar text record or
      // CCIP miss shouldn't fail the whole resolution.
    }
    return { name, avatar };
  } catch {
    return { name: null, avatar: null };
  }
}

async function resolveEns(
  client: ReturnType<typeof createMainnetClient>,
  address: Address,
): Promise<{ name: string | null; avatar: string | null }> {
  try {
    const name = await client.getEnsName({ address });
    if (!name) return { name: null, avatar: null };
    // ENS reverse is already constrained to Ethereum mainnet coinType
    // (60) — no suffix guardrail needed here. But exclude anything that
    // looks like a Basename so we don't duplicate.
    if (name.toLowerCase().endsWith(".base.eth")) {
      return { name: null, avatar: null };
    }
    let avatar: string | null = null;
    try {
      avatar = await client.getEnsAvatar({ name: normalize(name) });
    } catch {
      // Same reasoning as above.
    }
    return { name, avatar };
  } catch {
    return { name: null, avatar: null };
  }
}

type NameRow = { eoa: string; wallet_class: string };

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();
  const client = createMainnetClient();

  console.log(
    `[names] target: ${TARGET_COUNT}, concurrency: ${CONCURRENCY}, mode: ${MODE}`,
  );

  // Pull target EOAs — those without a names_synced_at stamp yet. Order
  // by mainnet_nonce desc so the most-reachable users get named first.
  const rows: NameRow[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (rows.length < TARGET_COUNT) {
    const remaining = TARGET_COUNT - rows.length;
    const pageLimit = Math.min(PAGE, remaining);
    // Include wallet_class in the select because supabase-js upsert
    // sets every not-included column to NULL on both INSERT and
    // UPDATE paths — so we must pass through the class to avoid
    // nulling it on the conflict-resolve UPDATE.
    let q = supabase
      .from("zora_csw_owner_class")
      .select("eoa, wallet_class")
      .is("names_synced_at", null)
      .order("mainnet_nonce", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageLimit - 1);
    if (MODE === "extension") q = q.eq("wallet_class", "likely_extension_eoa");
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as NameRow[];
    if (batch.length === 0) break;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < pageLimit) break;
  }

  if (rows.length === 0) {
    console.log("[names] nothing to do — every target is already synced");
    return;
  }
  console.log(`[names] selected ${rows.length} EOAs`);

  type ResolvedRow = {
    eoa: string;
    wallet_class: string;
    basename: string | null;
    basename_avatar: string | null;
    ens_name: string | null;
    ens_avatar: string | null;
    names_synced_at: string;
  };
  const pending: ResolvedRow[] = [];
  let completed = 0;
  let basenameHits = 0;
  let ensHits = 0;
  let lastLog = Date.now();

  async function flushPending(): Promise<void> {
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    // Upsert only the name/avatar fields by including eoa + relevant
    // columns; because zora_csw_owner_class has additional NOT NULL
    // columns (wallet_class), we fetch a fresh "now" timestamp and
    // only include the columns we're updating plus the PK. Any EOA
    // already exists in the table (that's our target filter), so this
    // is effectively an UPDATE via upsert.
    const { error } = await supabase
      .from("zora_csw_owner_class")
      .upsert(batch, { onConflict: "eoa" });
    if (error) {
      console.warn(`[names] persist batch failed: ${error.message}`);
    }
  }

  const inflight = new Set<Promise<void>>();
  for (const row of rows) {
    const eoa = row.eoa as Address;
    const walletClass = row.wallet_class;
    const task = (async () => {
      const [basename, ens] = await Promise.all([
        resolveBasename(client, eoa),
        resolveEns(client, eoa),
      ]);
      if (basename.name) basenameHits += 1;
      if (ens.name) ensHits += 1;
      pending.push({
        eoa: eoa.toLowerCase(),
        wallet_class: walletClass,
        basename: basename.name,
        basename_avatar: basename.avatar,
        ens_name: ens.name,
        ens_avatar: ens.avatar,
        names_synced_at: new Date().toISOString(),
      });
      if (pending.length >= PERSIST_BATCH_SIZE) await flushPending();
      completed += 1;
      const now = Date.now();
      if (now - lastLog > 5000 || completed === rows.length) {
        const rate = (completed / ((now - startedAt) / 1000)).toFixed(1);
        console.log(
          `[names] ${completed}/${rows.length}  basename=${basenameHits}  ens=${ensHits}  ${rate} rows/s`,
        );
        lastLog = now;
      }
    })();
    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  }
  await Promise.all(inflight);
  await flushPending();

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log("\n[names] done");
  console.log(`  EOAs checked:       ${rows.length}`);
  console.log(`  Basename hits:      ${basenameHits}  (${((basenameHits / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  ENS hits:           ${ensHits}  (${((ensHits / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  elapsed:            ${elapsed.toFixed(1)}s`);

  // Top 10 with a Basename, sorted by mainnet activity.
  const { data: topBases } = await supabase
    .from("zora_csw_owner_class")
    .select("eoa, basename, ens_name, farcaster_username, mainnet_nonce")
    .not("basename", "is", null)
    .eq("wallet_class", "likely_extension_eoa")
    .order("mainnet_nonce", { ascending: false, nullsFirst: false })
    .limit(10);
  if (topBases && topBases.length > 0) {
    console.log("\n=== top 10 extension wallets with a Basename ===");
    for (const row of topBases) {
      console.log(
        `  ${row.eoa}  ${row.basename}  ens=${row.ens_name ?? "—"}  ` +
          `farcaster=@${row.farcaster_username ?? "—"}  mainnet_nonce=${row.mainnet_nonce}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("[names] fatal:", err);
  process.exit(1);
});
