import { Check, KeyRound, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { useQueries, useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { getAddress, isAddress, type Address } from 'viem'

import { TokenAvatar } from '@/components/swap/TokenAvatar'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { getChainMeta, type SupportedChainId } from '@/config/chains'
import { normalizeCoinSearchQuery } from '@/features/explore/exploreShared'
import { cn } from '@/lib/shared/utils'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import {
  fetchSwapAssetBalanceViaApi,
  swapAssetBalanceQueryKey,
} from '@/lib/swap/useSwapAssetBalance'
import {
  fetchAlfaClubRoomsForTokenModal,
  formatAlfaClubKeyLabel,
  resolveAlfaClubKeyImageUrl,
  resolveAlfaClubKeys,
  type AlfaClubKeyOption,
} from '@/lib/swap/alfaclubRoomTokens'
import { formatSwapTokenBalanceLabel } from '@/lib/swap/swapDisplayAmount'
import { isOpaqueInternalTokenLabel } from '@/lib/swap/swapTokenLabels'
import {
  isExcludedSwapTokenAddress,
  resolveAddressTokenImport,
} from '@/lib/swap/swapTokenAddressGuards'
import { AKITA_DEFAULTS } from '@/config/contracts.defaults'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { apiFetch } from '@/lib/api/apiBase'
import { ALFACLUB, FRIEND_KEY_ABI } from '@/lib/alfaclub/contracts'
import { sameSwapAsset, type SwapAssetRef } from '@/lib/swap/swapAssetIdentity'
import {
  BASE_CHAIN_ID,
  shareTokenLogo,
  shortAddress,
  type TokenDisplay,
  type TokenOption,
} from '@/lib/uniswap/swapUtils'

export type SwapTokenOption = TokenOption & {
  sectionTag?: 'core' | 'creator' | 'content' | 'trend'
  verified?: boolean
  isUserHolding?: boolean
}

type AddressMetadataCacheEntry = {
  chainId: number
  symbol: string
  name: string
  decimals: number
  logoUrl?: string | null
}

type AddressCandidate = TokenDisplay & {
  address: `0x${string}`
  chainId: SupportedChainId
  decimals: number
}

const ADDRESS_METADATA_CACHE_KEY = 'swap.addressMetadataCache.v2'
const QUICK_PICK_SYMBOLS = ['ETH', 'WETH', 'USDC', 'USDT', 'CBBTC', 'ZORA'] as const

const TRENDING_PINNED: Array<{ address: `0x${string}`; fallback: SwapTokenOption }> = [
  {
    address: AKITA_DEFAULTS.token,
    fallback: {
      address: AKITA_DEFAULTS.token,
      symbol: 'AKITA',
      name: 'Akita',
      group: 'creator',
      sectionTag: 'creator',
      verified: true,
      chainId: BASE_CHAIN_ID,
      logoUrl: shareTokenLogo(AKITA_DEFAULTS.token, BASE_CHAIN_ID),
    },
  },
]

function resolveTrendingTokens(allOptions: SwapTokenOption[]): SwapTokenOption[] {
  return TRENDING_PINNED.map(({ address, fallback }) => {
    const match = allOptions.find((option) => option.address.toLowerCase() === address.toLowerCase())
    return match ?? fallback
  })
}

function matchesQuickPickSymbol(symbol: string): boolean {
  const upper = symbol.trim().toUpperCase()
  return QUICK_PICK_SYMBOLS.some((candidate) => candidate === upper)
}
const MAX_BALANCE_LOOKUPS = 18

type TokenRow = { option: SwapTokenOption; section: string }

export type SwapSelectorAsset =
  | { ref: Extract<SwapAssetRef, { kind: 'erc20' }>; token: SwapTokenOption }
  | { ref: Extract<SwapAssetRef, { kind: 'erc1155-key' }>; key: AlfaClubKeyOption }

type TokenSelectorModalProps = {
  open: boolean
  query: string
  tokenOptions: SwapTokenOption[]
  selectedAsset: SwapAssetRef | null
  recentTokenAddresses: string[]
  chainId?: SupportedChainId
  balanceOwnerAddress?: Address | null
  /** Owner used for on-chain FriendKey balances (execution sender). Falls back to balanceOwnerAddress. */
  keyBalanceOwnerAddress?: Address | null
  /** USD value per held token (lowercased address), e.g. from the Zora wallet-holdings API. */
  usdValueByAddress?: Map<string, number>
  isSearchLoading?: boolean
  onQueryChange: (value: string) => void
  onClose: () => void
  onSelectAsset: (asset: SwapSelectorAsset) => void
}

const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [1, 10, 137, 42161, 8453]

function toSupportedChainId(value: number | undefined, fallback: SupportedChainId): SupportedChainId {
  const normalized = typeof value === 'number' ? Math.trunc(value) : Number.NaN
  return SUPPORTED_CHAIN_IDS.includes(normalized as SupportedChainId)
    ? (normalized as SupportedChainId)
    : fallback
}

function tokenMatches(option: SwapTokenOption, query: string): boolean {
  const normalized = normalizeCoinSearchQuery(query)
  const candidates = Array.from(
    new Set([normalized.raw, normalized.withoutAt, normalized.withoutBasenameSuffix].filter(Boolean)),
  )
  if (candidates.length === 0) return true

  const fields = [
    option.symbol.toLowerCase(),
    option.name.toLowerCase(),
    option.address.toLowerCase(),
  ]
  return candidates.some((candidate) => fields.some((field) => field.includes(candidate)))
}

function isAddressLike(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed)
}

function tokenSection(option: SwapTokenOption): 'core' | 'creator' | 'content' | 'trend' {
  if (option.sectionTag === 'trend') return 'trend'
  if (option.sectionTag === 'creator') return 'creator'
  if (option.sectionTag === 'content') return 'content'
  if (option.group === 'core') return 'core'
  return 'content'
}

function formatSectionLabel(section: string): string {
  switch (section) {
    case 'Trending':
      return 'Trending'
    case 'Recently used':
      return 'Recent'
    case 'Curated top tokens':
      return 'Popular tokens'
    case 'Your holdings':
      return 'Your holdings'
    case 'AlfaClub keys':
      return 'AlfaClub keys'
    case 'Creator coins':
      return 'Creator coins'
    case 'Content coins':
      return 'Content coins'
    case 'Address search':
      return 'Import token'
    default:
      return section
  }
}

function formatTokenUsdLabel(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  if (value < 0.01) return '<$0.01'
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function resolveTokenRowAmountLabels(params: {
  address: string
  symbol: string
  balanceByAddress: Map<string, string>
  usdValueByAddress?: Map<string, number>
}): { balanceLabel: string | null; usdLabel: string | null } {
  const key = params.address.toLowerCase()
  const rawBalance = params.balanceByAddress.get(key) ?? null
  const balanceLabel = rawBalance
    ? formatSwapTokenBalanceLabel(rawBalance, params.symbol)
    : null
  const hasBalance = Boolean(balanceLabel && balanceLabel !== '0')
  return {
    balanceLabel: hasBalance ? balanceLabel : null,
    usdLabel: hasBalance ? formatTokenUsdLabel(params.usdValueByAddress?.get(key)) : null,
  }
}

const BASE_NETWORK_MARK = '/base/base-chain-light.svg'

function NetworkChip({ chainId }: { chainId: SupportedChainId }) {
  const meta = getChainMeta(chainId)
  if (!meta) return null
  const isBase = meta.id === BASE_CHAIN_ID
  const logoSrc = isBase ? BASE_NETWORK_MARK : meta.logoUrl
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/45"
      title={meta.name}
      aria-label={meta.name}
    >
      <img
        src={logoSrc}
        alt=""
        className={isBase ? 'h-5 w-5 rounded-[4px] object-contain' : 'h-5 w-5 rounded-full object-cover'}
      />
    </div>
  )
}

function TokenSelectorRow(props: {
  option: SwapTokenOption
  isActive: boolean
  isSelected: boolean
  balanceLabel?: string | null
  usdLabel?: string | null
  onChoose: () => void
  onHover: () => void
}) {
  const { option, isActive, isSelected, balanceLabel, usdLabel, onChoose, onHover } = props
  const isUnverified = option.verified === false
  const showAddressHint =
    isUnverified ||
    option.sectionTag === 'creator' ||
    option.sectionTag === 'content' ||
    option.sectionTag === 'trend'
  const subtitleName = option.name &&
          option.name.toLowerCase() !== option.symbol.toLowerCase() &&
          !isOpaqueInternalTokenLabel(option.name)
        ? option.name
        : option.sectionTag === 'creator'
          ? 'Creator coin'
          : option.sectionTag === 'trend'
            ? 'Trend coin'
            : option.name

  return (
    <button
      type="button"
      data-token-row={option.address.toLowerCase()}
      onClick={onChoose}
      onMouseEnter={onHover}
      onFocus={onHover}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
        isSelected ? 'bg-brand-primary/14' : isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.05]',
      )}
    >
      <div className="relative shrink-0">
        <TokenAvatar
          token={{ address: option.address, logoUrl: option.logoUrl, logoUrls: option.logoUrls }}
          symbol={option.symbol}
          size={40}
          noFallback
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-white">{option.symbol}</span>
          {option.sectionTag === 'creator' ? (
            <span className="shrink-0 rounded-md bg-brand-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-200">
              Creator
            </span>
          ) : null}
          {option.sectionTag === 'trend' ? (
            <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
              Trend
            </span>
          ) : null}
          {option.sectionTag === 'content' ? (
            <span className="shrink-0 rounded-md bg-brand-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-300">
              Content
            </span>
          ) : null}
          {isUnverified ? (
            <span className="shrink-0 rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
              Custom
            </span>
          ) : null}
        </div>
        <div className="truncate text-xs text-zinc-500">
          {showAddressHint ? (
            <>
              {subtitleName}
              <span className="mx-1 text-zinc-600">·</span>
              <span className="font-mono text-[11px] text-zinc-600">{shortAddress(option.address)}</span>
            </>
          ) : (
            subtitleName
          )}
        </div>
      </div>

      <div className="flex min-w-[4.75rem] shrink-0 flex-col items-end gap-0.5 pl-1">
        {usdLabel ? (
          <span className="text-sm font-medium tabular-nums text-zinc-200">{usdLabel}</span>
        ) : balanceLabel ? (
          <span className="text-sm font-medium tabular-nums text-zinc-200">{balanceLabel}</span>
        ) : null}
        {usdLabel && balanceLabel ? (
          <span className="text-xs tabular-nums text-zinc-500">{balanceLabel}</span>
        ) : null}
        {isSelected ? <Check className="h-4 w-4 text-brand-primary" strokeWidth={2.5} /> : null}
      </div>
    </button>
  )
}

function KeySelectorRow(props: {
  option: AlfaClubKeyOption
  isActive: boolean
  isSelected: boolean
  onChoose: () => void
  onHover: () => void
}) {
  const { option, isActive, isSelected, onChoose, onHover } = props
  const disabled = !option.marketReady
  return (
    <button
      type="button"
      data-key-row={option.keyId}
      disabled={disabled}
      onClick={onChoose}
      onMouseEnter={onHover}
      onFocus={onHover}
      tabIndex={isActive ? 0 : -1}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-150',
        isSelected
          ? 'bg-[rgb(var(--brand-primary)/0.14)] ring-1 ring-[rgb(var(--brand-primary)/0.28)]'
          : isActive
            ? 'bg-white/[0.06]'
            : 'hover:bg-white/[0.05]',
        disabled ? 'cursor-not-allowed opacity-50' : null,
      )}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.04]">
        {option.imageUrl ? (
          <img src={option.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <KeyRound className="h-4 w-4 text-zinc-300" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-white">{option.label}</span>
          {option.marketReady ? (
            <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200/90">
              Live
            </span>
          ) : (
            <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
              Soon
            </span>
          )}
        </div>
        <div className="truncate text-xs text-zinc-500">
          {option.marketReady
            ? `${option.creatorHandle ? `@${option.creatorHandle.replace(/^@+/, '')} · ` : ''}AlfaClub · ERC-1155`
            : 'Market not available yet'}
        </div>
      </div>
      <div className="flex min-w-[4.75rem] shrink-0 flex-col items-end gap-0.5 pl-1">
        {option.balance != null ? (
          <span className="text-sm font-medium tabular-nums text-zinc-200">{option.balance.toString()}</span>
        ) : null}
        {isSelected ? <Check className="h-4 w-4 text-[rgb(var(--brand-primary))]" strokeWidth={2.5} /> : null}
      </div>
    </button>
  )
}

export function TokenSelectorModal({
  open,
  query,
  tokenOptions,
  selectedAsset,
  recentTokenAddresses,
  chainId,
  balanceOwnerAddress,
  keyBalanceOwnerAddress = null,
  usdValueByAddress,
  isSearchLoading = false,
  onQueryChange,
  onClose,
  onSelectAsset,
}: TokenSelectorModalProps) {
  const [debouncedQuery] = useDebounceValue(query, 250)
  const trimmedQuery = debouncedQuery.trim()
  const isAddressSearch = isAddressLike(trimmedQuery)
  const selectableTokenOptions = useMemo(
    () => tokenOptions.filter((option) => !isExcludedSwapTokenAddress(option.address, balanceOwnerAddress)),
    [balanceOwnerAddress, tokenOptions],
  )

  const [addressLookupError, setAddressLookupError] = useState<string | null>(null)
  const [needsUnverifiedConfirm, setNeedsUnverifiedConfirm] = useState<SwapTokenOption | null>(null)
  const [addressCandidate, setAddressCandidate] = useState<AddressCandidate | null>(null)
  const [addressLookupLoading, setAddressLookupLoading] = useState(false)
  const [addressLookupAttempt, setAddressLookupAttempt] = useState(0)
  const [addressMetadataCache, setAddressMetadataCache] = useState<Record<string, AddressMetadataCacheEntry>>({})

  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const contentAutoCollapsedRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [minUsdOnly, setMinUsdOnly] = useState(false)

  const publicClient = usePublicClient({ chainId: chainId ?? undefined })
  const isAddressSearchActive = isAddressSearch && Boolean(trimmedQuery)
  const chainIdForLookup = toSupportedChainId(chainId, BASE_CHAIN_ID as SupportedChainId)
  const tokenAddressMetadata = useTokenMetadata(
    isAddressSearchActive && trimmedQuery ? (trimmedQuery as `0x${string}`) : undefined,
  )

  const matchedTokens = useMemo(() => {
    const filtered = selectableTokenOptions.filter((option) => tokenMatches(option, trimmedQuery))
    if (!isAddressSearch || !trimmedQuery) {
      return {
        core: filtered.filter((o) => tokenSection(o) === 'core'),
        creator: filtered.filter((o) => tokenSection(o) === 'creator' && !o.isUserHolding),
        content: filtered.filter((o) => tokenSection(o) === 'content' && !o.isUserHolding),
        recent: recentTokenAddresses
          .map((recentAddress) => {
            const key = recentAddress.toLowerCase()
            return filtered.find((option) => option.address.toLowerCase() === key) ?? null
          })
          .filter((option): option is SwapTokenOption => option != null),
        holdings: filtered.filter((o) => o.isUserHolding),
      }
    }
    return { core: [], creator: [], content: [], recent: [], holdings: [] }
  }, [isAddressSearch, selectableTokenOptions, trimmedQuery, recentTokenAddresses])

  useEffect(() => {
    if (!open) {
      setMinUsdOnly(false)
      contentAutoCollapsedRef.current = false
    }
  }, [open])

  const quickPickTokens = useMemo(() => {
    if (trimmedQuery) return []
    const order = new Map(QUICK_PICK_SYMBOLS.map((symbol, index) => [symbol, index]))
    return matchedTokens.core
      .filter((option) => matchesQuickPickSymbol(option.symbol))
      .sort(
        (a, b) =>
          (order.get(a.symbol.trim().toUpperCase() as (typeof QUICK_PICK_SYMBOLS)[number]) ?? 99) -
          (order.get(b.symbol.trim().toUpperCase() as (typeof QUICK_PICK_SYMBOLS)[number]) ?? 99),
      )
  }, [matchedTokens.core, trimmedQuery])

  const alfaclubRoomsQuery = useQuery({
    queryKey: ['swap', 'token-selector', 'alfaclub-rooms'],
    enabled: open && chainIdForLookup === BASE_CHAIN_ID,
    staleTime: 60_000,
    queryFn: ({ signal }) => fetchAlfaClubRoomsForTokenModal(signal),
  })

  const friendKeyHoldingsQuery = useQuery({
    queryKey: ['swap', 'token-selector', 'friend-key-holdings', balanceOwnerAddress?.toLowerCase() ?? ''],
    enabled: open && Boolean(balanceOwnerAddress) && chainIdForLookup === BASE_CHAIN_ID,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await apiFetch(API_ENDPOINTS.wallet.friendKeyHoldings, { method: 'GET' })
      const payload = await response.json().catch(() => null) as {
        success?: boolean
        data?: { keys?: Array<{ tokenId: string; balance: string; creator: string }> }
      } | null
      return response.ok && payload?.success && Array.isArray(payload.data?.keys) ? payload.data.keys : []
    },
  })

  const keyBalanceOwner = keyBalanceOwnerAddress ?? balanceOwnerAddress ?? null

  const alfaclubKeysSeed = useMemo(() => {
    if (chainIdForLookup !== BASE_CHAIN_ID) return [] as AlfaClubKeyOption[]
    const directory = resolveAlfaClubKeys({ rooms: alfaclubRoomsQuery.data ?? [] })
    const byId = new Map(directory.map((key) => [key.keyId, key]))
    for (const holding of friendKeyHoldingsQuery.data ?? []) {
      const existing = byId.get(holding.tokenId)
      const balance = /^\d+$/.test(holding.balance) ? BigInt(holding.balance) : 0n
      if (existing) {
        byId.set(holding.tokenId, { ...existing, balance })
        continue
      }
      byId.set(holding.tokenId, {
        assetKind: 'erc1155-key',
        contractAddress: ALFACLUB.friendKey,
        keyId: holding.tokenId,
        label: formatAlfaClubKeyLabel({ keyId: holding.tokenId }),
        imageUrl: resolveAlfaClubKeyImageUrl({ keyId: holding.tokenId }),
        balance,
        marketReady: holding.tokenId === '1659',
        asset: { kind: 'erc1155-key', chainId: 8453, contractAddress: ALFACLUB.friendKey, tokenId: BigInt(holding.tokenId) },
      })
    }
    const normalized = trimmedQuery.replace(/^key\s*/i, '').replace(/^#/, '').trim().toLowerCase()
    // Swap picker only surfaces executable markets — hide Soon dead-ends.
    return [...byId.values()]
      .filter((key) => key.marketReady)
      .filter((key) => !normalized || [key.keyId, key.label, key.creatorHandle ?? ''].some((value) => value.toLowerCase().includes(normalized)))
      .sort((a, b) => {
        const balanceOrder = (b.balance ?? 0n) > (a.balance ?? 0n) ? 1 : (b.balance ?? 0n) < (a.balance ?? 0n) ? -1 : 0
        return balanceOrder || Number(b.marketReady) - Number(a.marketReady)
      })
  }, [alfaclubRoomsQuery.data, chainIdForLookup, friendKeyHoldingsQuery.data, trimmedQuery])

  const friendKeyBalanceQueries = useQueries({
    queries: alfaclubKeysSeed.map((key) => ({
      queryKey: [
        'swap',
        'token-selector',
        'friend-key-balance',
        keyBalanceOwner?.toLowerCase() ?? '',
        key.keyId,
      ],
      enabled:
        open &&
        Boolean(keyBalanceOwner) &&
        Boolean(publicClient) &&
        chainIdForLookup === BASE_CHAIN_ID,
      staleTime: 15_000,
      queryFn: async () => {
        if (!publicClient || !keyBalanceOwner) return 0n
        return publicClient.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: 'balanceOf',
          args: [keyBalanceOwner, BigInt(key.keyId)],
        })
      },
    })),
  })

  const onChainBalanceKey = friendKeyBalanceQueries
    .map((query) => (typeof query.data === 'bigint' ? query.data.toString() : ''))
    .join('|')

  const alfaclubKeys = useMemo(() => {
    const balances = onChainBalanceKey.split('|')
    return alfaclubKeysSeed.map((key, index) => {
      const raw = balances[index]
      if (raw) return { ...key, balance: BigInt(raw) }
      return key
    })
  }, [alfaclubKeysSeed, onChainBalanceKey])

  const heldKeys = useMemo(
    () => alfaclubKeys.filter((key) => key.balance != null && key.balance > 0n),
    [alfaclubKeys],
  )
  const marketKeys = useMemo(
    () => alfaclubKeys.filter((key) => !heldKeys.some((held) => held.keyId === key.keyId)),
    [alfaclubKeys, heldKeys],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(ADDRESS_METADATA_CACHE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      setAddressMetadataCache(parsed as Record<string, AddressMetadataCacheEntry>)
    } catch {}
  }, [])

  useEffect(() => {
    let cancelled = false
    async function resolveTokenMetadata() {
      if (!open || !isAddressSearch || !trimmedQuery || !publicClient || !isAddress(trimmedQuery)) {
        setAddressLookupError(null)
        setAddressCandidate(null)
        setAddressLookupLoading(false)
        return
      }

      const tokenAddress = getAddress(trimmedQuery)
      // Reset query-scoped UI state here (not in a sibling effect) so a synchronous
      // known-CSW rejection is not wiped by a later trimmedQuery effect in the same flush.
      setNeedsUnverifiedConfirm(null)
      setActiveIndex(0)

      if (isExcludedSwapTokenAddress(tokenAddress, balanceOwnerAddress)) {
        setAddressCandidate(null)
        setAddressLookupError('This address is a Coinbase Smart Wallet, not a token.')
        setAddressLookupLoading(false)
        return
      }

      const cacheKey = `${chainIdForLookup}:${tokenAddress.toLowerCase()}`
      setAddressLookupLoading(true)
      setAddressLookupError(null)
      try {
        // Always re-validate through the import guards. Cache may only supply
        // previously observed ERC-20 metadata after a successful import.
        const imported = await resolveAddressTokenImport({
          client: publicClient,
          address: tokenAddress,
        })

        if (cancelled) return

        if (!imported.ok) {
          setAddressCandidate(null)
          setAddressLookupError(
            imported.reason === 'smart_wallet'
              ? 'This address is a Coinbase Smart Wallet, not a token.'
              : 'Unable to load token metadata for this address.',
          )
          return
        }

        const { name, symbol, decimals } = imported.metadata
        const cached = addressMetadataCache[cacheKey]
        const logoUrl = tokenAddressMetadata.imageUrl ?? cached?.logoUrl ?? null
        setAddressCandidate({
          address: tokenAddress,
          chainId: chainIdForLookup,
          symbol,
          name,
          decimals,
          logoUrl,
          logoUrls: [],
        })
        const newEntry: AddressMetadataCacheEntry = {
          chainId: chainIdForLookup,
          symbol,
          name,
          decimals,
          logoUrl,
        }
        setAddressMetadataCache((previous) => {
          const next = { ...previous, [cacheKey]: newEntry }
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(ADDRESS_METADATA_CACHE_KEY, JSON.stringify(next))
            } catch {}
          }
          return next
        })
      } catch {
        if (!cancelled) {
          setAddressCandidate(null)
          setAddressLookupError('Unable to load token metadata for this address.')
        }
      } finally {
        if (!cancelled) setAddressLookupLoading(false)
      }
    }

    void resolveTokenMetadata()
    return () => {
      cancelled = true
    }
  }, [
    addressLookupAttempt,
    balanceOwnerAddress,
    chainIdForLookup,
    isAddressSearch,
    open,
    publicClient,
    trimmedQuery,
    tokenAddressMetadata.imageUrl,
    addressMetadataCache,
  ])

  useEffect(() => {
    // Address-lookup effect owns candidate/error lifecycle for 0x queries.
    // Only clear leftover import UI when leaving address search.
    if (isAddressLike(trimmedQuery)) return
    setAddressLookupError(null)
    setNeedsUnverifiedConfirm(null)
    setAddressCandidate(null)
    setActiveIndex(0)
  }, [trimmedQuery])

  useEffect(() => {
    setActiveIndex(0)
  }, [minUsdOnly])

  const rows = useMemo(() => {
    const list: { option: SwapTokenOption; section: string }[] = []
    if (isAddressSearchActive && addressCandidate) {
      list.push({
        option: {
          address: addressCandidate.address,
          symbol: addressCandidate.symbol,
          name: addressCandidate.name,
          group: 'share',
          chainId: chainIdForLookup,
          decimals: addressCandidate.decimals,
          verified: false,
          logoUrl: addressCandidate.logoUrl ?? undefined,
          logoUrls: addressCandidate.logoUrls,
        },
        section: 'Address search',
      })
      return list
    }

    const seen = new Set<string>()
    const trendingAddresses = new Set(
      resolveTrendingTokens(selectableTokenOptions).map((option) => option.address.toLowerCase()),
    )

    // Dedicated "Your holdings" section first (Zora creator/content coins owned by the wallet, using the parent/main/zora CSW as balance owner).
    // Push before Trending so it appears at the very top. We push directly (only skipping seen) so holdings
    // that happen to be in the trending pinned list (e.g. AKITA on the user's Zora CSW) still get their own section.
    matchedTokens.holdings.forEach((option) => {
      const key = option.address.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      list.push({ option, section: 'Your holdings' })
    })

    if (!trimmedQuery) {
      resolveTrendingTokens(selectableTokenOptions)
        .filter((option) => !option.isUserHolding) // keep user's Zora CSW holdings out of Trending so they can appear in the dedicated holdings section
        .forEach((option) => {
          const key = option.address.toLowerCase()
          if (seen.has(key)) return
          seen.add(key)
          list.push({ option, section: 'Trending' })
        })
    }

    const pushUnlessSeen = (option: SwapTokenOption, section: string) => {
      const key = option.address.toLowerCase()
      if (seen.has(key) || trendingAddresses.has(key)) return
      seen.add(key)
      list.push({ option, section })
    }

    matchedTokens.recent.forEach((option) => {
      pushUnlessSeen(option, 'Recently used')
    })
    matchedTokens.core.forEach((option) => {
      pushUnlessSeen(option, 'Curated top tokens')
    })
    // Note: holdings are excluded from creator/content here because they are pulled into
    // the dedicated section above (the split in matchedTokens already filters them out of these)
    matchedTokens.creator.forEach((option) => {
      pushUnlessSeen(option, 'Creator coins')
    })
    matchedTokens.content.forEach((option) => {
      pushUnlessSeen(option, 'Content coins')
    })
    return list
  }, [
    addressCandidate,
    chainIdForLookup,
    isAddressSearchActive,
    matchedTokens,
    selectableTokenOptions,
    trimmedQuery,
  ])

  const visibleRows = useMemo(() => rows, [rows])

  const rowSections = useMemo(() => {
    const order: string[] = []
    const grouped = new Map<string, TokenRow[]>()
    for (const row of rows) {
      if (!grouped.has(row.section)) {
        order.push(row.section)
        grouped.set(row.section, [])
      }
      grouped.get(row.section)!.push(row)
    }
    return order.map((section) => ({ section, rows: grouped.get(section) ?? [] }))
  }, [rows])

  const balanceLookupAddresses = useMemo(() => {
    if (!balanceOwnerAddress || chainIdForLookup !== BASE_CHAIN_ID) return []
    const seen = new Set<string>()
    const addresses: string[] = []
    const push = (value: string) => {
      const key = value.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      addresses.push(value)
    }
    resolveTrendingTokens(selectableTokenOptions).forEach((option) => push(option.address))
    quickPickTokens.forEach((option) => push(option.address))
    visibleRows.slice(0, MAX_BALANCE_LOOKUPS).forEach(({ option }) => push(option.address))
    return addresses.slice(0, MAX_BALANCE_LOOKUPS)
  }, [
    balanceOwnerAddress,
    chainIdForLookup,
    quickPickTokens,
    visibleRows,
    selectableTokenOptions,
  ])

  const balanceQueries = useQueries({
    queries: balanceLookupAddresses.map((tokenAddress) => ({
      queryKey: swapAssetBalanceQueryKey({
        chainId: chainIdForLookup,
        ownerAddress: balanceOwnerAddress ?? null,
        tokenAddress,
      }),
      enabled: Boolean(open && balanceOwnerAddress && chainIdForLookup === BASE_CHAIN_ID),
      staleTime: 5_000,
      queryFn: async () =>
        fetchSwapAssetBalanceViaApi({
          ownerAddress: balanceOwnerAddress as Address,
          tokenAddress,
        }),
    })),
  })

  const balanceByAddress = useMemo(() => {
    const map = new Map<string, string>()
    balanceLookupAddresses.forEach((address, index) => {
      const formatted = balanceQueries[index]?.data?.formatted
      if (!formatted || formatted === '0') return
      map.set(address.toLowerCase(), formatted)
    })
    return map
  }, [balanceLookupAddresses, balanceQueries])

  // Regroup so that any creator/content tokens with positive balance on the current
  // balanceOwnerAddress (the parent/main/zora csw) are collected into a dedicated
  // "Your holdings" section at the top. This ensures the user sees their Zora CSW
  // holdings + the actual balances from that CSW, even if the coins weren't explicitly
  // injected via the Zora holdings API (they may be in the public/trending lists).
  const displaySections = useMemo(() => {
    const base = rowSections.filter(({ rows: sectionRows }) => sectionRows.length > 0);
    if (!balanceByAddress || balanceByAddress.size === 0) return base;

    const holdingsRows: TokenRow[] = [];
    const other: { section: string; rows: TokenRow[] }[] = [];

    for (const sec of base) {
      if (sec.section === 'Your holdings') {
        other.push(sec);
        continue;
      }
      const pos: TokenRow[] = [];
      const rem: TokenRow[] = [];
      for (const r of sec.rows) {
        const b = balanceByAddress.get(r.option.address.toLowerCase());
        const hasPositive = b && parseFloat(b) > 0;
        const isZoraCoin = r.option.sectionTag === 'creator' || r.option.sectionTag === 'content' ||
                           r.option.group === 'creator' || r.option.group === 'share';
        if (hasPositive && isZoraCoin) {
          pos.push(r);
        } else {
          rem.push(r);
        }
      }
      if (pos.length) holdingsRows.push(...pos);
      if (rem.length) other.push({ section: sec.section, rows: rem });
    }

    const res: { section: string; rows: TokenRow[] }[] = [];
    if (holdingsRows.length) res.push({ section: 'Your holdings', rows: holdingsRows });
    res.push(...other);
    return res;
  }, [rowSections, balanceByAddress]);

  // "> $0.01" dust filter: hide rows whose known USD value is below one cent.
  // Rows without USD data stay visible (filter is best-effort, like Zora's modal).
  const filteredSections = useMemo(() => {
    if (!minUsdOnly || !usdValueByAddress || usdValueByAddress.size === 0) return displaySections
    return displaySections
      .map(({ section, rows: sectionRows }) => ({
        section,
        rows: sectionRows.filter(({ option }) => {
          const usd = usdValueByAddress.get(option.address.toLowerCase())
          return usd == null || usd >= 0.01
        }),
      }))
      .filter(({ rows: sectionRows }) => sectionRows.length > 0)
  }, [displaySections, minUsdOnly, usdValueByAddress])

  // Flattened render order — keyboard navigation must mirror exactly what is displayed.
  const flatDisplayRows = useMemo(
    () => filteredSections.flatMap(({ rows: sectionRows }) => sectionRows),
    [filteredSections],
  )

  type NavRow =
    | { kind: 'erc20'; option: SwapTokenOption }
    | { kind: 'key'; key: AlfaClubKeyOption }

  const listLoading = isSearchLoading && Boolean(trimmedQuery) && !isAddressSearchActive

  const flatNavRows = useMemo<NavRow[]>(() => {
    const tokenRows: NavRow[] = flatDisplayRows.map(({ option }) => ({ kind: 'erc20', option }))
    // Match list render order: tokens, then held keys, then market keys (hidden while search loads).
    if (listLoading) return tokenRows
    const keyRows: NavRow[] = [...heldKeys, ...marketKeys].map((key) => ({ kind: 'key', key }))
    return [...tokenRows, ...keyRows]
  }, [flatDisplayRows, heldKeys, listLoading, marketKeys])

  useEffect(() => {
    if (!open) return
    searchInputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (activeIndex >= flatNavRows.length) setActiveIndex(0)
  }, [activeIndex, flatNavRows.length])

  const selectErc20Option = useCallback((option: SwapTokenOption) => {
    // TokenOption is a display type whose chain/address fields are optional
    // strings. The selector only emits execution-ready ERC-20 references.
    if (!isAddress(option.address)) return false
    onSelectAsset({
      ref: {
        kind: 'erc20',
        chainId: toSupportedChainId(option.chainId, chainIdForLookup),
        address: getAddress(option.address),
      },
      token: option,
    })
    return true
  }, [chainIdForLookup, onSelectAsset])

  const selectKeyOption = useCallback((key: AlfaClubKeyOption) => {
    if (!key.marketReady) return false
    onSelectAsset({ ref: key.asset, key })
    onClose()
    return true
  }, [onClose, onSelectAsset])

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (!open) return
      const count = Math.max(1, flatNavRows.length)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((prev) => (prev + 1) % count)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((prev) => (prev - 1 + count) % count)
      }
      if (event.key === 'Enter' && flatNavRows[activeIndex]) {
        event.preventDefault()
        const row = flatNavRows[activeIndex]
        if (row.kind === 'key') {
          selectKeyOption(row.key)
          return
        }
        const option = row.option
        if (option.verified === false) {
          setNeedsUnverifiedConfirm(option)
          return
        }
        selectErc20Option(option)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeIndex, open, flatNavRows, selectErc20Option, selectKeyOption])

  useEffect(() => {
    const active = flatNavRows[activeIndex]
    if (!active) return
    const selector =
      active.kind === 'key'
        ? `[data-key-row="${active.key.keyId}"]`
        : `[data-token-row="${active.option.address.toLowerCase()}"]`
    const node = listRef.current?.querySelector<HTMLButtonElement>(selector)
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex, flatNavRows])

  function choose(option: SwapTokenOption) {
    if (option.verified === false) {
      setNeedsUnverifiedConfirm(option)
      return
    }
    if (selectErc20Option(option)) onClose()
  }

  function confirmUnverified() {
    if (!needsUnverifiedConfirm) return
    if (!selectErc20Option(needsUnverifiedConfirm)) return
    setNeedsUnverifiedConfirm(null)
    onClose()
  }

  function retryAddressLookup() {
    setAddressLookupError(null)
    setAddressLookupAttempt((attempt) => attempt + 1)
  }


  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select an asset"
      maxWidth="max-w-md"
      headerClassName="border-b border-white/6 px-4 pb-3 pt-4"
      className="gap-0 overflow-hidden border border-white/10 bg-[#131313] p-0 shadow-2xl"
    >
      <div className="flex max-h-[min(640px,88vh)] flex-col">
        <div className="border-b border-white/6 px-4 pb-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search tokens or keys"
                className="h-11 w-full rounded-2xl border-0 bg-white/[0.06] pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 outline-none ring-1 ring-white/8 transition focus-visible:ring-brand-primary/50"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition hover:bg-white/8 hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <NetworkChip chainId={chainIdForLookup} />
          </div>

          {alfaclubKeys.length > 0 && !trimmedQuery ? (
            <div className="mt-3">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                AlfaClub
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {alfaclubKeys.map((key) => {
                  const isSelected = sameSwapAsset(selectedAsset, key.asset)
                  return (
                  <button
                    key={`alfaclub-key-${key.keyId}`}
                    type="button"
                    disabled={!key.marketReady}
                    onClick={() => {
                      onSelectAsset({ ref: key.asset, key })
                      onClose()
                    }}
                    className={cn(
                      'flex min-w-[4.5rem] flex-col items-center gap-1.5 rounded-2xl border px-2.5 py-2 transition duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                      isSelected
                        ? 'border-[rgb(var(--brand-primary)/0.35)] bg-[rgb(var(--brand-primary)/0.12)]'
                        : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.04]">
                      {key.imageUrl ? (
                        <img src={key.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <KeyRound className="h-3.5 w-3.5 text-zinc-300" />
                      )}
                    </div>
                    <span className="max-w-[4.25rem] truncate text-[11px] font-semibold text-zinc-100">{key.label}</span>
                  </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {quickPickTokens.length > 0 ? (
            <div className="mt-3">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Common tokens
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {quickPickTokens.map((option) => (
                  <button
                    key={option.address}
                    type="button"
                    onClick={() => choose(option)}
                    className="flex min-w-[4.25rem] flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 py-2 transition hover:border-white/14 hover:bg-white/[0.06]"
                  >
                    <div className="relative">
                      <TokenAvatar
                        token={{ address: option.address, logoUrl: option.logoUrl, logoUrls: option.logoUrls }}
                        symbol={option.symbol}
                        size={28}
                        noFallback
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-200">{option.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!trimmedQuery ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMinUsdOnly((value) => !value)}
                aria-pressed={minUsdOnly}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                  minUsdOnly
                    ? 'border-brand-primary/40 bg-brand-primary/15 text-brand-100'
                    : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/16 hover:text-zinc-200',
                )}
              >
                &gt; $0.01
              </button>
              {minUsdOnly ? (
                <span className="text-[11px] text-zinc-500">Filtered to &gt; $0.01</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {isAddressSearchActive ? (
          <div className="border-b border-white/6 px-4 py-2.5">
            {addressLookupLoading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Spinner size="sm" />
                Resolving {shortAddress(trimmedQuery)}…
              </div>
            ) : addressLookupError ? (
              <div className="space-y-2">
                <Alert variant="error" className="text-left text-xs">
                  {addressLookupError}
                </Alert>
                <button
                  type="button"
                  onClick={retryAddressLookup}
                  className="text-xs font-medium text-brand-200 hover:text-brand-100"
                >
                  Retry lookup
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Paste a contract address to import any Base token.</p>
            )}
          </div>
        ) : null}

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {listLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
              <Spinner size="sm" />
              Searching tokens…
            </div>
          ) : null}

          {!listLoading && flatDisplayRows.length === 0 && alfaclubKeys.length === 0 && !addressLookupLoading ? (
            <div className="py-14 text-center">
              <p className="text-sm font-medium text-zinc-300">No tokens found</p>
              <p className="mt-1 text-xs text-zinc-500">
                {minUsdOnly
                  ? 'Try turning off the $0.01 filter or search by symbol'
                  : 'Try a symbol, creator handle, or 0x address'}
              </p>
            </div>
          ) : null}

          {!listLoading
            ? (() => {
                let visibleIdx = 0
                return filteredSections.map(({ section, rows: sectionRows }) => {
                  const sectionOpen = true
                  return (
                    <div key={section}>
                      <div className="sticky top-0 z-[1] bg-[#131313]/95 px-2 pb-1 pt-2 text-[11px] font-medium text-zinc-500 backdrop-blur-sm">
                        {formatSectionLabel(section)}
                      </div>
                      {sectionOpen
                        ? sectionRows.map(({ option }) => {
                            const isActive = activeIndex === visibleIdx
                            const isSelected =
                              selectedAsset?.kind === 'erc20' &&
                              option.address.toLowerCase() === selectedAsset.address.toLowerCase()
                            const { balanceLabel, usdLabel } = resolveTokenRowAmountLabels({
                              address: option.address,
                              symbol: option.symbol,
                              balanceByAddress,
                              usdValueByAddress,
                            })
                            const row = (
                              <TokenSelectorRow
                                key={`${section}-${option.address}`}
                                option={option}
                                isActive={isActive}
                                isSelected={isSelected}
                                balanceLabel={balanceLabel}
                                usdLabel={usdLabel}
                                onChoose={() => choose(option)}
                                onHover={() => setActiveIndex(visibleIdx)}
                              />
                            )
                            visibleIdx += 1
                            return row
                          })
                        : null}
                    </div>
                  )
                })
              })()
            : null}

          {!listLoading && heldKeys.length > 0 ? (
            <div>
              <div className="sticky top-0 z-[1] bg-[#131313]/95 px-2 pb-1 pt-2 text-[11px] font-medium tracking-[0.01em] text-zinc-500 backdrop-blur-sm">Your collection</div>
              {heldKeys.map((key, heldIndex) => {
                const navIndex = flatDisplayRows.length + heldIndex
                return (
                <KeySelectorRow
                  key={`held-key-${key.keyId}`}
                  option={key}
                  isActive={activeIndex === navIndex}
                  isSelected={sameSwapAsset(selectedAsset, key.asset)}
                  onHover={() => setActiveIndex(navIndex)}
                  onChoose={() => {
                    selectKeyOption(key)
                  }}
                />
                )
              })}
            </div>
          ) : null}

          {!listLoading && marketKeys.length > 0 ? (
            <div>
              <div className="sticky top-0 z-[1] bg-[#131313]/95 px-2 pb-1 pt-2 text-[11px] font-medium tracking-[0.01em] text-zinc-500 backdrop-blur-sm">AlfaClub markets</div>
              {marketKeys.map((key, marketIndex) => {
                const navIndex = flatDisplayRows.length + heldKeys.length + marketIndex
                return (
                <KeySelectorRow
                  key={`market-key-${key.keyId}`}
                  option={key}
                  isActive={activeIndex === navIndex}
                  isSelected={sameSwapAsset(selectedAsset, key.asset)}
                  onHover={() => setActiveIndex(navIndex)}
                  onChoose={() => {
                    selectKeyOption(key)
                  }}
                />
                )
              })}
            </div>
          ) : null}
        </div>

        {needsUnverifiedConfirm ? (
          <div className="border-t border-amber-500/20 bg-amber-500/8 px-4 py-3">
            <p className="text-sm font-medium text-amber-100">Use unverified token?</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
              {needsUnverifiedConfirm.symbol} is not in the curated list. Only continue if you trust this contract.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmUnverified}
                className="rounded-xl bg-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/35"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setNeedsUnverifiedConfirm(null)}
                className="rounded-xl px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/6"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
