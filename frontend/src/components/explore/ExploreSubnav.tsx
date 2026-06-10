import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { useUniswapServiceStatus } from '@/lib/uniswap/hooks'
import { ExploreTabNav } from '@/components/explore/ExploreTabNav'

type ExploreTimeFilterOption = {
  label: string
  value: string
}

type ExploreSortOption = {
  label: string
  value: string
}

// Zora explore volume is 24h or all-time (`totalVolume`); 1W is labeled honestly in copy when selected.
// Pill availability: 1D always; others when Uniswap historical service is configured (see useUniswapServiceStatus).
const DEFAULT_TIME_FILTERS: readonly ExploreTimeFilterOption[] = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: 'All-time', value: '1y' },
]

const DEFAULT_SORT_OPTIONS: readonly ExploreSortOption[] = [
  { label: 'Volume', value: 'volume' },
  { label: 'Market cap', value: 'marketCap' },
  { label: 'Price change', value: 'priceChange' },
  { label: 'Recently added', value: 'new' },
]

export function applyExploreParamChange({
  value,
  currentValue,
  onChange,
}: {
  value: string
  currentValue: string
  onChange?: (value: string) => void
}) {
  if (!onChange) return
  if (currentValue === value) return
  onChange(value)
}

export function ExploreSubnav({
  searchPlaceholder = 'Search tokens',
  searchValue,
  onSearch,
  onTimeFilterChange,
  onSortChange,
  currentTimeFilter = '1d',
  currentSort = 'volume',
  volumeColumnNote = null,
  timeFilters = DEFAULT_TIME_FILTERS,
  sortOptions = DEFAULT_SORT_OPTIONS,
  disableUniswapTimeGating = false,
  extraFilters,
  showSearch = true,
  showMobileSortRow = true,
  showTabs = true,
}: {
  searchPlaceholder?: string
  searchValue?: string
  onSearch?: (query: string) => void
  onTimeFilterChange?: (filter: string) => void
  onSortChange?: (sort: string) => void
  currentTimeFilter?: string
  currentSort?: string
  /** Explains how Zora explore volume relates to the selected time pill (API has no 1H–1M windows; 1Y uses all-time). */
  volumeColumnNote?: string | null
  timeFilters?: readonly ExploreTimeFilterOption[]
  sortOptions?: readonly ExploreSortOption[]
  disableUniswapTimeGating?: boolean
  extraFilters?: ReactNode
  showSearch?: boolean
  showMobileSortRow?: boolean
  /** When false, tab links render in ExploreListLayout instead (list routes only). */
  showTabs?: boolean
}) {
  // Check if Uniswap historical data service is available
  const { data: uniswapStatus } = useUniswapServiceStatus()
  const uniswapAvailable = uniswapStatus?.available === true

  const handleTimeFilterClick = (value: string) => {
    applyExploreParamChange({
      value,
      currentValue: currentTimeFilter,
      onChange: onTimeFilterChange,
    })
  }

  const handleSortClick = (value: string) => {
    applyExploreParamChange({
      value,
      currentValue: currentSort,
      onChange: onSortChange,
    })
  }

  const showTimeFilter = timeFilters.length > 1

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        {showTabs ? <ExploreTabNav /> : null}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 lg:ml-auto">
          {showSearch ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                className="w-full sm:w-[260px] h-9 sm:h-10 rounded-full border border-white/12 bg-linear-to-b from-white/7 to-white/3 pl-9 sm:pl-10 pr-4 text-[13px] sm:text-sm text-white placeholder:text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/30"
                aria-label="Search"
                onChange={(e) => onSearch?.(e.target.value)}
              />
            </div>
          ) : null}

          {showTimeFilter ? (
            <div className="flex flex-col items-start gap-1.5">
              <div className="w-fit self-start sm:self-auto">
                <select
                  value={currentTimeFilter}
                  onChange={(event) => handleTimeFilterClick(event.target.value)}
                  className="h-8 sm:h-9 rounded-lg border border-white/12 bg-linear-to-b from-white/7 to-white/3 px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-medium text-zinc-200 focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/30"
                  aria-label="Time range"
                >
                  {timeFilters.map((filter) => {
                    const isAvailable = disableUniswapTimeGating || filter.value === '1d' || uniswapAvailable
                    return (
                      <option
                        key={filter.value}
                        value={filter.value}
                        disabled={!isAvailable}
                      >
                        {filter.label}
                        {!isAvailable ? ' (Unavailable)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
              {volumeColumnNote ? (
                <p className="text-[11px] text-zinc-500 max-w-md leading-snug">{volumeColumnNote}</p>
              ) : null}
            </div>
          ) : null}
          {extraFilters ? <div className="flex items-center">{extraFilters}</div> : null}
        </div>
      </div>

      {showMobileSortRow ? (
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden -mx-1 px-1">
          <span className="text-[11px] sm:text-xs text-zinc-500 shrink-0">Sort:</span>
          {sortOptions.map((option) => {
            const active = currentSort === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSortClick(option.value)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border text-[11px] sm:text-xs font-medium transition-all duration-200 whitespace-nowrap active:scale-[0.97] ${
                  active
                    ? 'border-brand-primary/35 bg-brand-primary/14 text-white shadow-[0_10px_22px_-16px_rgb(var(--brand-primary)/0.88)]'
                    : 'border-transparent text-zinc-400 hover:text-white hover:border-white/10 hover:bg-white/7'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
