import { Check, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { useQueries } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { erc20Abi, isAddress, type Address } from 'viem'

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
import { isOpaqueInternalTokenLabel } from '@/lib/swap/swapTokenLabels'
import { BASE_CHAIN_ID, NATIVE_TOKEN_ADDRESS, shortAddress, type TokenDisplay, type TokenOption } from '@/lib/uniswap/swapUtils'

export type SwapTokenOption = TokenOption & {
  sectionTag?: 'core' | 'creator' | 'content'
  verified?: boolean
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

const ADDRESS_METADATA_CACHE_KEY = 'swap.addressMetadataCache.v1'
const QUICK_PICK_SYMBOLS = ['ETH', 'WETH', 'USDC', 'USDT', 'CBBTC', 'ZORA'] as const

function matchesQuickPickSymbol(symbol: string): boolean {
  const upper = symbol.trim().toUpperCase()
  return QUICK_PICK_SYMBOLS.some((candidate) => candidate === upper)
}
const MAX_BALANCE_LOOKUPS = 18

type TokenSelectorModalProps = {
  open: boolean
  query: string
  tokenOptions: SwapTokenOption[]
  selectedToken: string
  recentTokenAddresses: string[]
  chainId?: SupportedChainId
  balanceOwnerAddress?: Address | null
  zoraHoldingOptions?: SwapTokenOption[]
  zoraHoldingBalances?: Record<string, string>
  zoraHoldingsLoading?: boolean
  isSearchLoading?: boolean
  onQueryChange: (value: string) => void
  onClose: () => void
  onSelect: (option: SwapTokenOption) => void
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

function tokenSection(option: SwapTokenOption): 'core' | 'creator' | 'content' {
  if (option.sectionTag === 'creator') return 'creator'
  if (option.sectionTag === 'content') return 'content'
  if (option.group === 'core') return 'core'
  return 'content'
}

function formatSectionLabel(section: string): string {
  switch (section) {
    case 'Recently used':
      return 'Recent'
    case 'Your Zora creator coins':
      return 'Your Zora creator coins'
    case 'Your Zora content coins':
      return 'Your Zora content coins'
    case 'Curated top tokens':
      return 'Popular tokens'
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

function NetworkChip({ chainId }: { chainId: SupportedChainId }) {
  const meta = getChainMeta(chainId)
  if (!meta) return null
  return (
    <div
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.04] px-2.5"
      title={meta.name}
    >
      <img src={meta.logoUrl} alt="" className="h-5 w-5 rounded-md object-cover" />
      <span className="text-xs font-medium text-zinc-300">{meta.shortName}</span>
    </div>
  )
}

function TokenSelectorRow(props: {
  option: SwapTokenOption
  isActive: boolean
  isSelected: boolean
  balanceLabel?: string | null
  chainLogoUrl?: string
  onChoose: () => void
  onHover: () => void
}) {
  const { option, isActive, isSelected, balanceLabel, chainLogoUrl, onChoose, onHover } = props
  const isUnverified = option.verified === false
  const showAddressHint = isUnverified || option.sectionTag === 'creator' || option.sectionTag === 'content'
  const subtitleName =
    option.name &&
    option.name.toLowerCase() !== option.symbol.toLowerCase() &&
    !isOpaqueInternalTokenLabel(option.name)
      ? option.name
      : option.sectionTag === 'creator'
        ? 'Creator coin'
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
        />
        {chainLogoUrl ? (
          <img
            src={chainLogoUrl}
            alt=""
            className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-[5px] border border-[#131313] bg-[#131313] object-cover"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-white">{option.symbol}</span>
          {option.sectionTag === 'creator' ? (
            <span className="shrink-0 rounded-md bg-brand-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-200">
              Creator
            </span>
          ) : null}
          {option.sectionTag === 'content' ? (
            <span className="shrink-0 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-200">
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

      <div className="flex shrink-0 flex-col items-end gap-0.5 pl-1">
        {balanceLabel ? (
          <span className="text-sm font-medium tabular-nums text-zinc-200">{balanceLabel}</span>
        ) : null}
        {isSelected ? <Check className="h-4 w-4 text-brand-primary" strokeWidth={2.5} /> : null}
      </div>
    </button>
  )
}

export function TokenSelectorModal({
  open,
  query,
  tokenOptions,
  selectedToken,
  recentTokenAddresses,
  chainId,
  balanceOwnerAddress,
  zoraHoldingOptions = [],
  zoraHoldingBalances = {},
  zoraHoldingsLoading = false,
  isSearchLoading = false,
  onQueryChange,
  onClose,
  onSelect,
}: TokenSelectorModalProps) {
  const [debouncedQuery] = useDebounceValue(query, 250)
  const trimmedQuery = debouncedQuery.trim()
  const isAddressSearch = isAddressLike(trimmedQuery)

  const [addressLookupError, setAddressLookupError] = useState<string | null>(null)
  const [needsUnverifiedConfirm, setNeedsUnverifiedConfirm] = useState<SwapTokenOption | null>(null)
  const [addressCandidate, setAddressCandidate] = useState<AddressCandidate | null>(null)
  const [addressLookupLoading, setAddressLookupLoading] = useState(false)
  const [addressLookupAttempt, setAddressLookupAttempt] = useState(0)
  const [addressMetadataCache, setAddressMetadataCache] = useState<Record<string, AddressMetadataCacheEntry>>({})

  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const publicClient = usePublicClient({ chainId: chainId ?? undefined })
  const isAddressSearchActive = isAddressSearch && Boolean(trimmedQuery)
  const chainIdForLookup = toSupportedChainId(chainId, BASE_CHAIN_ID as SupportedChainId)
  const chainMeta = getChainMeta(chainIdForLookup)
  const tokenAddressMetadata = useTokenMetadata(
    isAddressSearchActive && trimmedQuery ? (trimmedQuery as `0x${string}`) : undefined,
  )

  const matchedTokens = useMemo(() => {
    const filtered = tokenOptions.filter((option) => tokenMatches(option, trimmedQuery))
    const filteredHoldings = zoraHoldingOptions.filter((option) => tokenMatches(option, trimmedQuery))
    if (!isAddressSearch || !trimmedQuery) {
      const holdingAddresses = new Set(filteredHoldings.map((option) => option.address.toLowerCase()))
      const holdingsCreator = filteredHoldings.filter(
        (o) => o.sectionTag === 'creator' || (o.group === 'creator' && o.sectionTag !== 'content'),
      )
      const holdingsContent = filteredHoldings.filter((o) => o.sectionTag === 'content' || o.group === 'share')
      return {
        holdingsCreator,
        holdingsContent,
        core: filtered.filter((o) => tokenSection(o) === 'core'),
        creator: filtered.filter(
          (o) => tokenSection(o) === 'creator' && !holdingAddresses.has(o.address.toLowerCase()),
        ),
        content: filtered.filter((o) => tokenSection(o) === 'content'),
        recent: recentTokenAddresses
          .map((recentAddress) => {
            const key = recentAddress.toLowerCase()
            if (holdingAddresses.has(key)) return null
            return (
              filtered.find((option) => option.address.toLowerCase() === key) ??
              filteredHoldings.find((option) => option.address.toLowerCase() === key) ??
              null
            )
          })
          .filter((option): option is SwapTokenOption => option != null),
      }
    }
    return { holdingsCreator: [], holdingsContent: [], core: [], creator: [], content: [], recent: [] }
  }, [isAddressSearch, tokenOptions, trimmedQuery, recentTokenAddresses, zoraHoldingOptions])

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

      const cacheKey = `${chainIdForLookup}:${trimmedQuery.toLowerCase()}`
      const cached = addressMetadataCache[cacheKey]
      if (cached) {
        const cachedChainId = toSupportedChainId(cached.chainId, chainIdForLookup)
        setAddressCandidate({
          address: trimmedQuery as `0x${string}`,
          chainId: cachedChainId,
          symbol: cached.symbol,
          name: cached.name,
          decimals: cached.decimals,
          logoUrl: cached.logoUrl ?? null,
          logoUrls: [],
        })
        setAddressLookupLoading(false)
        return
      }

      setAddressLookupLoading(true)
      setAddressLookupError(null)
      try {
        const tokenAddress = trimmedQuery as `0x${string}`
        const [nameResult, symbolResult, decimalsResult] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'name',
          }).catch(() => null),
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'symbol',
          }).catch(() => null),
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'decimals',
          }).catch(() => 18),
        ])

        if (cancelled) return

        const name =
          typeof nameResult === 'string' && nameResult.trim() ? nameResult.trim() : `Token ${trimmedQuery.slice(0, 6)}`
        const symbol = typeof symbolResult === 'string' && symbolResult.trim() ? symbolResult.trim() : 'TOKEN'
        const decimals = Number(decimalsResult)

        setAddressCandidate({
          address: tokenAddress,
          chainId: chainIdForLookup,
          symbol,
          name,
          decimals: Number.isFinite(decimals) ? decimals : 18,
          logoUrl: tokenAddressMetadata.imageUrl ?? null,
          logoUrls: [],
        })
        const newEntry: AddressMetadataCacheEntry = {
          chainId: chainIdForLookup,
          symbol,
          name,
          decimals: Number.isFinite(decimals) ? decimals : 18,
          logoUrl: tokenAddressMetadata.imageUrl ?? null,
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
    chainIdForLookup,
    isAddressSearch,
    open,
    publicClient,
    trimmedQuery,
    tokenAddressMetadata.imageUrl,
    addressMetadataCache,
  ])

  useEffect(() => {
    setAddressLookupError(null)
    setNeedsUnverifiedConfirm(null)
    setAddressCandidate(null)
  }, [trimmedQuery])

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
    matchedTokens.holdingsCreator.forEach((option) => {
      const key = option.address.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      list.push({ option, section: 'Your Zora creator coins' })
    })
    matchedTokens.holdingsContent.forEach((option) => {
      const key = option.address.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      list.push({ option, section: 'Your Zora content coins' })
    })
    matchedTokens.recent.forEach((option) => {
      const key = option.address.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      list.push({ option, section: 'Recently used' })
    })
    matchedTokens.core.forEach((option) => {
      const key = option.address.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      list.push({ option, section: 'Curated top tokens' })
    })
    matchedTokens.creator.forEach((option) => {
      const key = option.address.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      list.push({ option, section: 'Creator coins' })
    })
    matchedTokens.content.forEach((option) => {
      const key = option.address.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      list.push({ option, section: 'Content coins' })
    })
    return list
  }, [addressCandidate, chainIdForLookup, isAddressSearchActive, matchedTokens])

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
    zoraHoldingOptions.forEach((option) => push(option.address))
    quickPickTokens.forEach((option) => push(option.address))
    rows.slice(0, MAX_BALANCE_LOOKUPS).forEach(({ option }) => push(option.address))
    return addresses.slice(0, MAX_BALANCE_LOOKUPS)
  }, [balanceOwnerAddress, chainIdForLookup, quickPickTokens, rows, zoraHoldingOptions])

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

  useEffect(() => {
    if (!open) return
    searchInputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (activeIndex >= rows.length) setActiveIndex(0)
  }, [activeIndex, rows.length])

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (!open) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((prev) => (prev + 1) % Math.max(1, rows.length))
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((prev) => (prev - 1 + Math.max(1, rows.length)) % Math.max(1, rows.length))
      }
      if (event.key === 'Enter' && rows[activeIndex]) {
        event.preventDefault()
        const option = rows[activeIndex].option
        if (option.verified === false) {
          setNeedsUnverifiedConfirm(option)
          return
        }
        onSelect(option)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeIndex, onSelect, open, rows])

  useEffect(() => {
    const active = rows[activeIndex]
    if (!active) return
    const selector = `[data-token-row="${active.option.address.toLowerCase()}"]`
    const node = listRef.current?.querySelector<HTMLButtonElement>(selector)
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex, rows])

  function choose(option: SwapTokenOption) {
    if (option.verified === false) {
      setNeedsUnverifiedConfirm(option)
      return
    }
    onSelect(option)
    onClose()
  }

  function confirmUnverified() {
    if (!needsUnverifiedConfirm) return
    onSelect(needsUnverifiedConfirm)
    setNeedsUnverifiedConfirm(null)
    onClose()
  }

  function retryAddressLookup() {
    setAddressLookupError(null)
    setAddressLookupAttempt((attempt) => attempt + 1)
  }

  const listLoading =
    (isSearchLoading && Boolean(trimmedQuery) && !isAddressSearchActive) ||
    (zoraHoldingsLoading && !trimmedQuery && zoraHoldingOptions.length === 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select a token"
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
                placeholder="Search tokens"
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

          {quickPickTokens.length > 0 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    />
                    {chainMeta?.logoUrl ? (
                      <img
                        src={chainMeta.logoUrl}
                        alt=""
                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-[4px] border border-[#131313] bg-[#131313]"
                      />
                    ) : null}
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-200">{option.symbol}</span>
                </button>
              ))}
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

          {!listLoading && rows.length === 0 && !addressLookupLoading ? (
            <div className="py-14 text-center">
              <p className="text-sm font-medium text-zinc-300">No tokens found</p>
              <p className="mt-1 text-xs text-zinc-500">Try a symbol, creator handle, or 0x address</p>
            </div>
          ) : null}

          {!listLoading && zoraHoldingsLoading && !trimmedQuery && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
              <Spinner size="sm" />
              Loading your Zora coins…
            </div>
          ) : null}

          {!listLoading
            ? rows.map(({ option, section }, idx) => {
                const isActive = activeIndex === idx
                const isSelected = option.address.toLowerCase() === selectedToken.toLowerCase()
                const showSectionHeader = idx === 0 || rows[idx - 1]?.section !== section
                return (
                  <div key={`${section}-${option.address}`}>
                    {showSectionHeader ? (
                      <div className="sticky top-0 z-[1] bg-[#131313]/95 px-2 pb-1 pt-2 text-[11px] font-medium text-zinc-500 backdrop-blur-sm">
                        {formatSectionLabel(section)}
                      </div>
                    ) : null}
                    <TokenSelectorRow
                      option={option}
                      isActive={isActive}
                      isSelected={isSelected}
                      balanceLabel={
                        balanceByAddress.get(option.address.toLowerCase()) ??
                        zoraHoldingBalances[option.address.toLowerCase()] ??
                        null
                      }
                      chainLogoUrl={chainMeta?.logoUrl}
                      onChoose={() => choose(option)}
                      onHover={() => setActiveIndex(idx)}
                    />
                  </div>
                )
              })
            : null}
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
