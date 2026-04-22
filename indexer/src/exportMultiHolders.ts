import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
 * Export the "multi-creator believer" cohort: addresses that hold
 * coins from 3+ of our top 20 tracked Zora creators. This cohort was
 * discovered via the zora_coin_holders foundation and is NOT present
 * in any of our other datasets (zero overlap with zora_csw_owners or
 * zora_csw_owner_class).
 *
 * For each row we attempt to resolve identity signals inline:
 *   - Basename (Coinbase .base.eth via ENSIP-19 coinType reverse)
 *   - ENS name (.eth on Ethereum mainnet reverse)
 *   - Farcaster (single Neynar bulk-by-address batch at the end)
 *
 * Result: a CSV with 56 rows, each either (a) a Zora-profiled creator
 * we can look up by handle, or (b) an anonymous address for which we
 * resolved name/Farcaster if possible.
 */

const NEYNAR_API_KEY = (process.env.NEYNAR_API_KEY ?? "").trim();
const MIN_CREATORS = Number(process.env.MULTI_MIN_CREATORS ?? "3");
const OUTPUT_DIR = process.env.EXPORT_OUTPUT_DIR ?? "exports";

const ENS_GATEWAY_URLS = ["https://ccip.ens.xyz"];

function createMainnetClient() {
  const rpcUrl = (process.env.MAINNET_RPC_URL ?? "").trim();
  const urls = rpcUrl
    ? [rpcUrl]
    : [
        "https://ethereum-rpc.publicnode.com",
        "https://rpc.ankr.com/eth",
        "https://eth.llamarpc.com",
      ];
  return createPublicClient({
    chain: mainnet,
    transport: fallback(urls.map((u) => http(u, { retryCount: 2, retryDelay: 300 }))),
  });
}

type MultiHolderRow = {
  rank: number;
  holder_address: string;
  owner_handle: string | null;
  is_zora_profile: boolean;
  holder_kind: "eoa" | "cbsw_proxy" | null;
  creators_held: number;
  creator_handles: string[];
  avatar_url: string | null;
  basename: string | null;
  ens_name: string | null;
  farcaster_fid: number | null;
  farcaster_username: string | null;
  farcaster_display_name: string | null;
};

async function resolveBasenameAndEns(
  client: ReturnType<typeof createMainnetClient>,
  address: Address,
): Promise<{ basename: string | null; ens: string | null }> {
  let basename: string | null = null;
  let ens: string | null = null;
  try {
    const n = await client.getEnsName({
      address,
      coinType: toCoinType(base.id),
      gatewayUrls: ENS_GATEWAY_URLS,
    });
    if (n && n.toLowerCase().endsWith(".base.eth")) basename = n;
  } catch {}
  try {
    const n = await client.getEnsName({ address });
    if (n && !n.toLowerCase().endsWith(".base.eth")) ens = n;
  } catch {}
  return { basename, ens };
}

type NeynarBulkResponse = Record<
  string,
  Array<{ fid: number; username?: string; display_name?: string }>
>;

async function fetchFarcasterBulk(addresses: string[]): Promise<NeynarBulkResponse> {
  if (addresses.length === 0 || !NEYNAR_API_KEY) return {};
  const url = new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address");
  url.searchParams.set("addresses", addresses.join(","));
  url.searchParams.set("address_types", "verified_address,custody_address");
  const res = await fetch(url, {
    headers: { accept: "application/json", "x-api-key": NEYNAR_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`Neynar ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  return (await res.json()) as NeynarBulkResponse;
}

async function main() {
  const supabase = createIndexerSupabase();
  const chain = createMainnetClient();

  console.log(`[multi-export] pulling multi-holders (≥${MIN_CREATORS} creators)…`);
  const { data, error } = await supabase.rpc("x_multi_holders", {
    min_creators: MIN_CREATORS,
  });
  // Supabase RPC fallback — if we don't have a dedicated function, do
  // the query via a CTE-style raw select.
  let raw: Array<{
    holder_address: string;
    owner_handle: string | null;
    is_zora_profile: boolean;
    holder_kind: "eoa" | "cbsw_proxy" | null;
    creators_held: number;
    creator_handles: string[];
    avatar_url: string | null;
    total_balance_raw: string;
  }>;
  if (error || !data) {
    console.log("[multi-export] (using inline query)");
    const q = `
      with multi as (
        select h.holder_address,
               h.owner_handle,
               bool_or(h.owner_is_profile) as is_zora_profile,
               count(distinct h.coin_address)::int as creators_held,
               array_agg(distinct p.handle order by p.handle) as creator_handles,
               sum(h.balance_raw::numeric) as total_balance_raw,
               max(h.owner_avatar_url) as avatar_url
        from zora_coin_holders h
        join zora_profiles p on p.zora_creator_coin_address = h.coin_address
        group by h.holder_address, h.owner_handle
        having count(distinct h.coin_address) >= ${MIN_CREATORS}
      )
      select * from multi
      order by creators_held desc, total_balance_raw desc
    `;
    // We can't run raw SQL via supabase-js directly without an RPC. Use
    // a direct PostgREST select by recreating the query manually —
    // pull all rows from zora_coin_holders + zora_profiles and group
    // client-side. PostgREST caps page size at 1000, so we keyset-
    // paginate on (coin_address, holder_address) which is the primary
    // key composite.
    type HolderRowRaw = {
      coin_address: string;
      holder_address: string;
      owner_handle: string | null;
      owner_is_profile: boolean;
      owner_avatar_url: string | null;
      balance_raw: string;
      holder_contract_kind: string | null;
    };
    const holdersAll: HolderRowRaw[] = [];
    const PAGE = 1000;
    let cursorCoin: string | null = null;
    let cursorHolder: string | null = null;
    while (true) {
      let q = supabase
        .from("zora_coin_holders")
        .select(
          "coin_address, holder_address, owner_handle, owner_is_profile, owner_avatar_url, balance_raw, holder_contract_kind",
        )
        // Exclude protocol contracts (large_contract like Uniswap V4
        // PoolManager, generic_contract like vaults/Safes/splitters).
        // CBSW proxies and EOAs both represent real end users.
        .in("holder_contract_kind", ["eoa", "cbsw_proxy"])
        .order("coin_address", { ascending: true })
        .order("holder_address", { ascending: true })
        .limit(PAGE);
      if (cursorCoin !== null && cursorHolder !== null) {
        // Keyset on the composite key: rows strictly after (cursorCoin,
        // cursorHolder) in lex order. PostgREST doesn't support tuple
        // comparisons directly, so we use an `or` clause: coin_address
        // > cursorCoin OR (coin_address = cursorCoin AND holder_address
        // > cursorHolder).
        q = q.or(
          `coin_address.gt.${cursorCoin},and(coin_address.eq.${cursorCoin},holder_address.gt.${cursorHolder})`,
        );
      }
      const { data: page, error: pErr } = await q;
      if (pErr) throw pErr;
      const pageRows = (page ?? []) as HolderRowRaw[];
      if (pageRows.length === 0) break;
      holdersAll.push(...pageRows);
      const last = pageRows[pageRows.length - 1];
      cursorCoin = last.coin_address;
      cursorHolder = last.holder_address;
      if (pageRows.length < PAGE) break;
    }
    console.log(`[multi-export]   pulled ${holdersAll.length} holder rows`);
    const holders = holdersAll;
    const hErr = null;
    if (hErr) throw hErr;
    const { data: profiles, error: pErr } = await supabase
      .from("zora_profiles")
      .select("handle, zora_creator_coin_address");
    if (pErr) throw pErr;

    const coinToHandle = new Map<string, string>();
    for (const p of (profiles ?? []) as Array<{ handle: string; zora_creator_coin_address: string | null }>) {
      if (p.zora_creator_coin_address) coinToHandle.set(p.zora_creator_coin_address.toLowerCase(), p.handle);
    }
    type HolderRow = {
      coin_address: string;
      holder_address: string;
      owner_handle: string | null;
      owner_is_profile: boolean;
      owner_avatar_url: string | null;
      balance_raw: string;
    };
    type Aggregated = {
      holder_address: string;
      owner_handle: string | null;
      is_zora_profile: boolean;
      holder_kind: "eoa" | "cbsw_proxy" | null;
      creators: Set<string>;
      balance_total: bigint;
      avatar_url: string | null;
    };
    const agg = new Map<string, Aggregated>();
    for (const row of (holders ?? []) as HolderRowRaw[]) {
      const creator = coinToHandle.get(row.coin_address.toLowerCase());
      if (!creator) continue;
      const key = row.holder_address.toLowerCase();
      const existing = agg.get(key);
      const balanceBig = (() => {
        try {
          return BigInt(row.balance_raw);
        } catch {
          return 0n;
        }
      })();
      const kindFromRow: "eoa" | "cbsw_proxy" | null =
        row.holder_contract_kind === "eoa" || row.holder_contract_kind === "cbsw_proxy"
          ? row.holder_contract_kind
          : null;
      if (existing) {
        existing.creators.add(creator);
        existing.balance_total += balanceBig;
        if (!existing.avatar_url && row.owner_avatar_url) existing.avatar_url = row.owner_avatar_url;
        if (!existing.is_zora_profile && row.owner_is_profile) existing.is_zora_profile = row.owner_is_profile;
        if (!existing.owner_handle && row.owner_handle) existing.owner_handle = row.owner_handle;
        if (!existing.holder_kind && kindFromRow) existing.holder_kind = kindFromRow;
      } else {
        agg.set(key, {
          holder_address: row.holder_address.toLowerCase(),
          owner_handle: row.owner_handle,
          is_zora_profile: row.owner_is_profile,
          holder_kind: kindFromRow,
          creators: new Set([creator]),
          balance_total: balanceBig,
          avatar_url: row.owner_avatar_url,
        });
      }
    }
    raw = [...agg.values()]
      .filter((a) => a.creators.size >= MIN_CREATORS)
      .sort((a, b) => {
        if (b.creators.size !== a.creators.size) return b.creators.size - a.creators.size;
        return Number(b.balance_total - a.balance_total);
      })
      .map((a) => ({
        holder_address: a.holder_address,
        owner_handle: a.owner_handle,
        is_zora_profile: a.is_zora_profile,
        holder_kind: a.holder_kind,
        creators_held: a.creators.size,
        creator_handles: [...a.creators].sort(),
        avatar_url: a.avatar_url,
        total_balance_raw: a.balance_total.toString(),
      }));
  } else {
    raw = data as typeof raw;
  }

  console.log(`[multi-export] ${raw.length} multi-holders identified`);

  // Enrich anonymous addresses with Basename/ENS + Farcaster.
  const anonymousAddrs = raw.filter((r) => !r.is_zora_profile).map((r) => r.holder_address as Address);
  console.log(
    `[multi-export] resolving Basename/ENS for ${anonymousAddrs.length} anonymous addresses (sequential, CCIP)…`,
  );
  const nameResults = new Map<string, { basename: string | null; ens: string | null }>();
  for (const addr of anonymousAddrs) {
    nameResults.set(addr.toLowerCase(), await resolveBasenameAndEns(chain, addr));
  }
  const withBasename = [...nameResults.values()].filter((v) => v.basename).length;
  const withEns = [...nameResults.values()].filter((v) => v.ens).length;
  console.log(`[multi-export] basename=${withBasename} ens=${withEns}`);

  // Farcaster in one bulk batch (up to 100 addresses at once; we have ≤40).
  let fcResult: NeynarBulkResponse = {};
  if (anonymousAddrs.length > 0 && NEYNAR_API_KEY) {
    try {
      fcResult = await fetchFarcasterBulk(anonymousAddrs);
    } catch (err) {
      console.warn(
        `[multi-export] Farcaster lookup failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  const fcMatches = Object.values(fcResult).filter((hits) => hits.length > 0).length;
  console.log(`[multi-export] farcaster matches=${fcMatches}`);

  // Compose final rows
  const rows: MultiHolderRow[] = raw.map((r, i) => {
    const names = nameResults.get(r.holder_address.toLowerCase()) ?? { basename: null, ens: null };
    const fcHits = fcResult[r.holder_address.toLowerCase()] ?? [];
    const fc = fcHits[0] ?? null;
    return {
      rank: i + 1,
      holder_address: r.holder_address,
      owner_handle: r.owner_handle,
      is_zora_profile: r.is_zora_profile,
      holder_kind: r.holder_kind,
      creators_held: r.creators_held,
      creator_handles: r.creator_handles,
      avatar_url: r.avatar_url,
      basename: names.basename,
      ens_name: names.ens,
      farcaster_fid: fc?.fid ?? null,
      farcaster_username: fc?.username ?? null,
      farcaster_display_name: fc?.display_name ?? null,
    };
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const stem = `outreach-multi-creator-believers-${rows.length}-${ts}`;
  const jsonPath = join(OUTPUT_DIR, `${stem}.json`);
  const csvPath = join(OUTPUT_DIR, `${stem}.csv`);
  writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
  writeFileSync(csvPath, toCsv(rows));

  console.log(`\n[multi-export] wrote ${rows.length} rows:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);

  const withZora = rows.filter((r) => r.is_zora_profile).length;
  const withName = rows.filter((r) => r.basename || r.ens_name).length;
  const withFc = rows.filter((r) => r.farcaster_fid).length;
  const reachable = rows.filter(
    (r) => r.is_zora_profile || r.basename || r.ens_name || r.farcaster_fid,
  ).length;
  console.log(`\n=== segment breakdown ===`);
  console.log(`  total multi-holders:            ${rows.length}`);
  console.log(`  with Zora profile:              ${withZora}`);
  console.log(`  anonymous addresses:            ${rows.length - withZora}`);
  console.log(`    of which with Basename/ENS:   ${withName}`);
  console.log(`    of which with Farcaster:      ${withFc}`);
  console.log(`  REACHABLE (any identity):       ${reachable}  (${((reachable / rows.length) * 100).toFixed(1)}%)`);
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return escapeCsv(value.join("|"));
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: MultiHolderRow[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]) as (keyof MultiHolderRow)[];
  const header = columns.map((c) => escapeCsv(c)).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => escapeCsv(row[col])).join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

main().catch((err) => {
  console.error("[multi-export] fatal:", err);
  process.exit(1);
});
