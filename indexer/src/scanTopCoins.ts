import "dotenv/config";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Enumerate top Zora creator coins by market cap via the official
 * @zoralabs/coins-sdk explore endpoint, and upsert one row per coin
 * into zora_profiles keyed by the creator's handle.
 *
 * Why this exists:
 *   Our on-chain indexer (zora_csw_owners) only captures CSWs created
 *   through Zora's ZoraAccountManager wrapper. Users like Jesse Pollak
 *   whose smart wallet was created via the canonical Coinbase Wallet
 *   factory (or any non-Zora path) are invisible to that index.
 *
 *   Zora itself operates at the *profile* layer — every user has one
 *   handle and a set of linkedWallets (external / Privy / smart
 *   wallet). Market-cap-ranked enumeration is the cleanest way to
 *   sweep up the real economic leaders on the platform, and payout
 *   recipient + creator profile are already inline on each coin
 *   response, so a single pagination pass is enough for v1.
 */

const ZORA_API_KEY = (process.env.ZORA_SERVER_API_KEY ?? "").trim();
if (!ZORA_API_KEY) {
  console.error("[scan-top-coins] ZORA_SERVER_API_KEY required in env. Aborting.");
  process.exit(1);
}

const TARGET_COUNT = Number(process.env.SCAN_COINS_TARGET_COUNT ?? "500");
const PAGE_SIZE = Number(process.env.SCAN_COINS_PAGE_SIZE ?? "50");
/**
 * Which ranked list to enumerate. Maps to a typed helper on the SDK.
 *   most_valuable_creators → getMostValuableCreatorCoins
 *   creator_coins          → getCreatorCoins (all creator coins, paginated)
 *   most_valuable          → getCoinsMostValuable (content coins + creator coins)
 *   top_volume_24h         → getCoinsTopVolume24h
 *   top_gainers            → getCoinsTopGainers
 *   new_creators           → dedicated "new creator profiles" listing
 */
const LIST_TYPE = (process.env.SCAN_COINS_LIST_TYPE ?? "most_valuable_creators") as string;
const REQUEST_INTERVAL_MS = Number(process.env.SCAN_COINS_INTERVAL_MS ?? "250");

/**
 * Subset of Zora's creator-profile shape we care about. Zora returns
 * additional fields (id, username, avatar, links…) that we keep as raw
 * JSON for later extraction rather than flattening into the schema.
 */
type CreatorProfile = {
  id?: string;
  handle?: string;
  username?: string;
  displayName?: string;
  publicWallet?: { walletAddress?: string } | null;
} | null;

type CoinEdge = {
  node: {
    id?: string;
    name?: string;
    description?: string;
    address?: string;
    symbol?: string;
    totalSupply?: string;
    totalVolume?: string;
    marketCap?: string;
    marketCapDelta24h?: string;
    payoutRecipientAddress?: string;
    creatorAddress?: string;
    creatorProfile?: CreatorProfile;
  };
  cursor?: string;
};

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();
  const sdk: any = await import("@zoralabs/coins-sdk");
  sdk.setApiKey(ZORA_API_KEY);

  console.log(`[scan-top-coins] target=${TARGET_COUNT} listType=${LIST_TYPE} page=${PAGE_SIZE}`);

  let after: string | undefined = undefined;
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalSkipped = 0;
  let page = 0;

  // Map user-friendly LIST_TYPE to the specific SDK helper. Each
  // helper wraps /explore with the right listType baked in.
  const sdkFnByListType: Record<string, (args?: any) => Promise<any>> = {
    most_valuable_creators: sdk.getMostValuableCreatorCoins,
    creator_coins: sdk.getCreatorCoins,
    most_valuable: sdk.getCoinsMostValuable,
    top_volume_24h: sdk.getCoinsTopVolume24h,
    top_gainers: sdk.getCoinsTopGainers,
    new_coins: sdk.getCoinsNew,
    last_traded: sdk.getCoinsLastTraded,
    last_traded_unique: sdk.getCoinsLastTradedUnique,
  };
  const sdkFn = sdkFnByListType[LIST_TYPE];
  if (!sdkFn) {
    console.error(`[scan-top-coins] unknown listType: ${LIST_TYPE}`);
    console.error(`  valid: ${Object.keys(sdkFnByListType).join(", ")}`);
    process.exit(1);
  }

  while (totalFetched < TARGET_COUNT) {
    page += 1;
    const count = Math.min(PAGE_SIZE, TARGET_COUNT - totalFetched);
    let response: any;
    try {
      response = await sdkFn({ count, after });
    } catch (err) {
      console.warn(
        `[scan-top-coins] page ${page} fetch failed:`,
        err instanceof Error ? err.message : err,
      );
      break;
    }

    const exploreList = response?.data?.exploreList;
    const edges: CoinEdge[] = exploreList?.edges ?? [];
    const pageInfo = exploreList?.pageInfo ?? {};

    if (edges.length === 0) {
      console.log(`[scan-top-coins] page ${page}: 0 edges returned, stopping`);
      break;
    }

    const rows = edges
      .map((edge) => {
        const node = edge.node;
        if (!node) return null;
        const handle = node.creatorProfile?.handle ?? node.creatorProfile?.username ?? null;
        if (!handle) {
          totalSkipped += 1;
          return null;
        }
        const payout = (node.payoutRecipientAddress ?? "").toLowerCase() || null;
        return {
          handle,
          zora_profile_id: node.creatorProfile?.id ?? null,
          zora_display_name: node.creatorProfile?.displayName ?? null,
          zora_creator_coin_address: (node.address ?? "").toLowerCase() || null,
          zora_creator_coin_name: node.name ?? null,
          zora_creator_coin_symbol: node.symbol ?? null,
          zora_creator_coin_market_cap: parseNumeric(node.marketCap),
          zora_creator_coin_total_volume: parseNumeric(node.totalVolume),
          payout_recipient: payout,
          primary_wallet: (node.creatorProfile?.publicWallet?.walletAddress ?? "").toLowerCase() || null,
          source: `explore:${LIST_TYPE}`,
          raw_profile: node,
          last_refreshed_at: new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      const { error } = await supabase
        .from("zora_profiles")
        .upsert(rows, { onConflict: "handle" });
      if (error) {
        console.warn(`[scan-top-coins] upsert failed on page ${page}: ${error.message}`);
      } else {
        totalUpserted += rows.length;
      }
    }

    totalFetched += edges.length;
    console.log(
      `[scan-top-coins] page ${page}: ${edges.length} edges, ${rows.length} upserted ` +
        `(total fetched=${totalFetched}, upserted=${totalUpserted}, skipped=${totalSkipped})`,
    );

    // Pagination cursor. Zora's explore endpoint signals the end when
    // hasNextPage=false or endCursor is missing.
    if (!pageInfo?.hasNextPage) {
      console.log(`[scan-top-coins] reached end of paginated results`);
      break;
    }
    after = pageInfo?.endCursor;
    if (!after) {
      console.log(`[scan-top-coins] no endCursor returned, stopping`);
      break;
    }

    if (REQUEST_INTERVAL_MS > 0) {
      await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));
    }
  }

  // Note: is_in_csw_index reconciliation (comparing each profile's
  // primary_wallet or payout_recipient against zora_csw_owners) is done
  // as a separate maintenance query, not inline — keeps this script
  // focused on fetching. Run via Supabase SQL after the scan:
  //   update zora_profiles p
  //     set is_in_csw_index = exists (
  //       select 1 from zora_csw_owners w
  //       where lower(w.base_owner) = p.primary_wallet
  //          or lower(w.base_owner) = p.payout_recipient
  //     );

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log(`\n[scan-top-coins] done`);
  console.log(`  coins fetched:      ${totalFetched}`);
  console.log(`  profiles upserted:  ${totalUpserted}`);
  console.log(`  skipped (no handle):${totalSkipped}`);
  console.log(`  elapsed:            ${elapsed.toFixed(1)}s`);

  // Quick preview
  const { data: preview } = await supabase
    .from("zora_profiles")
    .select(
      "handle, zora_display_name, zora_creator_coin_symbol, zora_creator_coin_market_cap, payout_recipient",
    )
    .not("zora_creator_coin_market_cap", "is", null)
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(10);
  if (preview && preview.length > 0) {
    console.log("\n=== top 10 by creator coin market cap ===");
    for (const row of preview) {
      const mc = row.zora_creator_coin_market_cap;
      const mcStr = typeof mc === "number" ? mc.toLocaleString() : String(mc);
      console.log(
        `  @${row.handle}  "${row.zora_display_name ?? ""}"  ` +
          `${row.zora_creator_coin_symbol ?? "—"}  ` +
          `mc=${mcStr}  payout=${row.payout_recipient ?? "—"}`,
      );
    }
  }
}

function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

main().catch((err) => {
  console.error("[scan-top-coins] fatal:", err);
  process.exit(1);
});
