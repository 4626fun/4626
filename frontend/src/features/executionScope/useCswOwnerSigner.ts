import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { isAddress } from 'viem'
import { base } from 'viem/chains'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePublicClient } from 'wagmi'

import { useCanonicalIdentity } from '@/hooks/useCanonicalIdentity'

import {
  checkCswOwners,
  pickOwnerSigner,
  type CswOwnerCandidate,
  type CswOwnerResult,
} from './cswOwnerCheck'

/**
 * Resolves which of the user's currently-available signers (Privy
 * embedded EOA and connected external EOA) is a current owner of their
 * parent CSW. Used by both the auto-provision hook (to decide whether
 * to fire) and the `ExecutionScopeCard` `not_provisioned` state (to
 * show "will be signed with [wallet]" copy instead of surprising the
 * user with a random modal).
 *
 * Lazily runs `CoinbaseSmartWallet.isOwnerAddress` for each candidate
 * once per (csw, candidate) tuple. Cached in-memory for the session.
 */

type OwnerCheckState = {
  loading: boolean
  /** Raw per-candidate results in the order requested. */
  results: CswOwnerResult[]
  /** Preferred signer to use for fresh SpendPermission signatures. */
  preferredSigner: CswOwnerResult | null
}

const cache = new Map<string, CswOwnerResult[]>()
const pending = new Map<string, Promise<CswOwnerResult[]>>()

function cacheKeyFor(csw: Address, candidates: CswOwnerCandidate[]): string {
  const parts = candidates.map((c) => `${c.label}:${c.address.toLowerCase()}`).sort()
  return `${csw.toLowerCase()}|${parts.join(',')}`
}

export function useCswOwnerSigner(): OwnerCheckState {
  const identity = useCanonicalIdentity()
  const publicClient = usePublicClient({ chainId: base.id })
  const { client: smartWalletClient } = useSmartWallets()
  const [state, setState] = useState<OwnerCheckState>({
    loading: false,
    results: [],
    preferredSigner: null,
  })

  const csw = identity.cswAddress
  const embedded = identity.privyEmbeddedAddress
  const external = identity.externalEoaAddress
  const smartWalletAddr = ((): Address | null => {
    const addr = (smartWalletClient as { account?: { address?: string } } | null | undefined)
      ?.account?.address
    if (!addr || typeof addr !== 'string' || !isAddress(addr)) return null
    return addr as Address
  })()

  useEffect(() => {
    if (!csw || !publicClient) {
      setState({ loading: false, results: [], preferredSigner: null })
      return
    }

    const candidates: CswOwnerCandidate[] = []
    // Priority matters for `pickOwnerSigner`: smart wallet > external > embedded.
    if (smartWalletAddr) candidates.push({ label: 'smart_wallet', address: smartWalletAddr })
    if (external) candidates.push({ label: 'external', address: external })
    if (embedded) candidates.push({ label: 'embedded', address: embedded })
    if (candidates.length === 0) {
      setState({ loading: false, results: [], preferredSigner: null })
      return
    }

    const key = cacheKeyFor(csw, candidates)
    const cached = cache.get(key)
    if (cached) {
      setState({ loading: false, results: cached, preferredSigner: pickOwnerSigner(cached) })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))

    const existing = pending.get(key)
    const promise =
      existing ??
      checkCswOwners({ publicClient, csw, candidates }).then((results) => {
        cache.set(key, results)
        pending.delete(key)
        return results
      })
    if (!existing) pending.set(key, promise)

    promise.then((results) => {
      if (cancelled) return
      setState({
        loading: false,
        results,
        preferredSigner: pickOwnerSigner(results),
      })
    })

    return () => {
      cancelled = true
    }
  }, [csw, embedded, external, smartWalletAddr, publicClient])

  return state
}
