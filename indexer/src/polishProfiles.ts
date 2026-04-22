import "dotenv/config";

import { type Address } from "viem";

import { createBasePublicClient } from "./baseClient.js";
import { createIndexerSupabase } from "./supabase.js";

/**
 * Polish pass on zora_profiles after initial scan + enrichment:
 *
 *   1. Pull website / description / extra socials out of raw_profile
 *      (items we didn't extract in the first pass).
 *
 *   2. Re-run Farcaster lookup for unmatched profiles with an EXPANDED
 *      candidate address list that also includes smart_wallet_address
 *      and privy_wallet_address. Some users verify their CSW or Privy
 *      EOA on Farcaster instead of their payout EOA.
 *
 *   3. Check whether payout_recipient is an EOA or a contract (Safe,
 *      splitter, etc.). Contracts need a different install flow.
 *
 *   4. Check payout_recipient's Base ETH balance — helps flag users
 *      who'd need gas sponsorship before signing addOwnerAddress.
 */

const CONCURRENCY = Number(process.env.POLISH_CONCURRENCY ?? "8");
const TARGET_COUNT = Number(process.env.POLISH_TARGET_COUNT ?? "5000");
const FARCASTER_INTERVAL_MS = Number(process.env.FARCASTER_INTERVAL_MS ?? "10500");
const FARCASTER_BATCH_SIZE = 100;
const NEYNAR_API_KEY = (process.env.NEYNAR_API_KEY ?? "").trim();

type RawProfile = {
  creatorProfile?: {
    bio?: string | null;
    description?: string | null;
    website?: string | null;
    linkUrl?: string | null;
    externalLink?: string | null;
    socialAccounts?: {
      farcaster?: {
        id?: string | null;
        username?: string | null;
        displayName?: string | null;
        followerCount?: number | null;
      } | null;
    } | null;
  } | null;
  description?: string | null;
  links?: Array<{ url?: string | null; type?: string | null }> | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function lowerOrNull(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  return t || null;
}

async function polishStaticFields(): Promise<{ handleToWallets: Map<string, string[]> }> {
  const supabase = createIndexerSupabase();
  const chain = createBasePublicClient();
  const handleToWallets = new Map<string, string[]>();

  console.log("\n=== POLISH: extract static fields + payout_recipient EOA/contract check ===");
  const { data, error } = await supabase
    .from("zora_profiles")
    .select(
      "handle, payout_recipient, smart_wallet_address, privy_wallet_address, primary_wallet, external_wallets, raw_profile, farcaster_fid",
    )
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(TARGET_COUNT);
  if (error) throw error;

  type Row = {
    handle: string;
    payout_recipient: string | null;
    smart_wallet_address: string | null;
    privy_wallet_address: string | null;
    primary_wallet: string | null;
    external_wallets: string[] | null;
    raw_profile: RawProfile | null;
    farcaster_fid: number | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  console.log(`[polish] ${rows.length} profiles to polish`);

  let completed = 0;
  let contractPayouts = 0;
  let inflight = new Set<Promise<void>>();

  for (const row of rows) {
    // Track the expanded wallet candidate list per handle for the
    // Farcaster re-run below.
    const candidates = new Set<string>();
    for (const a of [
      row.payout_recipient,
      row.smart_wallet_address,
      row.privy_wallet_address,
      row.primary_wallet,
      ...(row.external_wallets ?? []),
    ]) {
      const v = lowerOrNull(a);
      if (v) candidates.add(v);
    }
    handleToWallets.set(row.handle, [...candidates]);

    const task = (async () => {
      // Extract static fields from raw_profile.
      const rp = row.raw_profile ?? {};
      const cp = rp.creatorProfile ?? {};
      const description = firstNonEmpty(cp.bio, cp.description, rp.description);
      const website = firstNonEmpty(
        cp.website,
        cp.linkUrl,
        cp.externalLink,
        ...(rp.links ?? [])
          .map((l) => l?.url ?? null)
          .filter((u) => typeof u === "string"),
      );

      // EOA/contract + balance check on payout_recipient.
      let isContract: boolean | null = null;
      let balanceWei: string | null = null;
      if (row.payout_recipient && row.payout_recipient.startsWith("0x")) {
        try {
          const [code, balance] = await Promise.all([
            chain.getCode({ address: row.payout_recipient as Address }),
            chain.getBalance({ address: row.payout_recipient as Address }),
          ]);
          isContract = !!code && code !== "0x";
          if (isContract) contractPayouts += 1;
          balanceWei = balance.toString();
        } catch {
          // Leave as null — non-fatal.
        }
      }

      const { error: upErr } = await supabase
        .from("zora_profiles")
        .update({
          description,
          website,
          payout_recipient_is_contract: isContract,
          payout_recipient_balance_wei: balanceWei,
          polish_synced_at: new Date().toISOString(),
        })
        .eq("handle", row.handle);
      if (upErr) console.warn(`[polish] update failed for ${row.handle}: ${upErr.message}`);
      completed += 1;
      if (completed % 20 === 0 || completed === rows.length) {
        console.log(
          `[polish] ${completed}/${rows.length}  contract_payouts=${contractPayouts}`,
        );
      }
    })();
    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  }
  await Promise.all(inflight);
  console.log(`[polish] static fields done: ${contractPayouts} contract-typed payout recipients found`);
  return { handleToWallets };
}

type NeynarBulkResponse = Record<
  string,
  Array<{ fid: number; username?: string; display_name?: string }>
>;

async function fetchFarcasterBatch(addresses: string[]): Promise<NeynarBulkResponse> {
  const url = new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address");
  url.searchParams.set("addresses", addresses.join(","));
  url.searchParams.set("address_types", "verified_address,custody_address");
  const res = await fetch(url, {
    headers: { accept: "application/json", "x-api-key": NEYNAR_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`Neynar ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  }
  return (await res.json()) as NeynarBulkResponse;
}

async function expandedFarcasterLookup(handleToWallets: Map<string, string[]>): Promise<void> {
  if (!NEYNAR_API_KEY) {
    console.warn("[polish-fc] NEYNAR_API_KEY missing; skipping expanded Farcaster pass");
    return;
  }
  const supabase = createIndexerSupabase();

  console.log("\n=== POLISH: expanded Farcaster lookup for still-unmatched profiles ===");
  // Only re-check profiles we don't already have a Farcaster match for.
  const { data: rows, error } = await supabase
    .from("zora_profiles")
    .select("handle, farcaster_fid")
    .is("farcaster_fid", null)
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(TARGET_COUNT);
  if (error) throw error;
  const unmatched = (rows ?? []) as Array<{ handle: string; farcaster_fid: number | null }>;
  console.log(`[polish-fc] ${unmatched.length} unmatched profiles to re-check with expanded addrs`);
  if (unmatched.length === 0) return;

  // Build the address->handle set using the expanded candidate list
  // (which already includes smart_wallet + privy_wallet).
  const addrToHandles = new Map<string, Set<string>>();
  const allAddrs: string[] = [];
  for (const row of unmatched) {
    const addrs = handleToWallets.get(row.handle) ?? [];
    for (const a of addrs) {
      if (!addrToHandles.has(a)) {
        addrToHandles.set(a, new Set());
        allAddrs.push(a);
      }
      addrToHandles.get(a)!.add(row.handle);
    }
  }
  console.log(`[polish-fc] ${allAddrs.length} unique addresses to check (includes csw + privy)`);
  if (allAddrs.length === 0) return;

  const handleToMatch = new Map<
    string,
    { fid: number; username: string | null; display_name: string | null }
  >();
  for (let i = 0; i < allAddrs.length; i += FARCASTER_BATCH_SIZE) {
    const batch = allAddrs.slice(i, i + FARCASTER_BATCH_SIZE);
    try {
      const result = await fetchFarcasterBatch(batch);
      for (const addr of batch) {
        const hits = result[addr.toLowerCase()] ?? [];
        if (hits.length === 0) continue;
        const hit = hits[0];
        const handles = addrToHandles.get(addr) ?? new Set();
        for (const h of handles) {
          if (!handleToMatch.has(h)) {
            handleToMatch.set(h, {
              fid: hit.fid,
              username: hit.username ?? null,
              display_name: hit.display_name ?? null,
            });
          }
        }
      }
      console.log(
        `[polish-fc] batch ${i / FARCASTER_BATCH_SIZE + 1}: ${batch.length} addrs → ${handleToMatch.size} additional matches so far`,
      );
    } catch (err) {
      console.warn(`[polish-fc] batch ${i} failed:`, err instanceof Error ? err.message : err);
    }
    if (FARCASTER_INTERVAL_MS > 0 && i + FARCASTER_BATCH_SIZE < allAddrs.length) {
      await new Promise((r) => setTimeout(r, FARCASTER_INTERVAL_MS));
    }
  }

  // Persist. Only UPDATE rows that got a new match — don't overwrite
  // existing synced_at for profiles that stayed unmatched.
  const now = new Date().toISOString();
  let added = 0;
  for (const [handle, m] of handleToMatch.entries()) {
    const { error: upErr } = await supabase
      .from("zora_profiles")
      .update({
        farcaster_fid: m.fid,
        farcaster_username: m.username,
        farcaster_display_name: m.display_name,
        farcaster_synced_at: now,
      })
      .eq("handle", handle);
    if (upErr) {
      console.warn(`[polish-fc] update failed for ${handle}: ${upErr.message}`);
      continue;
    }
    added += 1;
  }
  console.log(`[polish-fc] ${added} additional Farcaster matches added`);
}

async function main() {
  const startedAt = Date.now();
  const { handleToWallets } = await polishStaticFields();
  await expandedFarcasterLookup(handleToWallets);
  console.log(`\n[polish] total elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("[polish] fatal:", err);
  process.exit(1);
});
