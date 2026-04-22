import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Export the top-creators-by-market-cap outreach cohort.
 *
 * This is the DIFFERENT slice from exportOutreach.ts:
 *
 *   exportOutreach.ts    → extension-wallet owners of Zora-factory-created
 *                           CSWs (our on-chain-event-based index, ~1,769
 *                           candidates). Biased toward casual signups.
 *
 *   exportTopCreators.ts → market-cap-ranked creators from Zora's own
 *                           explore API, plus linkedWallets + identity
 *                           enrichment. Captures power users (Jesse,
 *                           Uniswap Foundation, etc.) whose CSWs were
 *                           created outside Zora's own flow.
 *
 * Both lists are valuable; they represent different GTM motions.
 */

const TARGET_COUNT = Number(process.env.EXPORT_TARGET_COUNT ?? "500");
const OUTPUT_DIR = process.env.EXPORT_OUTPUT_DIR ?? "exports";

type TargetRow = {
  rank: number;
  handle: string;
  display_name: string | null;
  // Actual ERC-20 ticker read on-chain (post fix-profile-metadata pass).
  coin_ticker: string | null;
  market_cap_usd: number | null;
  total_volume_usd: number | null;
  volume_24h_usd: number | null;
  unique_holders: number | null;
  // Wallets for 4626 install + outreach routing.
  smart_wallet: string | null;
  payout_recipient: string | null;
  primary_wallet: string | null;
  privy_wallet: string | null;
  external_wallets_count: number;
  // Install plan (derived from on-chain isOwnerAddress probes)
  install_target: string | null;
  install_target_source: string | null;
  signing_eoa: string | null;
  signing_eoa_source: string | null;
  signing_eoa_eth: number | null; // ETH, not wei, rounded to 4 decimals
  ready_to_install: boolean;       // has target + signer + gas
  needs_gas_sponsorship: boolean;  // has target + signer, no gas
  // Identity
  basename: string | null;
  ens_name: string | null;
  avatar_url: string | null;
  // Social reach (authoritative from Zora's own socialAccounts field)
  twitter_username: string | null;
  twitter_follower_count: number | null;
  farcaster_username: string | null;
  farcaster_fid: number | null;
  farcaster_display_name: string | null;
  farcaster_follower_count: number | null;
  // Profile extras
  description: string | null;
  website: string | null;
  // Derived flags
  has_name: boolean;
  has_farcaster: boolean;
  has_twitter: boolean;
  total_social_reach: number;
  outreach_channels: string;
};

async function main() {
  const supabase = createIndexerSupabase();

  // Sort by unique_holders desc as the primary quality signal. Market
  // cap alone is gameable (vanity coins with 1-18 holders can show
  // high mc). Unique_holders is a much harder-to-fake measure of
  // actual audience size.
  const SORT_BY = (process.env.EXPORT_SORT_BY ?? "unique_holders") as
    | "unique_holders"
    | "market_cap"
    | "twitter_followers";
  const sortColumn =
    SORT_BY === "market_cap"
      ? "zora_creator_coin_market_cap"
      : SORT_BY === "twitter_followers"
        ? "twitter_follower_count"
        : "unique_holders";
  console.log(`[export-top] pulling top ${TARGET_COUNT} creators (sort: ${SORT_BY})…`);
  const { data, error } = await supabase
    .from("zora_profiles")
    .select(
      "handle, zora_display_name, zora_creator_coin_symbol, zora_creator_coin_market_cap, " +
        "zora_creator_coin_total_volume, volume_24h_usd, unique_holders, " +
        "smart_wallet_address, payout_recipient, primary_wallet, privy_wallet_address, external_wallets, " +
        "basename, basename_avatar, ens_name, ens_avatar, avatar_image_url, " +
        "twitter_username, twitter_follower_count, " +
        "farcaster_username, farcaster_fid, farcaster_display_name, farcaster_follower_count, " +
        "recommended_install_target, recommended_install_source, " +
        "signing_eoa, signing_eoa_source, signing_eoa_balance_wei, " +
        "website, description",
    )
    .order(sortColumn, { ascending: false, nullsFirst: false })
    .limit(TARGET_COUNT);
  if (error) throw error;

  type RawRow = {
    handle: string;
    zora_display_name: string | null;
    zora_creator_coin_symbol: string | null;
    zora_creator_coin_market_cap: number | null;
    zora_creator_coin_total_volume: number | null;
    volume_24h_usd: number | null;
    unique_holders: number | null;
    smart_wallet_address: string | null;
    payout_recipient: string | null;
    primary_wallet: string | null;
    privy_wallet_address: string | null;
    external_wallets: string[] | null;
    basename: string | null;
    basename_avatar: string | null;
    ens_name: string | null;
    ens_avatar: string | null;
    avatar_image_url: string | null;
    twitter_username: string | null;
    twitter_follower_count: number | null;
    farcaster_username: string | null;
    farcaster_fid: number | null;
    farcaster_display_name: string | null;
    farcaster_follower_count: number | null;
    recommended_install_target: string | null;
    recommended_install_source: string | null;
    signing_eoa: string | null;
    signing_eoa_source: string | null;
    signing_eoa_balance_wei: string | null;
    website: string | null;
    description: string | null;
  };
  const rawRows = (data ?? []) as unknown as RawRow[];

  const enriched: TargetRow[] = rawRows.map((r, i) => {
    const hasName = !!(r.basename || r.ens_name);
    const hasFarcaster = !!r.farcaster_fid;
    const hasTwitter = !!r.twitter_username;
    const channels: string[] = [];
    if (hasFarcaster) channels.push("farcaster");
    if (hasTwitter) channels.push("twitter");
    if (r.payout_recipient || r.primary_wallet) channels.push("on-chain-to-eoa");
    if (r.smart_wallet_address) channels.push("csw-delegation-target");
    const totalSocialReach =
      (r.twitter_follower_count ?? 0) + (r.farcaster_follower_count ?? 0);
    const signerBalanceWei = r.signing_eoa_balance_wei
      ? BigInt(r.signing_eoa_balance_wei)
      : null;
    const signerEth =
      signerBalanceWei === null
        ? null
        : Number(signerBalanceWei) / 1e18;
    const hasTarget = !!r.recommended_install_target;
    const hasSigner = !!r.signing_eoa;
    const hasGas = signerBalanceWei !== null && signerBalanceWei > 0n;
    return {
      rank: i + 1,
      handle: r.handle,
      display_name: r.zora_display_name,
      coin_ticker: r.zora_creator_coin_symbol,
      market_cap_usd: r.zora_creator_coin_market_cap,
      total_volume_usd: r.zora_creator_coin_total_volume,
      volume_24h_usd: r.volume_24h_usd,
      unique_holders: r.unique_holders,
      smart_wallet: r.smart_wallet_address,
      payout_recipient: r.payout_recipient,
      primary_wallet: r.primary_wallet,
      privy_wallet: r.privy_wallet_address,
      external_wallets_count: Array.isArray(r.external_wallets) ? r.external_wallets.length : 0,
      install_target: r.recommended_install_target,
      install_target_source: r.recommended_install_source,
      signing_eoa: r.signing_eoa,
      signing_eoa_source: r.signing_eoa_source,
      signing_eoa_eth: signerEth !== null ? Number(signerEth.toFixed(4)) : null,
      ready_to_install: hasTarget && hasSigner && hasGas,
      needs_gas_sponsorship: hasTarget && hasSigner && !hasGas,
      basename: r.basename,
      ens_name: r.ens_name,
      avatar_url: r.avatar_image_url ?? r.basename_avatar ?? r.ens_avatar ?? null,
      twitter_username: r.twitter_username,
      twitter_follower_count: r.twitter_follower_count,
      farcaster_username: r.farcaster_username,
      farcaster_fid: r.farcaster_fid,
      farcaster_display_name: r.farcaster_display_name,
      farcaster_follower_count: r.farcaster_follower_count,
      description: r.description,
      website: r.website,
      has_name: hasName,
      has_farcaster: hasFarcaster,
      has_twitter: hasTwitter,
      total_social_reach: totalSocialReach,
      outreach_channels: channels.join(","),
    };
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const stem = `outreach-top-creators-${enriched.length}-${ts}`;
  const jsonPath = join(OUTPUT_DIR, `${stem}.json`);
  const csvPath = join(OUTPUT_DIR, `${stem}.csv`);
  writeFileSync(jsonPath, JSON.stringify(enriched, null, 2));
  writeFileSync(csvPath, toCsv(enriched));

  console.log(`\n[export-top] wrote ${enriched.length} rows:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);

  // Segment breakdown
  const total = enriched.length;
  const withSmart = enriched.filter((r) => r.smart_wallet).length;
  const withName = enriched.filter((r) => r.has_name).length;
  const withFc = enriched.filter((r) => r.has_farcaster).length;
  const withTw = enriched.filter((r) => r.has_twitter).length;
  const withTarget = enriched.filter((r) => r.install_target).length;
  const withSigner = enriched.filter((r) => r.signing_eoa).length;
  const ready = enriched.filter((r) => r.ready_to_install).length;
  const needsGas = enriched.filter((r) => r.needs_gas_sponsorship).length;
  console.log(`\n=== segment breakdown ===`);
  console.log(`  total profiles:               ${total}`);
  console.log(`  identity coverage`);
  console.log(`    with Basename or ENS:       ${withName}  (${((withName / total) * 100).toFixed(1)}%)`);
  console.log(`    with Farcaster:             ${withFc}  (${((withFc / total) * 100).toFixed(1)}%)`);
  console.log(`    with Twitter:               ${withTw}  (${((withTw / total) * 100).toFixed(1)}%)`);
  console.log(`  install actionability`);
  console.log(`    with install target (CBSW): ${withTarget}  (${((withTarget / total) * 100).toFixed(1)}%)`);
  console.log(`    with confirmed signer EOA:  ${withSigner}  (${((withSigner / total) * 100).toFixed(1)}%)`);
  console.log(`    READY TO INSTALL (has gas): ${ready}  (${((ready / total) * 100).toFixed(1)}%)`);
  console.log(`    needs gas sponsorship:      ${needsGas}  (${((needsGas / total) * 100).toFixed(1)}%)`);
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: TargetRow[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]) as (keyof TargetRow)[];
  const header = columns.map((c) => escapeCsv(c)).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => escapeCsv(row[col])).join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

main().catch((err) => {
  console.error("[export-top] fatal:", err);
  process.exit(1);
});
