import "dotenv/config";

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Cluster XMTP-reachable Zora creators into cohorts of ~12 based on
 * shared-holder overlap, so that each group chat has members whose
 * holders actually overlap — the economic bond that makes the group
 * feel real instead of synthetic.
 *
 * Pipeline:
 *   1. Pull XMTP-reachable creators from the most recent xmtp-reach
 *      probe export and the v_zora_profiles_enriched view.
 *   2. Pull top-holder sets for each of those creators from the
 *      zora_coin_holders table (filters contracts + aggregator bots).
 *   3. Build pairwise Jaccard similarity between all creator-pairs
 *      that have enough holder data.
 *   4. Greedy-assign: pick the most-connected unclustered creator as
 *      seed, repeatedly add the next creator whose average Jaccard
 *      similarity to the current cohort is highest, stop at 12.
 *   5. Report: per-cohort hub creator, avg intra-cohort Jaccard,
 *      top shared super-fan holders, total unique holders reached.
 *
 * Outputs:
 *   exports/cohort-assignments-<ts>.json  (machine-readable)
 *   exports/cohort-assignments-<ts>.csv   (spreadsheet-friendly)
 *
 * Run: pnpm cluster:cohorts
 *
 * Prerequisites — run these upstream steps if not already done:
 *   - `pnpm probe:xmtp` produces exports/xmtp-reach-*.json
 *   - `SCAN_HOLDERS_TOP_COINS=247 pnpm scan-coin-holders` populates
 *     zora_coin_holders (default is 20, which only clusters the top
 *     20 — fine for a pilot, insufficient for the full rollout)
 *   - `pnpm flag-holder-contracts` sets holder_is_contract so we can
 *     filter out bots/aggregators from the overlap calculation
 */

const ROOT = resolve(import.meta.dirname, "..");
const EXPORT_DIR = resolve(ROOT, "exports");

// A holder that holds N or more distinct creator coins is almost
// certainly a bot / aggregator / protocol contract, not a human fan.
// Drop them from the overlap computation so they don't artificially
// inflate Jaccard across every creator pair.
const MAX_COINS_PER_HOLDER_FOR_SIGNAL = Number(
  process.env.CLUSTER_MAX_COINS_PER_HOLDER ?? "30",
);

// A creator with fewer than this many holders in the data can't
// produce a meaningful Jaccard. Drop them from clustering.
const MIN_HOLDERS_PER_CREATOR = Number(
  process.env.CLUSTER_MIN_HOLDERS_PER_CREATOR ?? "20",
);

const COHORT_SIZE = Number(process.env.CLUSTER_COHORT_SIZE ?? "12");

type AddressKind =
  | "payout_recipient"
  | "csw"
  | "primary_wallet"
  | "signing_eoa"
  | "privy_wallet"
  | "base_owner"
  | "holder";

interface XmtpReachRow {
  cohort: "top_creator" | "extension_wallet" | "multi_holder";
  name: string;
  handle: string | null;
  xmtp_reachable: boolean;
  xmtp_address: string | null;
  xmtp_address_kind: AddressKind | null;
}

interface CreatorMeta {
  handle: string;
  zora_creator_coin_address: string;
  zora_creator_coin_symbol: string | null;
  unique_holders: number | null;
  rank: number | null;
  priority_tier: string | null;
  xmtp_address: string;
  xmtp_address_kind: AddressKind;
}

interface CohortMember extends CreatorMeta {
  avg_jaccard_to_cohort: number;
  is_hub: boolean;
}

interface Cohort {
  cohort_id: number;
  members: CohortMember[];
  avg_intra_jaccard: number;
  total_unique_holders: number;
  hub_creator: string;
  top_shared_holders: Array<{
    address: string;
    holds_in_cohort: number;
    is_zora_profile: boolean;
    owner_handle: string | null;
  }>;
}

function latestReachJson(): string {
  const files = readdirSync(EXPORT_DIR)
    .filter((f) => f.startsWith("xmtp-reach-") && f.endsWith(".json"))
    .sort();
  if (!files.length) {
    throw new Error(
      `No xmtp-reach-*.json in ${EXPORT_DIR}. Run 'pnpm probe:xmtp' first.`,
    );
  }
  return resolve(EXPORT_DIR, files[files.length - 1]);
}

function loadReachableCreators(): Map<string, XmtpReachRow> {
  const path = latestReachJson();
  console.log(`[cluster] reading XMTP reach from ${path.split("/").pop()}`);
  const rows = JSON.parse(readFileSync(path, "utf8")) as XmtpReachRow[];
  const byHandle = new Map<string, XmtpReachRow>();
  for (const r of rows) {
    if (!r.xmtp_reachable || !r.xmtp_address) continue;
    if (!r.handle) continue;
    byHandle.set(r.handle.toLowerCase(), r);
  }
  return byHandle;
}

async function loadCreatorProfiles(
  supabase: ReturnType<typeof createIndexerSupabase>,
  reachable: Map<string, XmtpReachRow>,
): Promise<Map<string, CreatorMeta>> {
  // Pull all top_creator rows that have a creator coin (otherwise
  // there are no holders to overlap on).
  const { data, error } = await supabase
    .from("v_zora_profiles_enriched")
    .select(
      "handle, zora_creator_coin_address, zora_creator_coin_symbol, unique_holders, rank, priority_tier",
    )
    .not("zora_creator_coin_address", "is", null);
  if (error) throw error;

  type Row = {
    handle: string;
    zora_creator_coin_address: string;
    zora_creator_coin_symbol: string | null;
    unique_holders: number | null;
    rank: number | null;
    priority_tier: string | null;
  };
  const rows = (data ?? []) as Row[];

  const byCoin = new Map<string, CreatorMeta>();
  let matched = 0;
  for (const r of rows) {
    const reach = reachable.get(r.handle.toLowerCase());
    if (!reach) continue;
    if (!reach.xmtp_address || !reach.xmtp_address_kind) continue;
    byCoin.set(r.zora_creator_coin_address.toLowerCase(), {
      handle: r.handle,
      zora_creator_coin_address: r.zora_creator_coin_address.toLowerCase(),
      zora_creator_coin_symbol: r.zora_creator_coin_symbol,
      unique_holders: r.unique_holders,
      rank: r.rank,
      priority_tier: r.priority_tier,
      xmtp_address: reach.xmtp_address,
      xmtp_address_kind: reach.xmtp_address_kind,
    });
    matched += 1;
  }
  console.log(
    `[cluster] reachable creators with coin address: ${matched}/${rows.length}`,
  );
  return byCoin;
}

async function loadHolderSets(
  supabase: ReturnType<typeof createIndexerSupabase>,
  coinAddresses: string[],
): Promise<{
  holdersByCoin: Map<string, Set<string>>;
  holderCountAcrossCoins: Map<string, number>;
  holderProfileInfo: Map<string, { handle: string | null; is_profile: boolean }>;
}> {
  const holdersByCoin = new Map<string, Set<string>>();
  const coinsByHolder = new Map<string, Set<string>>();
  const holderProfileInfo = new Map<
    string,
    { handle: string | null; is_profile: boolean }
  >();

  // Page through coin_address list in batches of 50 (PostgREST's `.in`
  // operator gets unwieldy at larger sizes).
  const batchSize = 50;
  let totalRows = 0;
  for (let i = 0; i < coinAddresses.length; i += batchSize) {
    const slice = coinAddresses.slice(i, i + batchSize);
    // Paginate within the batch too, since Supabase caps default rows
    // at 1000. We keep range-reading until an empty page.
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("zora_coin_holders")
        .select("coin_address, holder_address, owner_handle, owner_is_profile, holder_is_contract, holder_contract_kind")
        .in("coin_address", slice)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        coin_address: string;
        holder_address: string;
        owner_handle: string | null;
        owner_is_profile: boolean | null;
        holder_is_contract: boolean | null;
        holder_contract_kind: string | null;
      }>;
      if (!rows.length) break;
      for (const r of rows) {
        // Skip contract holders that aren't CBSW proxies (protocol
        // contracts, Uniswap pools, aggregators — these inflate
        // Jaccard artificially without representing human fans).
        if (
          r.holder_is_contract === true &&
          r.holder_contract_kind !== "cbsw_proxy"
        ) {
          continue;
        }
        const coin = r.coin_address.toLowerCase();
        const holder = r.holder_address.toLowerCase();

        let holders = holdersByCoin.get(coin);
        if (!holders) {
          holders = new Set<string>();
          holdersByCoin.set(coin, holders);
        }
        holders.add(holder);

        let coinsForHolder = coinsByHolder.get(holder);
        if (!coinsForHolder) {
          coinsForHolder = new Set<string>();
          coinsByHolder.set(holder, coinsForHolder);
        }
        coinsForHolder.add(coin);

        if (!holderProfileInfo.has(holder)) {
          holderProfileInfo.set(holder, {
            handle: r.owner_handle,
            is_profile: r.owner_is_profile === true,
          });
        }
      }
      totalRows += rows.length;
      if (rows.length < pageSize) break;
      from += pageSize;
    }
  }

  // Now drop aggregator-like holders (holders in >= MAX_COINS_PER_HOLDER_FOR_SIGNAL
  // distinct creator coins) from every coin's holder set. These wallets
  // show up in almost every creator's top-500 and blow out Jaccard.
  let droppedAggregators = 0;
  for (const [holder, coins] of coinsByHolder.entries()) {
    if (coins.size >= MAX_COINS_PER_HOLDER_FOR_SIGNAL) {
      for (const coin of coins) {
        holdersByCoin.get(coin)?.delete(holder);
      }
      droppedAggregators += 1;
    }
  }

  console.log(
    `[cluster] loaded ${totalRows.toLocaleString()} holder rows across ${holdersByCoin.size} coins; dropped ${droppedAggregators} aggregator holders (holding ≥${MAX_COINS_PER_HOLDER_FOR_SIGNAL} coins)`,
  );

  // Recompute holderCountAcrossCoins AFTER aggregator filtering.
  const holderCountAcrossCoins = new Map<string, number>();
  for (const [holder, coins] of coinsByHolder.entries()) {
    if (coins.size >= MAX_COINS_PER_HOLDER_FOR_SIGNAL) continue;
    holderCountAcrossCoins.set(holder, coins.size);
  }

  return { holdersByCoin, holderCountAcrossCoins, holderProfileInfo };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) {
    if (large.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function buildCohorts(
  creators: CreatorMeta[],
  holdersByCoin: Map<string, Set<string>>,
): Cohort[] {
  // Filter creators to those with a usable holder count.
  const usable = creators.filter((c) => {
    const h = holdersByCoin.get(c.zora_creator_coin_address);
    return h && h.size >= MIN_HOLDERS_PER_CREATOR;
  });
  console.log(
    `[cluster] clusterable creators: ${usable.length}/${creators.length} (min ${MIN_HOLDERS_PER_CREATOR} holders each)`,
  );

  if (usable.length === 0) return [];

  // Pre-compute symmetric pairwise similarity matrix indexed by handle.
  const sim = new Map<string, Map<string, number>>();
  for (let i = 0; i < usable.length; i += 1) {
    sim.set(usable[i].handle, new Map());
  }
  for (let i = 0; i < usable.length; i += 1) {
    const a = usable[i];
    const ha = holdersByCoin.get(a.zora_creator_coin_address)!;
    for (let j = i + 1; j < usable.length; j += 1) {
      const b = usable[j];
      const hb = holdersByCoin.get(b.zora_creator_coin_address)!;
      const s = jaccard(ha, hb);
      sim.get(a.handle)!.set(b.handle, s);
      sim.get(b.handle)!.set(a.handle, s);
    }
  }

  // Seed selection: creator with the highest sum-of-similarities is the
  // most "central" node in the overlap graph. Start there, then repeat.
  const remaining = new Set(usable.map((c) => c.handle));
  const byHandle = new Map(usable.map((c) => [c.handle, c]));

  const sumSim = (h: string): number => {
    let total = 0;
    for (const [other, s] of sim.get(h) ?? []) {
      if (remaining.has(other)) total += s;
    }
    return total;
  };

  const cohorts: Cohort[] = [];
  let cohortId = 0;

  while (remaining.size > 0) {
    cohortId += 1;

    // Pick the most-connected remaining creator as seed.
    let seed: string | null = null;
    let seedScore = -1;
    for (const h of remaining) {
      const s = sumSim(h);
      if (s > seedScore) {
        seedScore = s;
        seed = h;
      }
    }
    if (!seed) break;

    const cohort = [seed];
    remaining.delete(seed);

    // Greedy-add the member whose average similarity to the current
    // cohort is maximal, until size hits COHORT_SIZE or pool runs out.
    while (cohort.length < COHORT_SIZE && remaining.size > 0) {
      let best: string | null = null;
      let bestScore = -1;
      for (const h of remaining) {
        let sum = 0;
        for (const m of cohort) sum += sim.get(h)!.get(m) ?? 0;
        const avg = sum / cohort.length;
        if (avg > bestScore) {
          bestScore = avg;
          best = h;
        }
      }
      if (!best) break;
      cohort.push(best);
      remaining.delete(best);
    }

    // Build cohort record with metrics.
    const members: CohortMember[] = cohort.map((h) => {
      let sum = 0;
      for (const m of cohort) {
        if (m === h) continue;
        sum += sim.get(h)!.get(m) ?? 0;
      }
      const avg = cohort.length > 1 ? sum / (cohort.length - 1) : 0;
      return {
        ...(byHandle.get(h) as CreatorMeta),
        avg_jaccard_to_cohort: avg,
        is_hub: false, // set below
      };
    });

    // Hub = member with highest avg_jaccard_to_cohort
    let hub = members[0];
    for (const m of members) if (m.avg_jaccard_to_cohort > hub.avg_jaccard_to_cohort) hub = m;
    hub.is_hub = true;

    // Intra-cohort avg Jaccard (over all unique pairs)
    let pairSum = 0;
    let pairCount = 0;
    for (let i = 0; i < cohort.length; i += 1) {
      for (let j = i + 1; j < cohort.length; j += 1) {
        pairSum += sim.get(cohort[i])!.get(cohort[j]) ?? 0;
        pairCount += 1;
      }
    }
    const avgIntraJaccard = pairCount === 0 ? 0 : pairSum / pairCount;

    cohorts.push({
      cohort_id: cohortId,
      members,
      avg_intra_jaccard: avgIntraJaccard,
      total_unique_holders: 0, // filled by caller who owns the union data
      hub_creator: hub.handle,
      top_shared_holders: [],
    });
  }

  return cohorts;
}

function enrichCohortsWithHolderStats(
  cohorts: Cohort[],
  holdersByCoin: Map<string, Set<string>>,
  holderProfileInfo: Map<string, { handle: string | null; is_profile: boolean }>,
): void {
  for (const c of cohorts) {
    // Union of all holders across cohort coins.
    const union = new Set<string>();
    const coinSets = c.members.map((m) =>
      holdersByCoin.get(m.zora_creator_coin_address) ?? new Set<string>(),
    );
    for (const s of coinSets) for (const h of s) union.add(h);
    c.total_unique_holders = union.size;

    // Top super-fans: holders present in the most cohort coins.
    const countByHolder = new Map<string, number>();
    for (const s of coinSets) {
      for (const h of s) {
        countByHolder.set(h, (countByHolder.get(h) ?? 0) + 1);
      }
    }
    const ranked = [...countByHolder.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    c.top_shared_holders = ranked.map(([address, count]) => {
      const info = holderProfileInfo.get(address);
      return {
        address,
        holds_in_cohort: count,
        is_zora_profile: info?.is_profile ?? false,
        owner_handle: info?.handle ?? null,
      };
    });
  }
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeOutputs(cohorts: Cohort[]): { jsonPath: string; csvPath: string } {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = resolve(EXPORT_DIR, `cohort-assignments-${ts}.json`);
  const csvPath = resolve(EXPORT_DIR, `cohort-assignments-${ts}.csv`);

  const stats = {
    cohorts: cohorts.length,
    creators_assigned: cohorts.reduce((n, c) => n + c.members.length, 0),
    largest_cohort: cohorts.reduce(
      (n, c) => Math.max(n, c.members.length),
      0,
    ),
    smallest_cohort: cohorts.reduce(
      (n, c) => (c.members.length < n ? c.members.length : n),
      Number.POSITIVE_INFINITY,
    ),
    best_cohort_by_jaccard: cohorts
      .slice()
      .sort((a, b) => b.avg_intra_jaccard - a.avg_intra_jaccard)[0]?.cohort_id,
    config: {
      cohort_size_target: COHORT_SIZE,
      max_coins_per_holder: MAX_COINS_PER_HOLDER_FOR_SIGNAL,
      min_holders_per_creator: MIN_HOLDERS_PER_CREATOR,
    },
  };

  writeFileSync(
    jsonPath,
    JSON.stringify({ stats, cohorts }, null, 2),
  );

  const csvRows: string[] = [];
  csvRows.push(
    [
      "cohort_id",
      "is_hub",
      "handle",
      "coin_ticker",
      "priority_tier",
      "rank",
      "unique_holders",
      "avg_jaccard_to_cohort",
      "avg_intra_jaccard",
      "cohort_total_holders",
      "cohort_hub",
      "xmtp_address",
      "xmtp_address_kind",
    ]
      .map(csvEscape)
      .join(","),
  );
  for (const c of cohorts) {
    for (const m of c.members) {
      csvRows.push(
        [
          c.cohort_id,
          m.is_hub ? "true" : "false",
          m.handle,
          m.zora_creator_coin_symbol ?? "",
          m.priority_tier ?? "",
          m.rank ?? "",
          m.unique_holders ?? "",
          m.avg_jaccard_to_cohort.toFixed(4),
          c.avg_intra_jaccard.toFixed(4),
          c.total_unique_holders,
          c.hub_creator,
          m.xmtp_address,
          m.xmtp_address_kind,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  writeFileSync(csvPath, csvRows.join("\n") + "\n");

  return { jsonPath, csvPath };
}

function printSummary(cohorts: Cohort[]): void {
  console.log(`\n[cluster] ${cohorts.length} cohort(s) produced:\n`);
  for (const c of cohorts) {
    console.log(
      `  Cohort ${c.cohort_id}  (n=${c.members.length}, avg Jaccard ${c.avg_intra_jaccard.toFixed(3)}, ${c.total_unique_holders.toLocaleString()} unique holders reached)`,
    );
    console.log(
      `    hub: @${c.hub_creator}`,
    );
    console.log(
      `    members: ${c.members.map((m) => `@${m.handle}${m.is_hub ? "★" : ""}`).join(", ")}`,
    );
    if (c.top_shared_holders.length) {
      const top3 = c.top_shared_holders.slice(0, 3);
      console.log(
        `    top super-fans: ${top3
          .map(
            (h) =>
              `${h.owner_handle ? "@" + h.owner_handle : h.address.slice(0, 6) + "…" + h.address.slice(-4)} (holds ${h.holds_in_cohort}/${c.members.length})`,
          )
          .join(", ")}`,
      );
    }
    console.log("");
  }
}

async function main() {
  console.log("=== CLUSTER: holder-overlap cohort assignment ===\n");

  const supabase = createIndexerSupabase();
  const reachable = loadReachableCreators();
  console.log(`[cluster] XMTP-reachable creators with handle: ${reachable.size}`);

  const creators = await loadCreatorProfiles(supabase, reachable);
  const coinAddrs = [...creators.keys()];
  if (coinAddrs.length === 0) {
    console.log("[cluster] no reachable creators with coins — nothing to do");
    return;
  }

  const { holdersByCoin, holderProfileInfo } = await loadHolderSets(
    supabase,
    coinAddrs,
  );

  const coinsWithHolders = coinAddrs.filter(
    (a) => (holdersByCoin.get(a)?.size ?? 0) >= MIN_HOLDERS_PER_CREATOR,
  );
  console.log(
    `[cluster] coins with ≥${MIN_HOLDERS_PER_CREATOR} holders: ${coinsWithHolders.length}/${coinAddrs.length}`,
  );
  if (coinsWithHolders.length < COHORT_SIZE) {
    console.warn(
      `[cluster] WARNING: only ${coinsWithHolders.length} clusterable creators (< ${COHORT_SIZE}). ` +
        `Will produce a single small cohort. Run 'SCAN_HOLDERS_TOP_COINS=247 pnpm scan-coin-holders' to expand the holder dataset.`,
    );
  }

  const orderedCreators = [...creators.values()]
    .filter((c) => (holdersByCoin.get(c.zora_creator_coin_address)?.size ?? 0) >= MIN_HOLDERS_PER_CREATOR)
    .sort((a, b) => (b.unique_holders ?? 0) - (a.unique_holders ?? 0));

  const cohorts = buildCohorts(orderedCreators, holdersByCoin);
  enrichCohortsWithHolderStats(cohorts, holdersByCoin, holderProfileInfo);

  printSummary(cohorts);

  if (cohorts.length === 0) {
    console.log("[cluster] no cohorts produced — skipping output files");
    return;
  }

  const { jsonPath, csvPath } = writeOutputs(cohorts);
  console.log(`[cluster] wrote ${jsonPath}`);
  console.log(`[cluster] wrote ${csvPath}`);
  console.log(
    `\n[cluster] next steps:\n` +
      `  1. Inspect exports/cohort-assignments-*.csv — pick 1 cohort for the pilot.\n` +
      `  2. Run groups:plan with --shape=top-only against that cohort's XMTP addresses.\n` +
      `  3. When satisfied, scale to all cohorts (after expanding holder scan).\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
