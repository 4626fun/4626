import "dotenv/config";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Resolve Zora profile handle, display name, and creator-coin address
 * for classified EOAs via @zoralabs/coins-sdk. Writes results back to
 * zora_csw_owner_class. One `getProfile` call per EOA.
 *
 * Why this matters for outreach: when a user has a Zora handle, we can
 * address them *as a Zora citizen* — "Hey @koray, saw your creator
 * coin doing well on Zora…" — rather than as an arbitrary wallet. The
 * creator_coin_address is also useful because it tells us whether the
 * user is themselves a creator (their own coin exists) vs only a
 * collector (no coin).
 */

const TARGET_COUNT = Number(process.env.ZORA_PROFILES_TARGET_COUNT ?? "2000");
const CONCURRENCY = Number(process.env.ZORA_PROFILES_CONCURRENCY ?? "6");
const PERSIST_BATCH_SIZE = Number(process.env.ZORA_PROFILES_PERSIST_BATCH ?? "50");
/** "extension" targets self-custody users first (highest outreach value). */
const MODE = (process.env.ZORA_PROFILES_MODE ?? "extension") as "extension" | "all";
/** Optional delay between requests to be nice to Zora's API. */
const REQUEST_INTERVAL_MS = Number(process.env.ZORA_PROFILES_INTERVAL_MS ?? "50");

const ZORA_API_KEY = (process.env.ZORA_SERVER_API_KEY ?? "").trim();
if (!ZORA_API_KEY) {
  console.error("[zora-profiles] ZORA_SERVER_API_KEY is required (see frontend/.env). Aborting.");
  process.exit(1);
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

type ZoraProfile = {
  handle?: string | null;
  displayName?: string | null;
  username?: string | null;
  creatorCoin?: { address?: string | null } | null;
};

async function fetchZoraProfile(
  sdk: any,
  address: string,
): Promise<{
  handle: string | null;
  displayName: string | null;
  creatorCoinAddress: string | null;
} | null> {
  try {
    const response = await sdk.getProfile({ identifier: address });
    const profile: ZoraProfile = response?.data?.profile ?? null;
    if (!profile) return null;
    const rawCoin =
      typeof profile.creatorCoin?.address === "string"
        ? profile.creatorCoin.address.trim()
        : "";
    const creatorCoinAddress = EVM_ADDRESS_RE.test(rawCoin) ? rawCoin.toLowerCase() : null;
    // Zora's SDK response shape has varied over time; we accept either
    // `handle` or `username` as the primary identifier.
    const handle =
      (typeof profile.handle === "string" && profile.handle.trim()) ||
      (typeof profile.username === "string" && profile.username.trim()) ||
      null;
    const displayName =
      typeof profile.displayName === "string" && profile.displayName.trim()
        ? profile.displayName.trim()
        : null;
    return { handle: handle || null, displayName, creatorCoinAddress };
  } catch {
    return null;
  }
}

type TargetRow = { eoa: string; wallet_class: string };

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();

  console.log(
    `[zora-profiles] target: ${TARGET_COUNT}, concurrency: ${CONCURRENCY}, mode: ${MODE}`,
  );

  // Lazy-load the SDK so Node's ESM resolver handles it via CJS/ESM
  // interop the same way the frontend does.
  const sdk: any = await import("@zoralabs/coins-sdk");
  sdk.setApiKey(ZORA_API_KEY);

  // Pull target EOAs — those without a zora_synced_at stamp yet.
  const rows: TargetRow[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (rows.length < TARGET_COUNT) {
    const remaining = TARGET_COUNT - rows.length;
    const pageLimit = Math.min(PAGE, remaining);
    // Include wallet_class because supabase-js upsert nulls missing
    // columns on the conflict-resolve UPDATE path.
    let q = supabase
      .from("zora_csw_owner_class")
      .select("eoa, wallet_class")
      .is("zora_synced_at", null)
      .order("mainnet_nonce", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageLimit - 1);
    if (MODE === "extension") q = q.eq("wallet_class", "likely_extension_eoa");
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as TargetRow[];
    if (batch.length === 0) break;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < pageLimit) break;
  }

  if (rows.length === 0) {
    console.log("[zora-profiles] nothing to do — every target already synced");
    return;
  }
  console.log(`[zora-profiles] selected ${rows.length} EOAs`);

  type ResolvedRow = {
    eoa: string;
    wallet_class: string;
    zora_handle: string | null;
    zora_display_name: string | null;
    zora_creator_coin_address: string | null;
    zora_synced_at: string;
  };
  const pending: ResolvedRow[] = [];
  let completed = 0;
  let matched = 0;
  let creatorsWithCoin = 0;
  let lastLog = Date.now();

  async function flushPending(): Promise<void> {
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    const { error } = await supabase
      .from("zora_csw_owner_class")
      .upsert(batch, { onConflict: "eoa" });
    if (error) {
      console.warn(`[zora-profiles] persist batch failed: ${error.message}`);
    }
  }

  const inflight = new Set<Promise<void>>();
  for (const row of rows) {
    const eoa = row.eoa;
    const walletClass = row.wallet_class;
    const task = (async () => {
      const profile = await fetchZoraProfile(sdk, eoa);
      const resolved: ResolvedRow = {
        eoa: eoa.toLowerCase(),
        wallet_class: walletClass,
        zora_handle: profile?.handle ?? null,
        zora_display_name: profile?.displayName ?? null,
        zora_creator_coin_address: profile?.creatorCoinAddress ?? null,
        zora_synced_at: new Date().toISOString(),
      };
      if (profile?.handle) matched += 1;
      if (profile?.creatorCoinAddress) creatorsWithCoin += 1;
      pending.push(resolved);
      if (pending.length >= PERSIST_BATCH_SIZE) await flushPending();
      completed += 1;
      if (REQUEST_INTERVAL_MS > 0) {
        await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));
      }
      const now = Date.now();
      if (now - lastLog > 5000 || completed === rows.length) {
        const rate = (completed / ((now - startedAt) / 1000)).toFixed(1);
        console.log(
          `[zora-profiles] ${completed}/${rows.length}  matched=${matched}  creators=${creatorsWithCoin}  ${rate} rows/s`,
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
  console.log("\n[zora-profiles] done");
  console.log(`  EOAs checked:            ${rows.length}`);
  console.log(`  Zora profile matched:    ${matched}  (${((matched / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  With creator coin:       ${creatorsWithCoin}  (${((creatorsWithCoin / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  elapsed:                 ${elapsed.toFixed(1)}s`);

  const { data: preview } = await supabase
    .from("zora_csw_owner_class")
    .select("eoa, zora_handle, zora_display_name, farcaster_username, basename, ens_name, mainnet_nonce")
    .not("zora_handle", "is", null)
    .eq("wallet_class", "likely_extension_eoa")
    .order("mainnet_nonce", { ascending: false, nullsFirst: false })
    .limit(10);
  if (preview && preview.length > 0) {
    console.log("\n=== top 10 extension-wallet Zora creators by mainnet activity ===");
    for (const row of preview) {
      console.log(
        `  @${row.zora_handle}  (${row.zora_display_name ?? "—"})  ` +
          `${row.basename ?? row.ens_name ?? "no ens"}  ` +
          `fc=@${row.farcaster_username ?? "—"}  mainnet_nonce=${row.mainnet_nonce}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("[zora-profiles] fatal:", err);
  process.exit(1);
});
