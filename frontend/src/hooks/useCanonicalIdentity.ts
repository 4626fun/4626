import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { createPublicClient, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useAccountMe } from '@/hooks/useAccountMe'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import { BASE_DEFAULTS } from '@/config/contracts.defaults'

/**
 * Consolidated identity snapshot for the signed-in user. Composes:
 *   - Privy user state (the human login)
 *   - wagmi connection (optional external EOA)
 *   - `/api/accounts/me` → `accountSignals.canonicalCswAddress` (the
 *     authoritative parent Coinbase Smart Wallet for this profile)
 *   - SIWE session (confirms auth + as a fallback when `/accounts/me`
 *     hasn't loaded yet)
 *   - On-chain read: CreatorRegistry.getTokenForVault(csw) → creator coin addr
 *
 * Design notes:
 *   - `cswAddress` is the PARENT CSW — what owns the creator's vault,
 *     coin, lottery entries, and settles balances. For Privy-native
 *     flows the SIWE authAddress is the embedded EOA that signed the
 *     challenge, NOT the CSW; relying on authAddress alone would show
 *     the wrong address in the identity card (bug seen 2026-04-19).
 *     We read `profile.accountSignals.canonicalCswAddress` from the
 *     authoritative server-resolved source instead.
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
   * True while `/api/accounts/me` is still fetching the profile's
   * canonical CSW. Useful for rendering a "Linking…" placeholder in
   * the card instead of falsely showing "not signed in" when the user
   * is in fact signed in and the CSW just hasn't arrived yet.
   */
  loadingCsw: boolean
  /**
   * True when the server confirms the profile is authed but no
   * `canonicalCswAddress` is linked yet (user signed in but hasn't
   * completed Zora / Base App setup). The card uses this to prompt
   * setup instead of leaving an empty CSW row.
   */
  cswMissing: boolean
  /**
   * Whether a SIWE session exists at all. When false the card
   * should not render.
   */
  hasSession: boolean
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
  /** App-scoped execution sub-account used for day-to-day actions. */
  executionSubAccountAddress: Address | null
  /** Server-derived execution track classification. */
  executionTrack: 'sub-account' | 'legacy-owner-install' | 'migration-pending' | 'none-yet' | null
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
      timeout: 20_000,
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
  const accountMe = useAccountMe()

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
    // PRIMARY source: the server-resolved canonical CSW attached to the
    // profile. This is the parent CSW (e.g. 0xab6d…67b5 for profile 1),
    // NOT the SIWE authAddress (which is the embedded EOA that signed
    // the challenge on Privy flows). See module docstring for why.
    const canonical = accountMe.me?.accountSignals?.canonicalCswAddress
    if (typeof canonical === 'string' && isAddress(canonical)) {
      return canonical as Address
    }

    // FALLBACK: while `/api/accounts/me` is loading on a fresh sign-in,
    // we still want *something* to render in the card slot. We DO NOT
    // fall back to authAddress here because for Privy flows that value
    // is the embedded EOA and would once again show the wrong address
    // in the CSW slot. Returning null is correct: the card gracefully
    // renders "signed in" copy until the canonical CSW resolves.
    return null
  })()

  const activeSigner: CanonicalIdentity['activeSigner'] = (() => {
    if (externalEoa) return 'external'
    if (privyEmbeddedAddress) return 'embedded'
    return null
  })()

  const executionTrack = (accountMe.me?.accountSignals?.executionTrack ?? null) as CanonicalIdentity['executionTrack']
  const executionSubAccountAddress: Address | null = (() => {
    const signals = accountMe.me?.accountSignals
    if (!signals) return null
    if (signals.executionTrack !== 'sub-account' && signals.executionTrack !== 'migration-pending') return null
    if (!signals.baseSubAccount?.registered) return null
    const candidate = signals.baseSubAccount.address
    if (!candidate || !isAddress(candidate)) return null
    const normalized = candidate as Address
    const lower = normalized.toLowerCase()
    if (csw && lower === csw.toLowerCase()) return null
    if (externalEoa && lower === externalEoa.toLowerCase()) return null
    if (privyEmbeddedAddress && lower === privyEmbeddedAddress.toLowerCase()) return null
    return normalized
  })()

  const cswKey = csw ? csw.toLowerCase() : null
  const hasCachedCoin = cswKey ? coinAddressCache.has(cswKey) : false
  const cachedCoin = cswKey ? (coinAddressCache.get(cswKey) ?? null) : null
  // Async load of the creator coin address for the CSW.
  const [coinAsync, setCoinAsync] = useState<{ key: string; value: Address | null } | null>(
    cswKey && hasCachedCoin ? { key: cswKey, value: cachedCoin } : null,
  )

  useEffect(() => {
    let cancelled = false
    if (!csw || !cswKey) {
      return () => {
        cancelled = true
      }
    }
    if (coinAddressCache.has(cswKey)) {
      return () => {
        cancelled = true
      }
    }
    fetchCreatorCoinForCsw(csw)
      .then((result) => {
        if (!cancelled) setCoinAsync({ key: cswKey, value: result })
      })
    return () => {
      cancelled = true
    }
  }, [csw, cswKey])

  const hasSession = Boolean(auth.hasSession && auth.authAddress)
  const loadingCsw = hasSession && accountMe.loading && !csw
  const cswMissing =
    hasSession && !accountMe.loading && !csw && accountMe.me !== null

  const creatorCoinAddress = csw
    ? hasCachedCoin
      ? cachedCoin
      : coinAsync?.key === cswKey
        ? coinAsync.value
        : null
    : null
  const loadingCoin = Boolean(csw && !hasCachedCoin && coinAsync?.key !== cswKey)

  return {
    cswAddress: csw,
    loadingCsw,
    cswMissing,
    hasSession,
    externalEoaAddress: externalEoa,
    privyEmbeddedAddress,
    activeSigner,
    creatorCoinAddress,
    loadingCoin,
    executionSubAccountAddress,
    executionTrack,
  }
}
