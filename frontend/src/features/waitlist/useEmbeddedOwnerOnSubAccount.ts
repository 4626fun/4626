import { useCallback, useEffect, useState } from 'react'
import { getAddress, isAddress, type Address } from 'viem'

import type { CanonicalOwnerCheckStatus } from '@/lib/uniswap/canonicalSignerGate'
import { readEmbeddedOwnerOnSubAccount } from '@/lib/wallet/subAccountOwnerInstall'

export type EmbeddedOwnerOnSubAccountStatus = 'idle' | 'checking' | 'owner' | 'not-owner' | 'unknown'

export function mapEmbeddedOwnerStatusToCanonicalCheckStatus(
  status: EmbeddedOwnerOnSubAccountStatus,
): CanonicalOwnerCheckStatus {
  if (status === 'checking' || status === 'idle') return 'pending'
  if (status === 'owner') return 'owner'
  if (status === 'not-owner') return 'not-owner'
  return 'unknown'
}

function normalizeAddress(value: string | null | undefined): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed)
}

async function resolveEmbeddedOwnerStatus(
  subAccount: Address,
  embeddedEoa: Address,
): Promise<Exclude<EmbeddedOwnerOnSubAccountStatus, 'idle' | 'checking'>> {
  const isOwner = await readEmbeddedOwnerOnSubAccount({
    subAccountAddress: subAccount,
    embeddedEoaAddress: embeddedEoa,
  })
  if (isOwner === true) return 'owner'
  if (isOwner === false) return 'not-owner'
  return 'unknown'
}

export function useEmbeddedOwnerOnSubAccount(params: {
  /** App-wallet or parent CSW address to probe. */
  cswAddress?: string | null | undefined
  /** @deprecated Prefer `cswAddress`. Kept for call-site clarity on sub-account probes. */
  subAccountAddress?: string | null | undefined
  embeddedEoaAddress: string | null | undefined
  enabled?: boolean
}) {
  const enabled = params.enabled !== false
  const subAccount = normalizeAddress(params.cswAddress ?? params.subAccountAddress)
  const embeddedEoa = normalizeAddress(params.embeddedEoaAddress)
  const canCheck = enabled && Boolean(subAccount && embeddedEoa)

  const [status, setStatus] = useState<EmbeddedOwnerOnSubAccountStatus>('idle')

  const refresh = useCallback(async () => {
    if (!subAccount || !embeddedEoa) return
    setStatus('checking')
    try {
      setStatus(await resolveEmbeddedOwnerStatus(subAccount, embeddedEoa))
    } catch {
      setStatus('unknown')
    }
  }, [embeddedEoa, subAccount])

  useEffect(() => {
    if (!canCheck || !subAccount || !embeddedEoa) return

    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setStatus('checking')
      try {
        const next = await resolveEmbeddedOwnerStatus(subAccount, embeddedEoa)
        if (!cancelled) setStatus(next)
      } catch {
        if (!cancelled) setStatus('unknown')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canCheck, embeddedEoa, subAccount])

  const resolvedStatus: EmbeddedOwnerOnSubAccountStatus = canCheck ? status : 'idle'

  return {
    status: resolvedStatus,
    refresh,
    isOwner: resolvedStatus === 'owner',
    needsInstall: resolvedStatus === 'not-owner' || resolvedStatus === 'unknown',
  }
}
