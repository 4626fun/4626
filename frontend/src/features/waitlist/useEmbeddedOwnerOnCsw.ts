import { useCallback, useEffect, useState } from 'react'
import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import type { CanonicalOwnerCheckStatus } from '@/lib/uniswap/canonicalSignerGate'
import { readIsOwnerAddressIfDeployed } from '@/lib/wallet/cswOwnerRead'

export type EmbeddedOwnerOnCswStatus = 'idle' | 'checking' | 'owner' | 'not-owner' | 'unknown'

export function mapEmbeddedOwnerStatusToCanonicalCheckStatus(
  status: EmbeddedOwnerOnCswStatus,
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

function createBaseCswReadClient() {
  const rpcUrl =
    (typeof import.meta !== 'undefined' &&
      (import.meta.env.VITE_BASE_RPC_URL as string | undefined)?.trim()) ||
    'https://mainnet.base.org'
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  })
}

async function resolveEmbeddedOwnerStatus(
  cswAddress: Address,
  embeddedEoa: Address,
): Promise<Exclude<EmbeddedOwnerOnCswStatus, 'idle' | 'checking'>> {
  const isOwner = await readIsOwnerAddressIfDeployed({
    publicClient: createBaseCswReadClient(),
    cswAddress,
    ownerAddress: embeddedEoa,
  })
  if (isOwner === true) return 'owner'
  if (isOwner === false) return 'not-owner'
  return 'unknown'
}

export function useEmbeddedOwnerOnCsw(params: {
  cswAddress?: string | null | undefined
  embeddedEoaAddress: string | null | undefined
  enabled?: boolean
}) {
  const enabled = params.enabled !== false
  const cswAddress = normalizeAddress(params.cswAddress)
  const embeddedEoa = normalizeAddress(params.embeddedEoaAddress)
  const canCheck = enabled && Boolean(cswAddress && embeddedEoa)

  const [status, setStatus] = useState<EmbeddedOwnerOnCswStatus>('idle')

  const refresh = useCallback(async () => {
    if (!cswAddress || !embeddedEoa) return
    setStatus('checking')
    try {
      setStatus(await resolveEmbeddedOwnerStatus(cswAddress, embeddedEoa))
    } catch {
      setStatus('unknown')
    }
  }, [cswAddress, embeddedEoa])

  useEffect(() => {
    if (!canCheck || !cswAddress || !embeddedEoa) return

    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setStatus('checking')
      try {
        const next = await resolveEmbeddedOwnerStatus(cswAddress, embeddedEoa)
        if (!cancelled) setStatus(next)
      } catch {
        if (!cancelled) setStatus('unknown')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canCheck, cswAddress, embeddedEoa])

  const resolvedStatus: EmbeddedOwnerOnCswStatus = canCheck ? status : 'idle'

  return {
    status: resolvedStatus,
    refresh,
    isOwner: resolvedStatus === 'owner',
    needsInstall: resolvedStatus === 'not-owner' || resolvedStatus === 'unknown',
  }
}
