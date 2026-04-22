import "dotenv/config";

import { type Address } from "viem";

import { createBasePublicClient } from "./baseClient.js";
import { createIndexerSupabase } from "./supabase.js";

/**
 * One-off fix + backfill for zora_profiles:
 *
 *   1. Zora's explore API returns the creator's *handle* in both
 *      `name` and `symbol` fields of each creator-token node. The
 *      actual ERC-20 name()/symbol() on-chain is the real ticker
 *      (e.g. "jesse", not "jessepollak"). We re-read name/symbol
 *      on-chain via viem.
 *
 *   2. The raw_profile jsonb we stored during scanTopCoins.ts already
 *      contains richer fields we never extracted: uniqueHolders,
 *      volume24h, socialAccounts (Twitter + Farcaster follower
 *      counts), avatar URL, createdAt. Pull those out into proper
 *      columns so the export carries them directly.
 *
 * Idempotent — re-running just refreshes stale fields.
 */

const CONCURRENCY = Number(process.env.FIX_CONCURRENCY ?? "12");
const TARGET_COUNT = Number(process.env.FIX_TARGET_COUNT ?? "5000");

const ERC20_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

type RawProfile = {
  uniqueHolders?: number | string | null;
  volume24h?: string | null;
  createdAt?: string | null;
  mediaContent?: {
    previewImage?: {
      medium?: string | null;
      small?: string | null;
    } | null;
  } | null;
  creatorProfile?: {
    avatar?: {
      previewImage?: { medium?: string | null; small?: string | null } | null;
    } | null;
    socialAccounts?: {
      twitter?: {
        username?: string | null;
        followerCount?: number | null;
      } | null;
      farcaster?: {
        id?: string | null;
        username?: string | null;
        displayName?: string | null;
        followerCount?: number | null;
      } | null;
    } | null;
  } | null;
};

function parseIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function parseNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();
  const chain = createBasePublicClient();

  console.log(
    `[fix-metadata] pulling up to ${TARGET_COUNT} profiles (concurrency=${CONCURRENCY})…`,
  );

  const { data, error } = await supabase
    .from("zora_profiles")
    .select("handle, zora_creator_coin_address, raw_profile")
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(TARGET_COUNT);
  if (error) throw error;
  type Row = {
    handle: string;
    zora_creator_coin_address: string | null;
    raw_profile: RawProfile | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  console.log(`[fix-metadata] ${rows.length} profiles to process`);

  let completed = 0;
  let onchainOk = 0;
  let onchainFail = 0;
  const inflight = new Set<Promise<void>>();

  for (const row of rows) {
    const task = (async () => {
      // 1. On-chain name/symbol for the coin.
      let coinName: string | null = null;
      let coinSymbol: string | null = null;
      const coin = row.zora_creator_coin_address;
      if (coin && coin.startsWith("0x")) {
        try {
          const [n, s] = await Promise.all([
            chain.readContract({
              address: coin as Address,
              abi: ERC20_ABI,
              functionName: "name",
            }) as Promise<string>,
            chain.readContract({
              address: coin as Address,
              abi: ERC20_ABI,
              functionName: "symbol",
            }) as Promise<string>,
          ]);
          coinName = n ?? null;
          coinSymbol = s ?? null;
          onchainOk += 1;
        } catch {
          onchainFail += 1;
        }
      }

      // 2. Extract richer fields from raw_profile (already stored).
      const rp = row.raw_profile ?? {};
      const uniqueHolders = parseIntOrNull(rp.uniqueHolders);
      const volume24h = parseNumOrNull(rp.volume24h);
      const createdAt =
        typeof rp.createdAt === "string" && rp.createdAt ? rp.createdAt : null;
      const social = rp.creatorProfile?.socialAccounts ?? {};
      const twitter = social.twitter ?? null;
      const farcaster = social.farcaster ?? null;
      const avatar =
        rp.creatorProfile?.avatar?.previewImage?.medium ??
        rp.creatorProfile?.avatar?.previewImage?.small ??
        rp.mediaContent?.previewImage?.medium ??
        rp.mediaContent?.previewImage?.small ??
        null;

      // Prefer Zora-surfaced Farcaster over what Neynar returned,
      // because Zora's linking is the user's own declaration.
      const farcasterFidFromZora = farcaster?.id ? parseIntOrNull(farcaster.id) : null;
      const farcasterUsernameFromZora = farcaster?.username ?? null;
      const farcasterDisplayFromZora = farcaster?.displayName ?? null;

      const patch: Record<string, unknown> = {
        unique_holders: uniqueHolders,
        volume_24h_usd: volume24h,
        avatar_image_url: avatar,
        coin_created_at: createdAt,
        twitter_username: twitter?.username ?? null,
        twitter_follower_count: parseIntOrNull(twitter?.followerCount),
        farcaster_follower_count: parseIntOrNull(farcaster?.followerCount),
      };
      if (coinName !== null) patch.zora_creator_coin_name = coinName;
      if (coinSymbol !== null) patch.zora_creator_coin_symbol = coinSymbol;
      // Only overwrite Farcaster fields if Zora surfaced them AND we
      // didn't already have a better answer. We DO overwrite because
      // Zora's is authoritative (user-declared).
      if (farcasterFidFromZora !== null) {
        patch.farcaster_fid = farcasterFidFromZora;
        patch.farcaster_username = farcasterUsernameFromZora;
        patch.farcaster_display_name = farcasterDisplayFromZora;
        patch.farcaster_synced_at = new Date().toISOString();
      }

      const { error: upErr } = await supabase
        .from("zora_profiles")
        .update(patch)
        .eq("handle", row.handle);
      if (upErr) {
        console.warn(`[fix-metadata] update failed for ${row.handle}: ${upErr.message}`);
      }
      completed += 1;
      if (completed % 20 === 0 || completed === rows.length) {
        console.log(
          `[fix-metadata] ${completed}/${rows.length}  onchain_ok=${onchainOk}  onchain_fail=${onchainFail}`,
        );
      }
    })();
    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  }
  await Promise.all(inflight);

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log(`\n[fix-metadata] done in ${elapsed.toFixed(1)}s`);
}

main().catch((err) => {
  console.error("[fix-metadata] fatal:", err);
  process.exit(1);
});
