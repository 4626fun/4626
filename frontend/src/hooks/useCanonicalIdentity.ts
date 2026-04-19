import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { createPublicClient, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import { BASE_DEFAULTS } from '@/config/contracts.defaults'

/**
 * Consolidated identity snapshot for the signed-in user. Composes:
 *   - Privy user state (the human login)
 *   - wagmi connection (optional external EOA)
 *   - SIWE session (what the server treats as the canonical auth address)
 *   - On-chain read: CreatorRegistry.getTokenForVault(csw) → creator coin addr
 *
 * Design notes:
 *   - `cswAddress` is the authoritative onchain identity — what owns the
 *     creator's vault, coins, lottery entries, etc. We treat `authAddress`
 *     from the SIWE session as the canonical CSW (that's how the server
 *     resolves the user; see `wallet/walletSync.ts` → canonical resolver).
 *   - `externalEoaAddress` is populated only when wagmi reports a
 *     non-Privy external wallet as connected. Privy's embedded wallet
 *     shows up through the Privy SDK, not wagmi.
 *   - `creatorCoinAddress` is resolved lazily once per CSW via a single
 *     `getTokenForVault` read against the live `CreatorRegistry`. Cached
 *     in-memory for the session to avoid re-reading on every render.
 */

export type CanonicalIdentity = {
  /** The user's Coinbase Smart Wallet — primary identity. */
  cswAddress: Address | null
  /**
   * External EOA (Rabby / MetaMask / injected) if one is actively
   * connected via wagmi. Null when only the Privy embedded EOA is
   * signing.
   */
  externalEoaAddress: Address | null
  /** Privy-provisioned embedded EOA, if Privy is authed. */
  privyEmbeddedAddress: Address | null
  /**
   * Which signer is currently active. Priority:
   *   - 'external' when an external wagmi connection exists
   *   - 'embedded' when only Privy is signing
   *   - null when no session / wallet is active
   */
  activeSigner: 'external' | 'embedded' | null
  /**
   * Creator coin ERC-20 address owned by this CSW's vault, or null if
   * the CSW has no registered vault yet. Always normalized to checksum
   * form.
   */
  creatorCoinAddress: Address | null
  /** Loading state for async CSW → coin lookup. */
  loadingCoin: boolean
}

/**
 * In-memory cache for CSW → creator coin address lookups. Scoped to the
 * browser session; cleared on page reload. Avoids hammering the
 * `getTokenForVault` RPC for every render.
 */
const coinAddressCache = new Map<string, Address | null>()
const coinAddressPending = new Map<string, Promise<Address | null>>()

const CREATOR_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getVaultForToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getTokenForVault',
    stateMutability: 'view',
    inputs: [{ name: 'vault', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

/**
 * Build a lazy, browser-safe public client for Base mainnet. Prefers the
 * same-origin RPC proxy (respects Cloudflare caching + rate limits), with
 * a public fallback so SSR / test environments still work.
 */
function getBaseReadClient() {
  const isBrowser = typeof window !== 'undefined'
  return createPublicClient({
    chain: base,
    transport: http(isBrowser ? '/api/rpc?chain=base' : 'https://mainnet.base.org', {
      retryCount: 1,
      timeout: 10_000,
    }),
  })
}

async function fetchCreatorCoinForCsw(csw: Address): Promise<Address | null> {
  const key = csw.toLowerCase()
  if (coinAddressCache.has(key)) return coinAddressCache.get(key) ?? null
  const pending = coinAddressPending.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      const client = getBaseReadClient()
      const token = (await client.readContract({
        address: BASE_DEFAULTS.registry,
        abi: CREATOR_REGISTRY_ABI,
        functionName: 'getTokenForVault',
        args: [csw],
      })) as Address
      const normalized = isAddress(token) && token !== '0x0000000000000000000000000000000000000000'
        ? (token as Address)
        : null
      coinAddressCache.set(key, normalized)
      return normalized
    } catch (error) {
      // Non-fatal: the registry may not have a vault for this CSW.
      // Cache a null result briefly so we don't spam the RPC.
      coinAddressCache.set(key, null)
      return null
    } finally {
      coinAddressPending.delete(key)
    }
  })()

  coinAddressPending.set(key, promise)
  return promise
}

export function useCanonicalIdentity(): CanonicalIdentity {
  const { address: wagmiAddress, isConnected, connector } = useAccount()
  const auth = useSiweAuth()
  const privyEmbedded = useEnsurePrivyEmbeddedWallet()

  // wagmi's `address` could be Privy's embedded wallet OR an external
  // wallet. Distinguish by inspecting the connector id — Privy's
  // embedded connector id contains "privy".
  const externalEoa = (() => {
    if (!isConnected || !wagmiAddress) return null
    const connectorId = String(connector?.id ?? '').toLowerCase()
    if (connectorId.includes('privy')) return null
    if (!isAddress(wagmiAddress)) return null
    return wagmiAddress as Address
  })()

  const privyEmbeddedAddress: Address | null = (() => {
    const addr = privyEmbedded?.embeddedEoaAddress
    if (!addr) return null
    return isAddress(addr) ? (addr as Address) : null
  })()

  const csw = (() => {
    // SIWE session's authAddress is the canonical server-side identity.
    // For Privy flows, this is set to the CSW on sign-in (see
    // server/_lib/wallet/walletSync.ts → canonical resolver).
    const auth_addr = typeof auth.authAddress === 'string' ? auth.authAddress : null
    if (auth_addr && isAddress(auth_addr)) return auth_addr as Address
    return null
  })()

  const activeSigner: CanonicalIdentity['activeSigner'] = (() => {
    if (externalEoa) return 'external'
    if (privyEmbeddedAddress) return 'embedded'
    return null
  })()

  // Async load of the creator coin address for the CSW.
  const [coin, setCoin] = useState<Address | null>(csw ? coinAddressCache.get(csw.toLowerCase()) ?? null : null)
  const [loadingCoin, setLoadingCoin] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    if (!csw) {
      setCoin(null)
      return () => {
        cancelled = true
      }
    }
    const cacheKey = csw.toLowerCase()
    if (coinAddressCache.has(cacheKey)) {
      setCoin(coinAddressCache.get(cacheKey) ?? null)
      return () => {
        cancelled = true
      }
    }
    setLoadingCoin(true)
    fetchCreatorCoinForCsw(csw)
      .then((result) => {
        if (!cancelled) setCoin(result)
      })
      .finally(() => {
        if (!cancelled) setLoadingCoin(false)
      })
    return () => {
      cancelled = true
    }
  }, [csw])

  return {
    cswAddress: csw,
    externalEoaAddress: externalEoa,
    privyEmbeddedAddress,
    activeSigner,
    creatorCoinAddress: coin,
    loadingCoin,
  }
}
