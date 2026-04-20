import "dotenv/config";

import { createPublicClient, http, type Address } from "viem";
import { base, mainnet } from "viem/chains";

import { createBasePublicClient } from "./baseClient.js";
import { createIndexerSupabase } from "./supabase.js";

/**
 * Classifier for Zora CSW owner EOAs.
 *
 * On-chain, a Privy embedded EOA and a MetaMask/Rabby EOA look identical.
 * But they behave very differently:
 *
 *   - Privy embedded EOAs (Zora's signup path) never submit txs directly.
 *     They sign ERC-4337 UserOperations which are executed by a bundler,
 *     so the EOA's own nonce stays 0. Zora is Base-only, so mainnet nonce
 *     is also 0.
 *
 *   - Browser-extension EOAs (MetaMask, Rabby, Coinbase Wallet extension,
 *     Rainbow, etc.) typically submit txs directly on whichever chain the
 *     user picks. Nonce > 0 on at least one chain is the tell.
 *
 * Classification:
 *   - nonce_base == 0 AND nonce_mainnet == 0  →  "likely_privy_embedded"
 *   - nonce_base > 0 OR  nonce_mainnet > 0    →  "likely_extension_eoa"
 *
 * Edge cases:
 *   - A user who ONLY uses their extension wallet on L2s other than Base
 *     (e.g. Optimism-only, Arbitrum-only) would appear as likely_privy.
 *     Acceptable miss rate for a first-pass heuristic.
 *   - A Privy embedded EOA that was ever used on Ethereum would appear as
 *     extension. Rare; most Privy wallets are single-chain.
 */

const CONCURRENCY = Number(process.env.CLASSIFY_CONCURRENCY ?? "20");
/**
 * By default, also classify single-owner CSWs (they're ~98% of the
 * enriched set; skipping them would mean we can't answer "is THIS EOA
 * extension or Privy" for the base_owner). Set to "1" to limit to
 * multi-owner CSWs only (faster, narrower dataset).
 */
const MULTI_OWNER_ONLY =
  process.env.CLASSIFY_MULTI_OWNER_ONLY === "1" ||
  process.env.CLASSIFY_MULTI_OWNER_ONLY === "true";
const PERSIST_BATCH_SIZE = Number(process.env.CLASSIFY_PERSIST_BATCH ?? "500");

type Classification = "likely_privy_embedded" | "likely_extension_eoa";

type OwnerProfile = {
  eoa: string;
  baseNonce: number;
  mainnetNonce: number;
  classification: Classification;
};

// Intentionally loose client typing — viem's PublicClient generic depends
// on the chain, and Base + mainnet have different tx type unions. We only
// call getTransactionCount, which is present on every public client.
type AnyPublicClient = {
  getTransactionCount: (args: { address: Address }) => Promise<number>;
};

async function getNonceBatch(
  client: AnyPublicClient,
  addresses: Address[],
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const chunks: Address[][] = [];
  for (let i = 0; i < addresses.length; i += CONCURRENCY) {
    chunks.push(addresses.slice(i, i + CONCURRENCY));
  }
  for (const chunk of chunks) {
    const counts = await Promise.all(
      chunk.map(async (a) => {
        try {
          const n = await client.getTransactionCount({ address: a });
          return [a, n] as const;
        } catch {
          return [a, 0] as const;
        }
      }),
    );
    for (const [a, n] of counts) results.set(a.toLowerCase(), n);
  }
  return results;
}

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();
  const baseClient = createBasePublicClient();
  const mainnetRpc =
    process.env.MAINNET_RPC_URL?.trim() || "https://ethereum-rpc.publicnode.com";
  const mainnetClient = createPublicClient({
    chain: mainnet,
    transport: http(mainnetRpc, { retryCount: 3, retryDelay: 500 }),
  });

  console.log("[classify] pulling enriched Zora CSWs from Supabase (keyset-paginated)…");
  type Row = { csw_address: string; base_owner: string; current_owners: string[] };
  const PAGE = 1000;
  const enrichedRows: Row[] = [];
  // Keyset pagination instead of offset: OFFSET N with ORDER BY can
  // blow past Supabase's statement timeout once N is large because
  // Postgres still scans all N prior rows. Instead we track the last
  // csw_address seen and filter strictly greater than it — O(1) per
  // page regardless of total size.
  let cursor: string | null = null;
  while (true) {
    let q = supabase
      .from("zora_csw_owners")
      .select("csw_address, base_owner, current_owners")
      .not("last_owner_sync_at", "is", null)
      .order("csw_address", { ascending: true })
      .limit(PAGE);
    if (cursor !== null) q = q.gt("csw_address", cursor);
    const { data, error: pageErr } = await q;
    if (pageErr) throw pageErr;
    const batch = (data ?? []) as Row[];
    if (batch.length === 0) break;
    enrichedRows.push(...batch);
    cursor = batch[batch.length - 1].csw_address;
    if (enrichedRows.length % 20000 === 0 || batch.length < PAGE) {
      console.log(`[classify]   loaded ${enrichedRows.length} rows…`);
    }
    if (batch.length < PAGE) break;
  }
  const multiOwnerRows = enrichedRows.filter(
    (r) => Array.isArray(r.current_owners) && r.current_owners.length >= 2,
  );
  console.log(
    `[classify] ${enrichedRows.length} enriched rows total, ${multiOwnerRows.length} with 2+ owners`,
  );
  console.log(`[classify] mode: ${MULTI_OWNER_ONLY ? "multi-owner only" : "all enriched rows"}`);

  // Collect the unique set of EOAs we need to classify. When
  // MULTI_OWNER_ONLY is false we also include single-owner CSWs so
  // every base_owner gets a classification row (it's the default
  // outreach target for the 98% majority).
  const uniqueOwners = new Set<string>();
  const rowsToScan = MULTI_OWNER_ONLY ? multiOwnerRows : enrichedRows;
  for (const row of rowsToScan) {
    for (const o of row.current_owners) uniqueOwners.add(o.toLowerCase());
  }
  const ownerList = [...uniqueOwners].map((s) => s as Address);
  console.log(`[classify] ${ownerList.length} unique owner EOAs to classify`);

  // Batch-read nonces on both chains.
  console.log("[classify] reading Base nonces…");
  const baseNonces = await getNonceBatch(baseClient, ownerList);
  console.log("[classify] reading Ethereum mainnet nonces…");
  const mainnetNonces = await getNonceBatch(mainnetClient, ownerList);

  // Build per-EOA profile.
  const profiles = new Map<string, OwnerProfile>();
  for (const eoa of ownerList) {
    const k = eoa.toLowerCase();
    const bn = baseNonces.get(k) ?? 0;
    const mn = mainnetNonces.get(k) ?? 0;
    const classification: Classification =
      bn === 0 && mn === 0 ? "likely_privy_embedded" : "likely_extension_eoa";
    profiles.set(k, { eoa, baseNonce: bn, mainnetNonce: mn, classification });
  }

  // Persist to zora_csw_owner_class in batches. Upsert on primary key
  // so re-running the classifier refreshes stale rows rather than
  // erroring on conflicts.
  console.log(`[classify] persisting ${profiles.size} classifications to Supabase…`);
  const profileArray = [...profiles.values()];
  const now = new Date().toISOString();
  let persisted = 0;
  for (let i = 0; i < profileArray.length; i += PERSIST_BATCH_SIZE) {
    const batch = profileArray.slice(i, i + PERSIST_BATCH_SIZE).map((p) => ({
      eoa: p.eoa.toLowerCase(),
      wallet_class: p.classification,
      base_nonce: p.baseNonce,
      mainnet_nonce: p.mainnetNonce,
      last_updated_at: now,
    }));
    const { error: upsertErr } = await supabase
      .from("zora_csw_owner_class")
      .upsert(batch, { onConflict: "eoa" });
    if (upsertErr) {
      console.warn(
        `[classify] persist batch ${i}..${i + batch.length} failed: ${upsertErr.message}`,
      );
      continue;
    }
    persisted += batch.length;
  }
  console.log(`[classify] persisted: ${persisted} / ${profiles.size}`);

  // Aggregate per CSW.
  let bothPrivy = 0;
  let bothExtension = 0;
  let privyPlusExtension = 0;
  const privyPlusExtensionExamples: Row[] = [];

  for (const row of multiOwnerRows) {
    const classes = row.current_owners.map(
      (o) => profiles.get(o.toLowerCase())?.classification ?? "likely_privy_embedded",
    );
    const privyCount = classes.filter((c) => c === "likely_privy_embedded").length;
    const extCount = classes.filter((c) => c === "likely_extension_eoa").length;
    if (privyCount === classes.length) bothPrivy += 1;
    else if (extCount === classes.length) bothExtension += 1;
    else {
      privyPlusExtension += 1;
      if (privyPlusExtensionExamples.length < 5) privyPlusExtensionExamples.push(row);
    }
  }

  const elapsed = (Date.now() - startedAt) / 1000;

  console.log("\n=== wallet-type breakdown for multi-owner Zora CSWs ===");
  console.log(`multi-owner CSWs total:                       ${multiOwnerRows.length}`);
  console.log(`  all owners are Privy-embedded:              ${bothPrivy}`);
  console.log(`  all owners are extension/self-custody:      ${bothExtension}`);
  console.log(`  mixed (Privy + extension):                  ${privyPlusExtension}`);
  console.log(`\nunique owner EOAs classified:                 ${ownerList.length}`);
  const privyEOAs = [...profiles.values()].filter(
    (p) => p.classification === "likely_privy_embedded",
  ).length;
  const extEOAs = [...profiles.values()].filter(
    (p) => p.classification === "likely_extension_eoa",
  ).length;
  console.log(`  likely Privy embedded:                      ${privyEOAs}`);
  console.log(`  likely extension/self-custody:              ${extEOAs}`);
  console.log(`elapsed: ${elapsed.toFixed(1)}s`);

  if (privyPlusExtensionExamples.length > 0) {
    console.log("\n=== sample mixed CSWs (Privy + extension owners) ===");
    for (const ex of privyPlusExtensionExamples) {
      console.log(`  CSW: ${ex.csw_address}`);
      for (const o of ex.current_owners) {
        const p = profiles.get(o.toLowerCase())!;
        console.log(
          `    ${o}  nonce(base=${p.baseNonce}, mainnet=${p.mainnetNonce})  →  ${p.classification}`,
        );
      }
    }
  }

  // Also show top extension EOAs by mainnet nonce — these are the most
  // "established" self-custody users in the cohort.
  const topExtensionByMainnet = [...profiles.values()]
    .filter((p) => p.classification === "likely_extension_eoa")
    .sort((a, b) => b.mainnetNonce - a.mainnetNonce)
    .slice(0, 10);
  if (topExtensionByMainnet.length > 0) {
    console.log("\n=== top 10 extension-wallet owners by Ethereum mainnet activity ===");
    for (const p of topExtensionByMainnet) {
      console.log(
        `  ${p.eoa}  mainnet_nonce=${p.mainnetNonce}  base_nonce=${p.baseNonce}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("[classify] fatal:", err);
  process.exit(1);
});
