import "dotenv/config";

import { createPublicClient, fallback, http, toCoinType, type Address } from "viem";
import { base, mainnet } from "viem/chains";
import { normalize } from "viem/ens";

import { createIndexerSupabase } from "./supabase.js";

/**
 * Three-pass enrichment for zora_profiles:
 *
 *   1. wallets    — call getProfile(handle) to extract the linkedWallets
 *                    array and populate smart_wallet_address,
 *                    privy_wallet_address, external_wallets[],
 *                    primary_wallet, payout_recipient.
 *
 *   2. names      — resolve Basename (*.base.eth) and ENS (*.eth) for
 *                    each profile's primary_wallet (falling back to
 *                    payout_recipient). Uses ENS CCIP gateway.
 *
 *   3. farcaster  — batch-lookup up to 100 addresses at a time against
 *                    Neynar's verified-address endpoint to populate
 *                    farcaster_fid / username / display_name.
 *
 * All three passes are idempotent: re-running skips rows that already
 * have the corresponding *_synced_at timestamp set. Each pass updates
 * only its own columns, so running them independently or concurrently
 * is safe.
 *
 * Env toggles (all default "1", set to "0" to skip a pass):
 *   ENRICH_PASS_WALLETS=1
 *   ENRICH_PASS_NAMES=1
 *   ENRICH_PASS_FARCASTER=1
 *   PROFILES_TARGET_COUNT=1000       # max rows per pass
 *   PROFILES_CONCURRENCY=6           # parallel lookups
 *   FARCASTER_INTERVAL_MS=10500      # Neynar free-tier pacing
 */

const ZORA_API_KEY = (process.env.ZORA_SERVER_API_KEY ?? "").trim();
const NEYNAR_API_KEY = (process.env.NEYNAR_API_KEY ?? "").trim();

const PASS_WALLETS = process.env.ENRICH_PASS_WALLETS !== "0";
const PASS_NAMES = process.env.ENRICH_PASS_NAMES !== "0";
const PASS_FARCASTER = process.env.ENRICH_PASS_FARCASTER !== "0";
const TARGET_COUNT = Number(process.env.PROFILES_TARGET_COUNT ?? "1000");
const CONCURRENCY = Number(process.env.PROFILES_CONCURRENCY ?? "6");
const FARCASTER_BATCH_SIZE = 100;
const FARCASTER_INTERVAL_MS = Number(process.env.FARCASTER_INTERVAL_MS ?? "10500");

const ENS_GATEWAY_URLS = ["https://ccip.ens.xyz"];

// ─── Supabase + chain clients ─────────────────────────────────────────
const supabase = createIndexerSupabase();

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
    transport: fallback(
      urls.map((u) => http(u, { retryCount: 2, retryDelay: 300 })),
    ),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────
function lowerOrNull(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  return t || null;
}

function uniqueLower(addrs: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const a of addrs) {
    const v = lowerOrNull(a);
    if (v) set.add(v);
  }
  return [...set];
}

// ─── Pass 1: extract linkedWallets via getProfile ────────────────────
type LinkedWallet = {
  walletType?: string;
  walletAddress?: string;
};

type ZoraProfile = {
  id?: string;
  handle?: string;
  username?: string;
  displayName?: string;
  publicWallet?: { walletAddress?: string } | null;
  creatorCoin?: { address?: string | null } | null;
  linkedWallets?: { edges?: Array<{ node?: LinkedWallet }> } | null;
};

function extractFromLinkedWallets(profile: ZoraProfile): {
  smart_wallet_address: string | null;
  privy_wallet_address: string | null;
  external_wallets: string[];
} {
  const externals: string[] = [];
  let smart: string | null = null;
  let privy: string | null = null;
  const edges = profile.linkedWallets?.edges ?? [];
  for (const edge of edges) {
    const n = edge.node;
    if (!n?.walletAddress) continue;
    const addr = lowerOrNull(n.walletAddress);
    if (!addr) continue;
    const type = (n.walletType ?? "").toUpperCase();
    if (type === "SMART_WALLET" && !smart) smart = addr;
    else if (type === "PRIVY" && !privy) privy = addr;
    else if (type === "EXTERNAL") externals.push(addr);
  }
  return {
    smart_wallet_address: smart,
    privy_wallet_address: privy,
    external_wallets: [...new Set(externals)],
  };
}

async function passWallets(): Promise<void> {
  if (!ZORA_API_KEY) {
    console.warn("[wallets] ZORA_SERVER_API_KEY missing; skipping pass");
    return;
  }
  const sdk: any = await import("@zoralabs/coins-sdk");
  sdk.setApiKey(ZORA_API_KEY);

  const { data, error } = await supabase
    .from("zora_profiles")
    .select("handle, payout_recipient, primary_wallet")
    .is("wallets_synced_at", null)
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(TARGET_COUNT);
  if (error) throw error;
  const targets = (data ?? []) as Array<{ handle: string; payout_recipient: string | null; primary_wallet: string | null }>;
  console.log(`[wallets] ${targets.length} profiles to enrich with linkedWallets`);
  if (targets.length === 0) return;

  let completed = 0;
  let found = 0;
  const inflight = new Set<Promise<void>>();

  for (const t of targets) {
    const task = (async () => {
      try {
        const response = await sdk.getProfile({ identifier: t.handle });
        const profile: ZoraProfile = response?.data?.profile ?? null;
        if (!profile) return;
        const wallets = extractFromLinkedWallets(profile);
        const primaryWallet =
          lowerOrNull(profile.publicWallet?.walletAddress) ?? t.primary_wallet ?? null;
        const { error } = await supabase
          .from("zora_profiles")
          .update({
            smart_wallet_address: wallets.smart_wallet_address,
            privy_wallet_address: wallets.privy_wallet_address,
            external_wallets: wallets.external_wallets,
            primary_wallet: primaryWallet,
            wallets_synced_at: new Date().toISOString(),
            last_refreshed_at: new Date().toISOString(),
          })
          .eq("handle", t.handle);
        if (error) console.warn(`[wallets] update failed for ${t.handle}: ${error.message}`);
        else if (wallets.smart_wallet_address) found += 1;
      } catch (err) {
        console.warn(
          `[wallets] getProfile failed for ${t.handle}:`,
          err instanceof Error ? err.message : err,
        );
      } finally {
        completed += 1;
        if (completed % 20 === 0 || completed === targets.length) {
          console.log(`[wallets] ${completed}/${targets.length}  with_smart_wallet=${found}`);
        }
      }
    })();
    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  }
  await Promise.all(inflight);
  console.log(`[wallets] done: ${found}/${targets.length} had a SMART_WALLET linkedWallet`);
}

// ─── Pass 2: Basename + ENS for primary_wallet / payout_recipient ───
async function passNames(): Promise<void> {
  const client = createMainnetClient();
  const { data, error } = await supabase
    .from("zora_profiles")
    .select("handle, primary_wallet, payout_recipient, external_wallets")
    .is("names_synced_at", null)
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(TARGET_COUNT);
  if (error) throw error;
  const targets = (data ?? []) as Array<{
    handle: string;
    primary_wallet: string | null;
    payout_recipient: string | null;
    external_wallets: string[];
  }>;
  console.log(`[names] ${targets.length} profiles to resolve names for`);
  if (targets.length === 0) return;

  let completed = 0;
  let baseHits = 0;
  let ensHits = 0;
  const inflight = new Set<Promise<void>>();

  for (const t of targets) {
    const candidates = uniqueLower([t.primary_wallet, t.payout_recipient, ...(t.external_wallets ?? [])]);
    const task = (async () => {
      let basename: string | null = null;
      let basenameAvatar: string | null = null;
      let ensName: string | null = null;
      let ensAvatar: string | null = null;

      for (const addr of candidates) {
        // Basename — coinType-scoped mainnet reverse (ENSIP-19)
        if (!basename) {
          try {
            const n = await client.getEnsName({
              address: addr as Address,
              coinType: toCoinType(base.id),
              gatewayUrls: ENS_GATEWAY_URLS,
            });
            if (n && n.toLowerCase().endsWith(".base.eth")) {
              basename = n;
              try {
                basenameAvatar = await client.getEnsAvatar({
                  name: normalize(n),
                  gatewayUrls: ENS_GATEWAY_URLS,
                });
              } catch {}
            }
          } catch {}
        }
        // ENS — standard mainnet reverse, exclude .base.eth (captured above)
        if (!ensName) {
          try {
            const n = await client.getEnsName({ address: addr as Address });
            if (n && !n.toLowerCase().endsWith(".base.eth")) {
              ensName = n;
              try {
                ensAvatar = await client.getEnsAvatar({ name: normalize(n) });
              } catch {}
            }
          } catch {}
        }
        if (basename && ensName) break;
      }

      if (basename) baseHits += 1;
      if (ensName) ensHits += 1;

      const { error } = await supabase
        .from("zora_profiles")
        .update({
          basename,
          basename_avatar: basenameAvatar,
          ens_name: ensName,
          ens_avatar: ensAvatar,
          names_synced_at: new Date().toISOString(),
        })
        .eq("handle", t.handle);
      if (error) console.warn(`[names] update failed for ${t.handle}: ${error.message}`);
      completed += 1;
      if (completed % 20 === 0 || completed === targets.length) {
        console.log(`[names] ${completed}/${targets.length}  basename=${baseHits}  ens=${ensHits}`);
      }
    })();
    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  }
  await Promise.all(inflight);
  console.log(`[names] done: basename=${baseHits} ens=${ensHits}`);
}

// ─── Pass 3: Farcaster via Neynar bulk-by-address ────────────────────
type NeynarBulkByAddressResponse = Record<
  string,
  Array<{ fid: number; username?: string; display_name?: string }>
>;

async function fetchFarcasterBatch(addresses: string[]): Promise<NeynarBulkByAddressResponse> {
  const url = new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address");
  url.searchParams.set("addresses", addresses.join(","));
  url.searchParams.set("address_types", "verified_address");
  const res = await fetch(url, {
    headers: { accept: "application/json", "x-api-key": NEYNAR_API_KEY },
  });
  if (!res.ok) {
    throw new Error(
      `Neynar ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`,
    );
  }
  return (await res.json()) as NeynarBulkByAddressResponse;
}

async function passFarcaster(): Promise<void> {
  if (!NEYNAR_API_KEY) {
    console.warn("[farcaster] NEYNAR_API_KEY missing; skipping pass");
    return;
  }

  const { data, error } = await supabase
    .from("zora_profiles")
    .select("handle, primary_wallet, payout_recipient, external_wallets")
    .is("farcaster_synced_at", null)
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(TARGET_COUNT);
  if (error) throw error;
  const targets = (data ?? []) as Array<{
    handle: string;
    primary_wallet: string | null;
    payout_recipient: string | null;
    external_wallets: string[];
  }>;
  console.log(`[farcaster] ${targets.length} profiles to check on Farcaster`);
  if (targets.length === 0) return;

  // Build a map: address → profile handle (only use candidate addresses
  // most likely to be the user's personal EOA, not a Privy embedded).
  const addrToHandles = new Map<string, Set<string>>();
  const allAddrs: string[] = [];
  for (const t of targets) {
    const candidates = uniqueLower([
      t.primary_wallet,
      t.payout_recipient,
      ...(t.external_wallets ?? []),
    ]);
    for (const addr of candidates) {
      if (!addrToHandles.has(addr)) {
        addrToHandles.set(addr, new Set());
        allAddrs.push(addr);
      }
      addrToHandles.get(addr)!.add(t.handle);
    }
  }
  console.log(`[farcaster] ${allAddrs.length} unique addresses to check`);

  // Match results back to handles. Per handle: if ANY of its candidate
  // addresses has a Farcaster match, use that FID.
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
        for (const handle of handles) {
          if (!handleToMatch.has(handle)) {
            handleToMatch.set(handle, {
              fid: hit.fid,
              username: hit.username ?? null,
              display_name: hit.display_name ?? null,
            });
          }
        }
      }
      console.log(
        `[farcaster] batch ${i / FARCASTER_BATCH_SIZE + 1}: ${batch.length} addrs → ${handleToMatch.size} profile matches`,
      );
    } catch (err) {
      console.warn(
        `[farcaster] batch ${i} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
    if (FARCASTER_INTERVAL_MS > 0 && i + FARCASTER_BATCH_SIZE < allAddrs.length) {
      await new Promise((r) => setTimeout(r, FARCASTER_INTERVAL_MS));
    }
  }

  // Persist per-row using UPDATE (not upsert). Batch upsert would null
  // out the NOT-NULL `source` column on conflict-resolve because
  // supabase-js's upsert replaces every column not in the payload with
  // NULL. Per-row UPDATE only touches the fields we explicitly set.
  const now = new Date().toISOString();
  let persisted = 0;
  for (const t of targets) {
    const match = handleToMatch.get(t.handle);
    const { error } = await supabase
      .from("zora_profiles")
      .update({
        farcaster_fid: match?.fid ?? null,
        farcaster_username: match?.username ?? null,
        farcaster_display_name: match?.display_name ?? null,
        farcaster_synced_at: now,
      })
      .eq("handle", t.handle);
    if (error) {
      console.warn(`[farcaster] update failed for ${t.handle}: ${error.message}`);
      continue;
    }
    persisted += 1;
  }
  console.log(`[farcaster] persisted ${persisted}/${targets.length} rows`);
  console.log(`[farcaster] done: ${handleToMatch.size}/${targets.length} matched`);
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  if (PASS_WALLETS) {
    console.log("\n=== PASS 1: linkedWallets ===");
    await passWallets();
  }
  if (PASS_NAMES) {
    console.log("\n=== PASS 2: Basename + ENS ===");
    await passNames();
  }
  if (PASS_FARCASTER) {
    console.log("\n=== PASS 3: Farcaster ===");
    await passFarcaster();
  }
  console.log(`\n[enrich-profiles] total elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("[enrich-profiles] fatal:", err);
  process.exit(1);
});
