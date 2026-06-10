import { useEffect, useRef } from 'react'
import { getAddress, isAddress, type Address } from 'viem'

import { findCoinbaseSmartWalletOwnerIndex } from '@/lib/aa/coinbaseErc4337Owners'

type PublicClientLike = {
  chain?: { id: number }
  getBalance?: (args: { address: Address }) => Promise<bigint>
} & Record<string, unknown>

export type CanonicalSwapWarmupInput = {
  enabled: boolean
  executionMode: 'canonical' | 'eoa'
  executionReady: boolean
  canonicalAddress: string | null | undefined
  signerAddress: string | null | undefined
  publicClient: PublicClientLike | null | undefined
}

/**
 * Prefetch CSW owner index, native balance, and warm the paymaster proxy while the user
 * is on /swap so ERC-4337 submit avoids cold RPC/cache misses.
 */
export function useCanonicalSwapWarmup(input: CanonicalSwapWarmupInput): void {
  const lastKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!input.enabled) return
    if (input.executionMode !== 'canonical') return
    if (!input.executionReady) return
    if (!input.publicClient || !input.canonicalAddress || !input.signerAddress) return
    if (!isAddress(input.canonicalAddress) || !isAddress(input.signerAddress)) return

    const csw = getAddress(input.canonicalAddress)
    const signer = getAddress(input.signerAddress)
    const chainId = Number((input.publicClient as { chain?: { id: number } }).chain?.id ?? 8453)
    const warmupKey = `${chainId}:${csw}:${signer}`
    if (lastKeyRef.current === warmupKey) return
    lastKeyRef.current = warmupKey

    let cancelled = false

    void (async () => {
      const tasks: Array<Promise<unknown>> = [
        findCoinbaseSmartWalletOwnerIndex({
          publicClient: input.publicClient as Parameters<typeof findCoinbaseSmartWalletOwnerIndex>[0]['publicClient'],
          smartWallet: csw,
          ownerAddress: signer,
          useCache: true,
        }),
      ]

      if (typeof input.publicClient?.getBalance === 'function') {
        tasks.push(input.publicClient.getBalance({ address: csw }))
      }

      await Promise.allSettled(tasks)
      if (cancelled) return
    })()

    return () => {
      cancelled = true
    }
  }, [
    input.enabled,
    input.executionMode,
    input.executionReady,
    input.canonicalAddress,
    input.signerAddress,
    input.publicClient,
  ])
}
