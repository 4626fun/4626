// SPDX-License-Identifier: MIT
//
// Bounded linkedWallet enrichment for zora_profiles (getProfile pass).

import {
  readProfileRefreshWalletBudget,
  readProfileRefreshWalletConcurrency,
  ZORA_PROFILES_TABLE,
} from './cronConfig.js'

export type ProfileWalletEnrichResult = {
  selected: number
  updated: number
  withSmartWallet: number
  failed: number
}

type LinkedWallet = {
  walletType?: string
  walletAddress?: string
}

type ZoraProfile = {
  publicWallet?: { walletAddress?: string } | null
  linkedWallets?: { edges?: Array<{ node?: LinkedWallet }> } | null
}

type SupabaseProfileClient = {
  from: (table: string) => {
    select: (cols: string) => {
      is: (col: string, val: null) => {
        order: (col: string, opts: { ascending: boolean; nullsFirst: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
        }
      }
    }
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

function lowerOrNull(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null
  const t = s.trim().toLowerCase()
  return t || null
}

function extractFromLinkedWallets(profile: ZoraProfile): {
  smart_wallet_address: string | null
  privy_wallet_address: string | null
  external_wallets: string[]
} {
  const externals: string[] = []
  let smart: string | null = null
  let privy: string | null = null
  const edges = profile.linkedWallets?.edges ?? []
  for (const edge of edges) {
    const n = edge.node
    if (!n?.walletAddress) continue
    const addr = lowerOrNull(n.walletAddress)
    if (!addr) continue
    const type = (n.walletType ?? '').toUpperCase()
    if (type === 'SMART_WALLET' && !smart) smart = addr
    else if (type === 'PRIVY' && !privy) privy = addr
    else if (type === 'EXTERNAL') externals.push(addr)
  }
  return {
    smart_wallet_address: smart,
    privy_wallet_address: privy,
    external_wallets: [...new Set(externals)],
  }
}

export async function enrichProfileWallets(
  db: SupabaseProfileClient,
  apiKey: string,
): Promise<ProfileWalletEnrichResult> {
  const budget = readProfileRefreshWalletBudget()
  const concurrency = readProfileRefreshWalletConcurrency()

  const { data, error } = await db
    .from(ZORA_PROFILES_TABLE)
    .select('handle, primary_wallet')
    .is('wallets_synced_at', null)
    .order('zora_creator_coin_market_cap', { ascending: false, nullsFirst: false })
    .limit(budget)
  if (error) throw new Error(`profile_wallet_select_failed:${error.message}`)

  const targets = (data ?? []) as Array<{ handle: string; primary_wallet: string | null }>
  if (targets.length === 0) {
    return { selected: 0, updated: 0, withSmartWallet: 0, failed: 0 }
  }

  const sdk: any = await import('@zoralabs/coins-sdk')
  sdk.setApiKey(apiKey)

  let updated = 0
  let withSmartWallet = 0
  let failed = 0
  let completed = 0
  const inflight = new Set<Promise<void>>()
  const refreshedAt = new Date().toISOString()

  for (const target of targets) {
    const task = (async () => {
      try {
        const response = await sdk.getProfile({ identifier: target.handle })
        const profile: ZoraProfile = response?.data?.profile ?? null
        if (!profile) {
          failed += 1
          return
        }
        const wallets = extractFromLinkedWallets(profile)
        const primaryWallet =
          lowerOrNull(profile.publicWallet?.walletAddress) ?? target.primary_wallet ?? null
        const { error: updateError } = await db
          .from(ZORA_PROFILES_TABLE)
          .update({
            smart_wallet_address: wallets.smart_wallet_address,
            privy_wallet_address: wallets.privy_wallet_address,
            external_wallets: wallets.external_wallets,
            primary_wallet: primaryWallet,
            wallets_synced_at: refreshedAt,
            last_refreshed_at: refreshedAt,
          })
          .eq('handle', target.handle)
        if (updateError) {
          failed += 1
          return
        }
        updated += 1
        if (wallets.smart_wallet_address) withSmartWallet += 1
      } catch {
        failed += 1
      } finally {
        completed += 1
      }
    })()
    inflight.add(task)
    task.finally(() => inflight.delete(task))
    if (inflight.size >= concurrency) {
      await Promise.race(inflight)
    }
  }
  await Promise.all(inflight)

  return {
    selected: targets.length,
    updated,
    withSmartWallet,
    failed,
  }
}
