import "dotenv/config";

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { getAddress, type Address } from "viem";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Exports the "triple-signal" outreach cohort as JSON + CSV, augmented
 * with at least one Zora CSW address per target. Selection criteria:
 *
 *   - wallet_class = likely_extension_eoa  (self-custody, not Privy)
 *   - has a Basename OR ENS name           (addressable by name)
 *   - has a Zora profile handle            (Zora-identifiable)
 *   - has a Farcaster FID                  (Farcaster-reachable)
 *
 * We rank by mainnet_nonce desc then base_nonce desc — proxy for
 * "seasoned multi-chain user." The output is ready to hand-review or
 * import into an outreach spreadsheet.
 *
 * Why the separate CSW lookup: joining zora_csw_owners.current_owners
 * (checksummed) against zora_csw_owner_class.eoa (lowercase) in a
 * single SQL query times out because the GIN index on current_owners
 * doesn't apply to lower() or lowercase-array containment. Doing the
 * lookup per-row in the script lets us pre-checksum each address and
 * use the GIN index cleanly.
 */

const TARGET_COUNT = Number(process.env.EXPORT_TARGET_COUNT ?? "50");
const OUTPUT_DIR = process.env.EXPORT_OUTPUT_DIR ?? "exports";

type TargetRow = {
  rank: number;
  eoa: string;
  zora_handle: string | null;
  zora_display_name: string | null;
  zora_creator_coin_address: string | null;
  zora_role: "creator" | "collector";
  farcaster_username: string | null;
  farcaster_fid: number | null;
  farcaster_display_name: string | null;
  basename: string | null;
  ens_name: string | null;
  avatar_url: string | null;
  // Activity counters — "tx_count" is clearer in the CSV than "nonce".
  ethereum_tx_count: number | null;
  base_tx_count: number | null;
  total_tx_count: number | null;
  // Derived signal: what fraction of activity happened on Base? Over 0.5
  // means Base-native; under 0.2 means an Ethereum-mainnet-first user
  // who happens to own a Zora CSW. Useful for tailoring outreach copy.
  base_activity_share: number | null;
  activity_tier: "whale" | "heavy" | "active" | "light" | "dormant";
  zora_csw_address: string | null;
  zora_csw_base_owner: string | null;
  zora_creation_tx: string | null;
};

function activityTier(total: number): TargetRow["activity_tier"] {
  if (total >= 5000) return "whale";
  if (total >= 1000) return "heavy";
  if (total >= 200) return "active";
  if (total >= 20) return "light";
  return "dormant";
}

async function main() {
  const supabase = createIndexerSupabase();

  console.log(`[export] pulling top ${TARGET_COUNT} triple-signal targets…`);

  type RawRow = {
    eoa: string;
    zora_handle: string | null;
    zora_display_name: string | null;
    zora_creator_coin_address: string | null;
    farcaster_username: string | null;
    farcaster_fid: number | null;
    farcaster_display_name: string | null;
    basename: string | null;
    basename_avatar: string | null;
    ens_name: string | null;
    ens_avatar: string | null;
    mainnet_nonce: number | null;
    base_nonce: number | null;
  };
  // We pull a wider candidate pool (up to TARGET_COUNT * 10) so we can
  // rank client-side by *total* Base + Ethereum activity. Doing the sum
  // in Postgres ORDER BY isn't index-backed here and the pg-rest ORM
  // doesn't expose expression ordering cleanly, so client-side re-sort
  // on ~500 rows is the pragmatic path.
  const CANDIDATE_POOL = Math.min(TARGET_COUNT * 10, 1000);
  const { data, error } = await supabase
    .from("zora_csw_owner_class")
    .select(
      "eoa, zora_handle, zora_display_name, zora_creator_coin_address, " +
        "farcaster_username, farcaster_fid, farcaster_display_name, " +
        "basename, basename_avatar, ens_name, ens_avatar, mainnet_nonce, base_nonce",
    )
    .eq("wallet_class", "likely_extension_eoa")
    .not("zora_handle", "is", null)
    .not("farcaster_fid", "is", null)
    .order("mainnet_nonce", { ascending: false, nullsFirst: false })
    .limit(CANDIDATE_POOL);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawRow[];
  const withName = rows.filter(
    (r) => r.basename !== null || r.ens_name !== null,
  );
  // Re-rank by total Ethereum + Base activity so Base-native power users
  // (who may have fewer mainnet txs) aren't artificially demoted.
  const ranked = [...withName].sort((a, b) => {
    const totalA = (a.mainnet_nonce ?? 0) + (a.base_nonce ?? 0);
    const totalB = (b.mainnet_nonce ?? 0) + (b.base_nonce ?? 0);
    if (totalB !== totalA) return totalB - totalA;
    // Tiebreak on Base activity (Zora-native preference).
    return (b.base_nonce ?? 0) - (a.base_nonce ?? 0);
  });
  const selected = ranked.slice(0, TARGET_COUNT);
  console.log(`[export] selected ${selected.length} targets`);

  // Lookup a CSW for each. We pre-checksum the EOA and use GIN-supported
  // array containment. Sequential — only 50 rows and it keeps the query
  // shape cheap for Postgres.
  const enriched: TargetRow[] = [];
  let rank = 0;
  for (const row of selected) {
    rank += 1;
    let checksummed: Address;
    try {
      checksummed = getAddress(row.eoa as `0x${string}`);
    } catch {
      continue;
    }

    const { data: cswRows } = await supabase
      .from("zora_csw_owners")
      .select("csw_address, base_owner, creation_tx_hash")
      .contains("current_owners", [checksummed])
      .limit(1);
    const csw = cswRows?.[0] ?? null;

    const cswRow = csw as { csw_address?: string; base_owner?: string; creation_tx_hash?: string } | null;
    const zora_role = row.zora_creator_coin_address ? "creator" : "collector";
    const mainnetTx = row.mainnet_nonce ?? 0;
    const baseTx = row.base_nonce ?? 0;
    const totalTx = mainnetTx + baseTx;
    const baseShare = totalTx > 0 ? +(baseTx / totalTx).toFixed(3) : null;
    enriched.push({
      rank,
      eoa: row.eoa,
      zora_handle: row.zora_handle,
      zora_display_name: row.zora_display_name,
      zora_creator_coin_address: row.zora_creator_coin_address,
      zora_role,
      farcaster_username: row.farcaster_username,
      farcaster_fid: row.farcaster_fid,
      farcaster_display_name: row.farcaster_display_name,
      basename: row.basename,
      ens_name: row.ens_name,
      avatar_url: row.basename_avatar ?? row.ens_avatar ?? null,
      ethereum_tx_count: row.mainnet_nonce,
      base_tx_count: row.base_nonce,
      total_tx_count: totalTx,
      base_activity_share: baseShare,
      activity_tier: activityTier(totalTx),
      zora_csw_address: cswRow?.csw_address ?? null,
      zora_csw_base_owner: cswRow?.base_owner ?? null,
      zora_creation_tx: cswRow?.creation_tx_hash ?? null,
    });
    if (rank % 10 === 0) console.log(`[export] ${rank}/${selected.length} rows enriched with CSW`);
  }

  // Write JSON + CSV.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const basename = `outreach-triple-signal-${enriched.length}-${timestamp}`;
  const jsonPath = join(OUTPUT_DIR, `${basename}.json`);
  const csvPath = join(OUTPUT_DIR, `${basename}.csv`);

  writeFileSync(jsonPath, JSON.stringify(enriched, null, 2));
  writeFileSync(csvPath, toCsv(enriched));

  console.log(`\n[export] wrote ${enriched.length} rows to:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);

  // Preview counts by segment.
  const creators = enriched.filter((r) => r.zora_role === "creator").length;
  const collectors = enriched.length - creators;
  const hasCsw = enriched.filter((r) => r.zora_csw_address).length;
  console.log(`\n[export] by Zora role: ${creators} creators, ${collectors} collectors`);
  console.log(`[export] with CSW address resolved: ${hasCsw}/${enriched.length}`);
}

function escapeCsv(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote if contains comma, quote, or newline. RFC 4180.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: TargetRow[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]) as (keyof TargetRow)[];
  const header = columns.map((c) => escapeCsv(c)).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => escapeCsv(row[col] as string | number | null)).join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

main().catch((err) => {
  console.error("[export] fatal:", err);
  process.exit(1);
});
