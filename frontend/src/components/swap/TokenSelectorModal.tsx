import { Check, Search, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'
import { usePublicClient } from 'wagmi'
import { erc20Abi, isAddress } from 'viem'

import { TokenAvatar } from '@/components/swap/TokenAvatar'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { BASE_CHAIN_ID, type TokenDisplay, type TokenOption } from '@/lib/uniswap/swapUtils'

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

const ADDRESS_METADATA_CACHE_KEY = 'swap.addressMetadataCache.v1'

type TokenSelectorModalProps = {
  open: boolean
  query: string
  tokenOptions: SwapTokenOption[]
  selectedToken: string
  recentTokenAddresses: string[]
  chainId?: number
  onQueryChange: (value: string) => void
  onClose: () => void
  onSelect: (option: SwapTokenOption) => void
}

function tokenMatches(option: SwapTokenOption, query: string): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  return (
    option.symbol.toLowerCase().includes(q) ||
    option.name.toLowerCase().includes(q) ||
    option.address.toLowerCase().includes(q)
  )
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

export function TokenSelectorModal({
  open,
  query,
  tokenOptions,
  selectedToken,
  recentTokenAddresses,
  chainId,
  onQueryChange,
  onClose,
  onSelect,
}: TokenSelectorModalProps) {
  const [debouncedQuery] = useDebounceValue(query, 250)
  const trimmedQuery = debouncedQuery.trim()
  const isAddressSearch = isAddressLike(trimmedQuery)

  const [addressLookupError, setAddressLookupError] = useState<string | null>(null)
  const [needsUnverifiedConfirm, setNeedsUnverifiedConfirm] = useState<SwapTokenOption | null>(null)
  const [addressCandidate, setAddressCandidate] = useState<TokenDisplay | null>(null)
  const [addressLookupLoading, setAddressLookupLoading] = useState(false)
  const [addressLookupAttempt, setAddressLookupAttempt] = useState(0)
  const [addressMetadataCache, setAddressMetadataCache] = useState<Record<string, AddressMetadataCacheEntry>>({})

  const listRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const publicClient = usePublicClient({
    chainId: chainId ?? undefined,
  })
  const isAddressSearchActive = isAddressSearch && Boolean(trimmedQuery)
  const chainIdForLookup = chainId ?? BASE_CHAIN_ID
  const tokenAddressMetadata = useTokenMetadata(
    isAddressSearchActive && trimmedQuery ? (trimmedQuery as `0x${string}`) : undefined,
  )
  const matchedTokens = useMemo(() => {
    const filtered = tokenOptions.filter((option) => tokenMatches(option, trimmedQuery))
    if (!isAddressSearch || !trimmedQuery) {
      return {
        core: filtered.filter((o) => tokenSection(o) === 'core'),
        creator: filtered.filter((o) => tokenSection(o) === 'creator'),
        content: filtered.filter((o) => tokenSection(o) === 'content'),
        recent: filtered.filter((option) => recentTokenAddresses.includes(option.address.toLowerCase())),
      }
    }
    return { core: [], creator: [], content: [], recent: [] }
  }, [isAddressSearch, tokenOptions, trimmedQuery, recentTokenAddresses])

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
        setAddressCandidate({
          address: trimmedQuery as `0x${string}`,
          chainId: cached.chainId,
          symbol: cached.symbol,
          name: cached.name,
          decimals: cached.decimals,
          logoUrl: cached.logoUrl ?? undefined,
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

        const name = typeof nameResult === 'string' && nameResult.trim() ? nameResult.trim() : `Token ${trimmedQuery.slice(0, 6)}`
        const symbol = typeof symbolResult === 'string' && symbolResult.trim() ? symbolResult.trim() : 'TOKEN'
        const decimals = Number(decimalsResult)

        setAddressCandidate({
          address: tokenAddress,
          chainId: chainIdForLookup,
          symbol,
          name,
          decimals: Number.isFinite(decimals) ? decimals : 18,
          logoUrl: tokenAddressMetadata.imageUrl ?? undefined,
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
        if (!cancelled) {
          setAddressLookupLoading(false)
        }
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
          logoUrl: addressCandidate.logoUrl,
          logoUrls: addressCandidate.logoUrls,
        },
        section: 'Address search',
      })
      return list
    }

    const seen = new Set<string>()
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select token"
      className="max-h-[88vh] overflow-hidden"
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name, symbol, or 0x address"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-9 text-sm text-white placeholder:text-zinc-600 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isAddressSearchActive ? (
          <div className="rounded-xl border border-brand-primary/25 bg-brand-primary/8 p-3 text-sm text-brand-200">
            <div className="font-semibold">Found by address</div>
            <div className="text-[11px] text-zinc-400">Looking up metadata for {trimmedQuery}</div>
            {addressLookupLoading ? (
              <div className="mt-2 flex items-center gap-2 text-zinc-200">
                <Spinner size="sm" /> Fetching token metadata
              </div>
            ) : null}
            {addressLookupError ? (
              <div className="mt-2 space-y-2">
                <Alert variant="destructive" className="text-left">
                  {addressLookupError}
                </Alert>
                <button
                  type="button"
                  onClick={retryAddressLookup}
                  className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/20"
                >
                  Retry lookup
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={listRef} className="max-h-[45vh] overflow-y-auto pr-1">
          {rows.length === 0 && !addressLookupLoading ? (
            <div className="py-8 text-center text-sm text-zinc-500">No tokens found</div>
          ) : null}

          {rows.map(({ option, section }, idx) => {
            const isActive = activeIndex === idx
            const isSelected = option.address.toLowerCase() === selectedToken.toLowerCase()
            const isUnverified = option.verified === false
            const showSectionHeader = idx === 0 || rows[idx - 1]?.section !== section
            return (
              <div key={`${section}-${option.address}`}>
                {showSectionHeader ? <div className="mb-1 px-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{section}</div> : null}
                <motion.button
                  type="button"
                  data-token-row={option.address.toLowerCase()}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onFocus={() => setActiveIndex(idx)}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                    isSelected
                      ? 'border-brand-primary/35 bg-brand-primary/10 text-white'
                      : 'border-transparent text-zinc-200 hover:bg-white/5 hover:border-white/10',
                  )}
                >
                  <TokenAvatar token={{ address: option.address, chainId: option.chainId, logoUrl: option.logoUrl, logoUrls: option.logoUrls }} symbol={option.symbol} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{option.symbol}</div>
                      {option.sectionTag === 'creator' ? (
                        <span className="rounded-full border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 text-[9px] text-brand-200">Creator</span>
                      ) : null}
                      {option.sectionTag === 'content' ? (
                        <span className="rounded-full border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-200">Content</span>
                      ) : null}
                      {isUnverified ? (
                        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-200">Unverified</span>
                      ) : null}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {option.name}
                      <span className="ml-2">{isUnverified ? '· Not in curated list' : null}</span>
                    </div>
                  </div>
                  {isSelected ? <Check className="h-4 w-4 text-brand-primary" /> : null}
                </motion.button>
              </div>
            )
          })}
        </div>

        {needsUnverifiedConfirm ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/8 p-3 text-sm text-amber-200">
            <div className="font-semibold">Unverified token</div>
            <p className="mt-1 text-xs text-amber-100/90">
              {needsUnverifiedConfirm.symbol} is not part of curated tokens. Do you want to proceed and use it for this swap?
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={confirmUnverified}
                className="rounded-lg bg-amber-500/25 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/35"
              >
                I understand, continue
              </button>
              <button
                type="button"
                onClick={() => setNeedsUnverifiedConfirm(null)}
                className="rounded-lg border border-white/12 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/8"
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
