import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchFreshEthosScoresByUserkeys } from '../chat/ethosClient.js'

const OWNER_CLASS_TABLE = 'zora_csw_owner_class'
const UPDATE_CONCURRENCY = 8

type Address = `0x${string}`

export type OwnerEthosRefreshResult = {
  attempted: number
  updated: number
  failed: number
  skipped: number
}

function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): Address | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isAddress(normalized) ? normalized : null
}

export async function refreshZoraOwnerEthosScores(params: {
  db: SupabaseClient
  ownerAddresses: readonly string[]
  maxAddresses?: number
}): Promise<OwnerEthosRefreshResult> {
  const maxAddresses = Math.max(0, Math.floor(params.maxAddresses ?? params.ownerAddresses.length))
  const addresses = Array.from(
    new Set(
      params.ownerAddresses
        .map((address) => normalizeAddress(address))
        .filter((address): address is Address => Boolean(address)),
    ),
  ).slice(0, maxAddresses)

  if (addresses.length === 0) {
    return { attempted: 0, updated: 0, failed: 0, skipped: 0 }
  }

  const userkeys = addresses.map((address) => `address:${address}`)
  const scores = await fetchFreshEthosScoresByUserkeys(userkeys)
  const refreshedAt = new Date().toISOString()
  let nextIndex = 0
  let updated = 0
  let failed = 0

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex
      nextIndex += 1
      if (i >= addresses.length) return

      const eoa = addresses[i]!
      const userkey = `address:${eoa}`
      const score = scores.get(userkey) ?? null
      const { count, error } = await params.db
        .from(OWNER_CLASS_TABLE)
        .update(
          {
            ethos_userkey: userkey,
            ethos_score: score?.score ?? null,
            ethos_level: score?.level ?? null,
            ethos_score_updated_at: refreshedAt,
            last_updated_at: refreshedAt,
          },
          { count: 'exact' },
        )
        .eq('eoa', eoa)

      if (error) {
        failed += 1
        continue
      }
      updated += typeof count === 'number' ? count : 0
    }
  }

  const workerCount = Math.min(UPDATE_CONCURRENCY, addresses.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return {
    attempted: addresses.length,
    updated,
    failed,
    skipped: Math.max(0, addresses.length - updated - failed),
  }
}
