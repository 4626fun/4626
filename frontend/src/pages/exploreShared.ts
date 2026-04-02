import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const IPFS_GATEWAY = 'https://ipfs.decentralized-content.com/ipfs/'
const BASENAME_SUFFIX = '.base.eth'

type ExploreSearchableCoin = {
  name?: string | null
  symbol?: string | null
  address?: string | null
  creatorAddress?: string | null
  payoutRecipientAddress?: string | null
  creatorProfile?: {
    handle?: string | null
  } | null
}

type CoinSearchMatchOptions = {
  includeCreatorAddress?: boolean
  includePayoutAddress?: boolean
  includeQueryVariants?: boolean
  includeHandleBasenameVariant?: boolean
}

type ExplorePageNode<TNode> = {
  node?: TNode | null
}

type ExplorePage<TNode> = {
  edges?: Array<ExplorePageNode<TNode> | null | undefined> | null
}

type ExploreSearchParamSetter = (nextInit: URLSearchParams, navigateOpts?: { replace?: boolean }) => void
type ExploreSubnavParamsOptions<TSort extends string, TTime extends string> = {
  sortValues: readonly TSort[]
  defaultSort: TSort
  sortAliases?: Readonly<Record<string, TSort>>
  timeValues: readonly TTime[]
  defaultTime: TTime
  timeAliases?: Readonly<Record<string, TTime>>
  searchParamKey?: string
}

export function normalizeCoinSearchQuery(query: string): {
  raw: string
  withoutAt: string
  withoutBasenameSuffix: string
} {
  const raw = query.trim().toLowerCase()
  const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw
  const withoutBasenameSuffix = withoutAt.endsWith(BASENAME_SUFFIX)
    ? withoutAt.slice(0, -BASENAME_SUFFIX.length)
    : withoutAt
  return { raw, withoutAt, withoutBasenameSuffix }
}

export function matchesCoinSearchQuery(
  coin: ExploreSearchableCoin,
  query: string,
  options: CoinSearchMatchOptions = {},
): boolean {
  const normalized = normalizeCoinSearchQuery(query)
  if (!normalized.raw) return true

  const candidates = options.includeQueryVariants
    ? Array.from(new Set([normalized.raw, normalized.withoutAt, normalized.withoutBasenameSuffix].filter(Boolean)))
    : [normalized.raw]

  const creatorHandle = (coin.creatorProfile?.handle || '').toLowerCase()
  const creatorHandleWithoutBasename = creatorHandle.endsWith(BASENAME_SUFFIX)
    ? creatorHandle.slice(0, -BASENAME_SUFFIX.length)
    : creatorHandle

  const fields = [
    (coin.name || '').toLowerCase(),
    (coin.symbol || '').toLowerCase(),
    (coin.address || '').toLowerCase(),
    creatorHandle,
  ]

  if (options.includeHandleBasenameVariant) fields.push(creatorHandleWithoutBasename)
  if (options.includeCreatorAddress) fields.push((coin.creatorAddress || '').toLowerCase())
  if (options.includePayoutAddress) fields.push((coin.payoutRecipientAddress || '').toLowerCase())

  return candidates.some((candidate) => fields.some((field) => field.includes(candidate)))
}

export function normalizeExploreOption<TValue extends string>(
  value: string | null | undefined,
  allowed: readonly TValue[],
  fallback: TValue,
  aliases?: Readonly<Record<string, TValue>>,
): TValue {
  if (!value) return fallback
  const mapped = aliases?.[value] ?? value
  if (allowed.includes(mapped as TValue)) return mapped as TValue
  return fallback
}

export function setExploreSearchParam(
  searchParams: URLSearchParams,
  setSearchParams: ExploreSearchParamSetter,
  key: string,
  value: string,
): boolean {
  if (searchParams.get(key) === value) return false
  const next = new URLSearchParams(searchParams)
  next.set(key, value)
  setSearchParams(next, { replace: true })
  return true
}

export function setExploreSearchQueryParam(
  searchParams: URLSearchParams,
  setSearchParams: ExploreSearchParamSetter,
  query: string,
  key = 'q',
): boolean {
  const normalizedQuery = query.trim()
  const current = (searchParams.get(key) ?? '').trim()
  if (current === normalizedQuery) return false
  const next = new URLSearchParams(searchParams)
  if (normalizedQuery) next.set(key, normalizedQuery)
  else next.delete(key)
  setSearchParams(next, { replace: true })
  return true
}

export function useExploreSubnavParams<TSort extends string, TTime extends string>(
  options: ExploreSubnavParamsOptions<TSort, TTime>,
): {
  currentSort: TSort
  currentTimeFilter: TTime
  searchQuery: string
  handleSortChange: (sort: string) => void
  handleTimeFilterChange: (timeFilter: string) => void
  handleSearchChange: (query: string) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamKey = options.searchParamKey ?? 'q'

  const currentSort = normalizeExploreOption(
    searchParams.get('sort'),
    options.sortValues,
    options.defaultSort,
    options.sortAliases,
  )
  const currentTimeFilter = normalizeExploreOption(
    searchParams.get('time'),
    options.timeValues,
    options.defaultTime,
    options.timeAliases,
  )

  const handleSortChange = useCallback(
    (sort: string) => {
      const normalizedSort = normalizeExploreOption(sort, options.sortValues, options.defaultSort, options.sortAliases)
      setExploreSearchParam(searchParams, setSearchParams, 'sort', normalizedSort)
    },
    [options.defaultSort, options.sortAliases, options.sortValues, searchParams, setSearchParams],
  )

  const handleTimeFilterChange = useCallback(
    (timeFilter: string) => {
      const normalizedTime = normalizeExploreOption(
        timeFilter,
        options.timeValues,
        options.defaultTime,
        options.timeAliases,
      )
      setExploreSearchParam(searchParams, setSearchParams, 'time', normalizedTime)
    },
    [options.defaultTime, options.timeAliases, options.timeValues, searchParams, setSearchParams],
  )

  const handleSearchChange = useCallback(
    (query: string) => {
      setExploreSearchQueryParam(searchParams, setSearchParams, query, searchParamKey)
    },
    [searchParamKey, searchParams, setSearchParams],
  )

  return {
    currentSort,
    currentTimeFilter,
    searchQuery: searchParams.get(searchParamKey) ?? '',
    handleSortChange,
    handleTimeFilterChange,
    handleSearchChange,
  }
}

export function useDebouncedValue<TValue>(value: TValue, delayMs: number): TValue {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), Math.max(0, delayMs))
    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return debounced
}

export function flattenExplorePagedNodes<TNode>(
  pages: Array<ExplorePage<TNode> | null | undefined> | null | undefined,
  options: {
    filter?: (node: TNode) => boolean
  } = {},
): TNode[] {
  if (!pages?.length) return []
  const flattened: TNode[] = []
  for (const page of pages) {
    if (!page?.edges?.length) continue
    for (const edge of page.edges) {
      const node = edge?.node
      if (!node) continue
      if (options.filter && !options.filter(node)) continue
      flattened.push(node)
    }
  }
  return flattened
}

export function isSupportedExploreChain(chain: string): boolean {
  return chain.toLowerCase() === 'base'
}

export function toDisplayAssetUrl(value?: string): string | undefined {
  const normalized = value?.trim()
  if (!normalized) return undefined
  if (normalized.startsWith('ipfs://')) {
    const path = normalized.slice('ipfs://'.length).replace(/^ipfs\//, '').replace(/^\/+/, '')
    if (!path) return undefined
    return `${IPFS_GATEWAY}${path}`
  }
  return normalized
}

export function formatShortAddress(value: string | null | undefined, fallback = '-'): string {
  if (!value) return fallback
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  if (value < 0.01) return `$${value.toFixed(6)}`
  return `$${value.toFixed(2)}`
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toLocaleString()
}

export function formatTimestamp(ts: number): string {
  const ms = ts < 1_000_000_000_000 ? ts * 1000 : ts
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateLabel(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTokenAmount(value: number): string {
  const abs = Math.abs(value)
  if (!Number.isFinite(abs) || abs === 0) return '0'
  if (abs < 0.0001) return abs.toExponential(2)
  if (abs < 1) return abs.toFixed(6)
  if (abs < 1000) return abs.toFixed(4)
  return abs.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
