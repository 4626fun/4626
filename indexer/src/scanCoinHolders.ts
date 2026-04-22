import "dotenv/config";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Scan top holders of top Zora creator coins into zora_coin_holders.
 *
 * Input: the top N creators from zora_profiles, ranked by
 *        unique_holders (the signal we trust most — it's not gameable
 *        the way market cap is).
 *
 * For each creator coin we paginate getCoinHolders (Zora SDK) up to
 * HOLDERS_PER_COIN deep. The default is 500 — enough to capture
 * conviction holders without descending into the airdrop long tail.
 *
 * What we record per holder:
 *   - coin_address, holder_address, balance_raw, rank_in_coin
 *   - owner_handle: the holder's Zora handle if they have a profile
 *   - owner_is_profile: true only when Zora returned GraphQLAccountProfile
 *     (i.e., a real Zora user). GraphQLWalletProfile means anonymous
 *     address with no Zora account.
 *
 * Downstream queries derive:
 *   F — creator-to-creator: holders whose handle appears in zora_profiles
 *   B — multi-creator believers: holders present in 3+ coins
 *   C — whales per creator: top N by balance_raw
 *   and more.
 *
 * Idempotent: re-running UPSERTs on (coin_address, holder_address).
 */

const ZORA_API_KEY = (process.env.ZORA_SERVER_API_KEY ?? "").trim();
if (!ZORA_API_KEY) {
  console.error("[scan-holders] ZORA_SERVER_API_KEY required");
  process.exit(1);
}

const TOP_COINS_COUNT = Number(process.env.SCAN_HOLDERS_TOP_COINS ?? "20");
const HOLDERS_PER_COIN = Number(process.env.SCAN_HOLDERS_PER_COIN ?? "500");
// Zora's getCoinHolders endpoint caps pages at ~20 regardless of the
// `first` value we request, so we set it to 20 and paginate more.
const PAGE_SIZE = Number(process.env.SCAN_HOLDERS_PAGE_SIZE ?? "20");
const PERSIST_BATCH_SIZE = Number(process.env.SCAN_HOLDERS_PERSIST_BATCH ?? "200");
const REQUEST_INTERVAL_MS = Number(process.env.SCAN_HOLDERS_INTERVAL_MS ?? "200");

type HolderEdge = {
  node?: {
    balance?: string;
    ownerAddress?: string;
    ownerProfile?: {
      __typename?: string;
      handle?: string | null;
      avatar?: { previewImage?: { medium?: string | null; small?: string | null } | null } | null;
    } | null;
  };
};

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();
  const sdk: any = await import("@zoralabs/coins-sdk");
  sdk.setApiKey(ZORA_API_KEY);

  // Pick top creator coins by unique_holders (the quality signal). Skip
  // any profile without a creator_coin_address or unique_holders data.
  const { data: creatorsData, error: creatorsErr } = await supabase
    .from("zora_profiles")
    .select("handle, zora_creator_coin_address, unique_holders, zora_creator_coin_symbol")
    .not("zora_creator_coin_address", "is", null)
    .not("unique_holders", "is", null)
    .order("unique_holders", { ascending: false, nullsFirst: false })
    .limit(TOP_COINS_COUNT);
  if (creatorsErr) throw creatorsErr;
  type Creator = {
    handle: string;
    zora_creator_coin_address: string;
    unique_holders: number;
    zora_creator_coin_symbol: string | null;
  };
  const creators = (creatorsData ?? []) as unknown as Creator[];
  console.log(`[scan-holders] scanning top ${creators.length} creators (by unique_holders)`);
  console.log(`[scan-holders] holders per coin: ${HOLDERS_PER_COIN}, page size: ${PAGE_SIZE}`);

  let totalHoldersInserted = 0;
  let totalProfileHolders = 0;
  let totalWalletHolders = 0;

  for (const creator of creators) {
    const coin = creator.zora_creator_coin_address.toLowerCase();
    console.log(
      `\n[scan-holders] @${creator.handle} $${creator.zora_creator_coin_symbol ?? ""} (${creator.unique_holders.toLocaleString()} total holders)`,
    );

    let after: string | undefined;
    let fetched = 0;
    let rank = 0;
    const pending: Array<{
      coin_address: string;
      holder_address: string;
      balance_raw: string;
      rank_in_coin: number;
      owner_handle: string | null;
      owner_is_profile: boolean;
      owner_avatar_url: string | null;
      raw_node: unknown;
    }> = [];

    const flushPending = async () => {
      if (pending.length === 0) return;
      const batch = pending.splice(0, pending.length);
      const { error } = await supabase
        .from("zora_coin_holders")
        .upsert(batch, { onConflict: "coin_address,holder_address" });
      if (error) {
        console.warn(`[scan-holders] upsert failed: ${error.message}`);
        return;
      }
      totalHoldersInserted += batch.length;
    };

    while (fetched < HOLDERS_PER_COIN) {
      const first = Math.min(PAGE_SIZE, HOLDERS_PER_COIN - fetched);
      let response: any;
      try {
        response = await sdk.getCoinHolders({
          address: coin,
          chainId: 8453,
          first,
          after,
        });
      } catch (err) {
        console.warn(
          `[scan-holders] fetch failed for ${creator.handle} at rank ${fetched}:`,
          err instanceof Error ? err.message : err,
        );
        break;
      }
      const tokenBalances = response?.data?.zora20Token?.tokenBalances;
      const edges: HolderEdge[] = tokenBalances?.edges ?? [];
      if (edges.length === 0) {
        break;
      }
      for (const edge of edges) {
        const n = edge.node;
        if (!n?.ownerAddress || !n.balance) continue;
        rank += 1;
        const isProfile = n.ownerProfile?.__typename === "GraphQLAccountProfile";
        const handle = isProfile ? (n.ownerProfile?.handle ?? null) : null;
        if (isProfile) totalProfileHolders += 1;
        else totalWalletHolders += 1;
        const avatar =
          n.ownerProfile?.avatar?.previewImage?.medium ??
          n.ownerProfile?.avatar?.previewImage?.small ??
          null;
        pending.push({
          coin_address: coin,
          holder_address: n.ownerAddress.toLowerCase(),
          balance_raw: n.balance,
          rank_in_coin: rank,
          owner_handle: handle,
          owner_is_profile: isProfile,
          owner_avatar_url: avatar,
          raw_node: n,
        });
        if (pending.length >= PERSIST_BATCH_SIZE) await flushPending();
      }
      fetched += edges.length;
      const hasNext = tokenBalances?.pageInfo?.hasNextPage;
      after = tokenBalances?.pageInfo?.endCursor;
      // Only break on explicit end signals. Don't infer end from
      // "fewer results than requested" because Zora caps page size
      // server-side and `first` is a soft hint, not a hard contract.
      if (!hasNext || !after) break;
      if (REQUEST_INTERVAL_MS > 0) {
        await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));
      }
    }
    await flushPending();
    console.log(
      `  captured ${rank} top holders (profile=${
        // profile count for this creator only — approximate from pending/totalProfileHolders delta
        "—"
      })`,
    );
  }

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log(`\n[scan-holders] done in ${elapsed.toFixed(1)}s`);
  console.log(`  total holder rows written: ${totalHoldersInserted}`);
  console.log(`  holders with Zora profile: ${totalProfileHolders}`);
  console.log(`  holders with no profile:   ${totalWalletHolders}`);
}

main().catch((err) => {
  console.error("[scan-holders] fatal:", err);
  process.exit(1);
});
