import "dotenv/config";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Cross-reference Zora CSW extension-wallet owners with Farcaster
 * verifications via Neynar. Populates farcaster_fid / farcaster_username
 * / farcaster_display_name on zora_csw_owner_class for any EOA that has
 * a verified address on Farcaster.
 *
 * Target: the highest-signal extension-wallet owners (prioritised by
 * Ethereum mainnet nonce — a proxy for "how seasoned is this user").
 * Default scope is the top 1000 extension EOAs by mainnet_nonce; set
 * FARCASTER_TARGET_COUNT to scale. Change FARCASTER_MODE to "all" to
 * include Privy embedded EOAs too (most won't match, but the
 * completeness can matter).
 */

const NEYNAR_API_KEY = (process.env.NEYNAR_API_KEY ?? "").trim();
const TARGET_COUNT = Number(process.env.FARCASTER_TARGET_COUNT ?? "1000");
const MODE = (process.env.FARCASTER_MODE ?? "extension") as "extension" | "all";
const BATCH_SIZE = Number(process.env.FARCASTER_BATCH_SIZE ?? "100");
const NEYNAR_BASE_URL = "https://api.neynar.com/v2/farcaster";
/**
 * Inter-batch delay in ms. Neynar's free tier caps at 6 requests/min for
 * the bulk-by-address endpoint, so the safe per-call interval is 10s
 * (60s / 6 = 10s). Override via env if you have a paid plan.
 */
const REQUEST_INTERVAL_MS = Number(process.env.FARCASTER_INTERVAL_MS ?? "10500");
/** Cap on how long we wait for a single 429-retry before bailing the batch. */
const MAX_RETRY_BACKOFF_MS = 90_000;
/** When we want to skip already-resolved EOAs from a prior run. */
const SKIP_ALREADY_CHECKED =
  process.env.FARCASTER_SKIP_ALREADY_CHECKED !== "0" &&
  process.env.FARCASTER_SKIP_ALREADY_CHECKED !== "false";

if (!NEYNAR_API_KEY) {
  console.error(
    "[farcaster] NEYNAR_API_KEY is required. Get one at https://neynar.com. Aborting.",
  );
  process.exit(1);
}

type NeynarBulkByAddressResponse = Record<
  string,
  Array<{
    fid: number;
    username?: string;
    display_name?: string;
    custody_address?: string;
    verified_addresses?: { eth_addresses?: string[] };
  }>
>;

async function fetchFarcasterBatchOnce(
  addresses: string[],
): Promise<{ ok: true; data: NeynarBulkByAddressResponse } | { ok: false; status: number; body: string; retryAfterMs: number | null }> {
  const url = new URL(`${NEYNAR_BASE_URL}/user/bulk-by-address`);
  url.searchParams.set("addresses", addresses.join(","));
  // We want verification-based matches, not just custody addresses,
  // because the EOAs on Zora CSWs are almost never someone's Farcaster
  // custody wallet — they're verified secondary addresses.
  url.searchParams.set("address_types", "verified_address");
  const res = await fetch(url, {
    headers: { accept: "application/json", "x-api-key": NEYNAR_API_KEY },
  });
  if (res.ok) {
    const data = (await res.json()) as NeynarBulkByAddressResponse;
    return { ok: true, data };
  }
  const body = await res.text().catch(() => "");
  let retryAfterMs: number | null = null;
  const retryAfterHeader = res.headers.get("retry-after");
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) {
      retryAfterMs = Math.min(seconds * 1000, MAX_RETRY_BACKOFF_MS);
    }
  }
  return { ok: false, status: res.status, body, retryAfterMs };
}

/**
 * Wraps the raw fetch with a single retry on 429 (rate-limit). We
 * respect Retry-After if present, otherwise back off by the safe
 * default interval. Neynar's free tier really does enforce 6 req/min
 * on this endpoint so the inter-batch sleep should keep us legal —
 * this retry is a belt-and-suspenders for clock drift.
 */
async function fetchFarcasterBatch(
  addresses: string[],
): Promise<NeynarBulkByAddressResponse> {
  const first = await fetchFarcasterBatchOnce(addresses);
  if (first.ok) return first.data;
  if (first.status !== 429) {
    throw new Error(
      `Neynar ${first.status}: ${first.body.slice(0, 200)}`,
    );
  }
  const wait = first.retryAfterMs ?? REQUEST_INTERVAL_MS;
  await new Promise((r) => setTimeout(r, wait));
  const second = await fetchFarcasterBatchOnce(addresses);
  if (second.ok) return second.data;
  throw new Error(
    `Neynar ${second.status} (after retry): ${second.body.slice(0, 200)}`,
  );
}

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();

  console.log(`[farcaster] mode: ${MODE}, target: ${TARGET_COUNT}, batch size: ${BATCH_SIZE}`);

  // Pull the target EOAs from the classification table, ordered by
  // mainnet_nonce desc so the most seasoned self-custody users come
  // first. Page through in 1000-row chunks (PostgREST's default cap).
  // Optionally filter out rows that already have a Farcaster lookup
  // recorded so re-runs don't waste rate-limit budget.
  type ClassRow = {
    eoa: string;
    mainnet_nonce: number | null;
    wallet_class: string;
    farcaster_fid: number | null;
  };
  const rows: ClassRow[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (rows.length < TARGET_COUNT) {
    const remaining = TARGET_COUNT - rows.length;
    const pageLimit = Math.min(PAGE, remaining);
    let q = supabase
      .from("zora_csw_owner_class")
      .select("eoa, mainnet_nonce, wallet_class, farcaster_fid")
      .order("mainnet_nonce", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageLimit - 1);
    if (MODE === "extension") q = q.eq("wallet_class", "likely_extension_eoa");
    if (SKIP_ALREADY_CHECKED) q = q.is("farcaster_fid", null);
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as ClassRow[];
    if (batch.length === 0) break;
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < pageLimit) break;
  }
  console.log(
    `[farcaster] selected ${rows.length} EOAs to check (skip_already_checked=${SKIP_ALREADY_CHECKED})`,
  );

  if (rows.length === 0) {
    console.log(
      "[farcaster] no rows — run `pnpm classify` first to populate zora_csw_owner_class",
    );
    return;
  }

  let checked = 0;
  let matched = 0;
  let errors = 0;
  const lookups: Array<{
    eoa: string;
    fid: number;
    username: string | null;
    display_name: string | null;
  }> = [];

  // Neynar accepts up to ~300 addresses per bulk query but rate-limits
  // aggressively on the free tier. 100 per call keeps us well under.
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const addresses = batch.map((r) => r.eoa);
    try {
      const result = await fetchFarcasterBatch(addresses);
      for (const addr of addresses) {
        // Neynar returns lowercase keys.
        const hits = result[addr.toLowerCase()] ?? [];
        if (hits.length === 0) continue;
        const hit = hits[0]; // Take the first — rare to have multiple FIDs per address.
        lookups.push({
          eoa: addr.toLowerCase(),
          fid: hit.fid,
          username: hit.username ?? null,
          display_name: hit.display_name ?? null,
        });
        matched += 1;
      }
      checked += addresses.length;
    } catch (err) {
      errors += 1;
      if (errors <= 3) {
        console.warn(
          `[farcaster] batch ${i}..${i + batch.length} failed: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }
    // Respect Neynar's free-tier rate limit (6 req/min on
    // bulk-by-address). Default 10.5s gives us ~5.7 req/min.
    await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));
    if (checked % 500 === 0 || i + BATCH_SIZE >= rows.length) {
      const rate = (checked / ((Date.now() - startedAt) / 1000)).toFixed(1);
      console.log(
        `[farcaster] checked=${checked}/${rows.length} matched=${matched} errors=${errors} ${rate} lookups/s`,
      );
    }
  }

  console.log(`[farcaster] persisting ${lookups.length} Farcaster matches…`);
  const now = new Date().toISOString();
  let persisted = 0;
  const PERSIST_BATCH = 500;
  for (let i = 0; i < lookups.length; i += PERSIST_BATCH) {
    const batch = lookups.slice(i, i + PERSIST_BATCH).map((l) => ({
      eoa: l.eoa,
      // wallet_class must be provided for upsert; use a no-op merge by
      // fetching it would be expensive, but upsert with on-conflict
      // updates only the specified columns. We include wallet_class
      // here so a brand-new EOA (unusual for this script's flow) is
      // still classified reasonably.
      wallet_class: MODE === "extension" ? "likely_extension_eoa" : "unknown",
      farcaster_fid: l.fid,
      farcaster_username: l.username,
      farcaster_display_name: l.display_name,
      last_updated_at: now,
    }));
    const { error } = await supabase
      .from("zora_csw_owner_class")
      .upsert(batch, { onConflict: "eoa" });
    if (error) {
      console.warn(`[farcaster] persist batch failed: ${error.message}`);
      continue;
    }
    persisted += batch.length;
  }

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log("\n[farcaster] done");
  console.log(`  EOAs checked:           ${checked}`);
  console.log(`  Farcaster matches:      ${matched}  (${((matched / checked) * 100).toFixed(1)}%)`);
  console.log(`  persisted:              ${persisted}`);
  console.log(`  Neynar errors:          ${errors}`);
  console.log(`  elapsed:                ${elapsed.toFixed(1)}s`);

  // Show the 10 highest-mainnet-nonce matches as a preview.
  const { data: preview } = await supabase
    .from("zora_csw_owner_class")
    .select("eoa, mainnet_nonce, farcaster_fid, farcaster_username, farcaster_display_name")
    .not("farcaster_fid", "is", null)
    .eq("wallet_class", "likely_extension_eoa")
    .order("mainnet_nonce", { ascending: false, nullsFirst: false })
    .limit(10);
  if (preview && preview.length > 0) {
    console.log("\n=== top 10 matched (extension + Farcaster verified) by mainnet activity ===");
    for (const row of preview) {
      console.log(
        `  ${row.eoa}  fid=${row.farcaster_fid}  @${row.farcaster_username ?? "?"} ` +
          `(${row.farcaster_display_name ?? "—"})  mainnet_nonce=${row.mainnet_nonce}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("[farcaster] fatal:", err);
  process.exit(1);
});
