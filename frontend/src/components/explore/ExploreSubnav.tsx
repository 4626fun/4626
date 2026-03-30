import { Search } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useUniswapServiceStatus } from '@/lib/uniswap/hooks'

type Tab = {
  label: string
  to: string
}

const TABS: Tab[] = [
  { label: 'Creators', to: '/explore/creators' },
  { label: 'Content', to: '/explore/content' },
  { label: 'Trends', to: '/explore/trends' },
  { label: 'Transactions', to: '/explore/transactions' },
]

// Zora explore volume is 24h or all-time (`totalVolume`); 1W is labeled honestly in copy when selected.
// Pill availability: 1D always; others when Uniswap historical service is configured (see useUniswapServiceStatus).
const TIME_FILTERS = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: 'All-time', value: '1y' },
] as const

const SORT_OPTIONS = [
  { label: 'Volume', value: 'volume' },
  { label: 'Market cap', value: 'marketCap' },
  { label: 'Price change', value: 'priceChange' },
  { label: 'Recently added', value: 'new' },
] as const

function isActive(pathname: string, to: string): boolean {
  if (pathname === to) return true
  return pathname.startsWith(`${to}/`)
}

export function ExploreSubnav({
  searchPlaceholder = 'Search tokens',
  onSearch,
  onTimeFilterChange,
  onSortChange,
  currentTimeFilter = '1d',
  currentSort = 'volume',
  volumeColumnNote = null,
}: {
  searchPlaceholder?: string
  onSearch?: (query: string) => void
  onTimeFilterChange?: (filter: string) => void
  onSortChange?: (sort: string) => void
  currentTimeFilter?: string
  currentSort?: string
  /** Explains how Zora explore volume relates to the selected time pill (API has no 1H–1M windows; 1Y uses all-time). */
  volumeColumnNote?: string | null
}) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Check if Uniswap historical data service is available
  const { data: uniswapStatus } = useUniswapServiceStatus()
  const uniswapAvailable = uniswapStatus?.available === true

  const handleTimeFilterClick = (value: string) => {
    if (onTimeFilterChange) {
      onTimeFilterChange(value)
    }
    const newParams = new URLSearchParams(searchParams)
    newParams.set('time', value)
    setSearchParams(newParams, { replace: true })
  }

  const handleSortClick = (value: string) => {
    if (onSortChange) {
      onSortChange(value)
    }
    const newParams = new URLSearchParams(searchParams)
    newParams.set('sort', value)
    setSearchParams(newParams, { replace: true })
  }

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* Main navigation row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide rounded-full border border-white/8 bg-black/20 p-0.5">
          {TABS.map((tab) => {
            const active = isActive(location.pathname, tab.to)
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border text-[13px] sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  active
                    ? 'border-brand-primary/35 bg-brand-primary/14 text-white shadow-[0_10px_22px_-16px_rgba(0,82,255,0.88)]'
                    : 'border-transparent text-zinc-400 hover:text-white hover:border-white/10 hover:bg-white/7'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full sm:w-[260px] h-9 sm:h-10 rounded-full border border-white/12 bg-linear-to-b from-white/7 to-white/3 pl-9 sm:pl-10 pr-4 text-[13px] sm:text-sm text-white placeholder:text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/30"
              aria-label="Search"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>

          <div className="flex flex-col items-start gap-1.5">
            {/* Time filter pills */}
            <div className="w-fit self-start sm:self-auto flex items-center gap-0.5 sm:gap-1 h-8 sm:h-9 rounded-full border border-white/12 bg-linear-to-b from-white/7 to-white/3 p-0.5">
              {TIME_FILTERS.map((filter) => {
                const active = currentTimeFilter === filter.value
                const isAvailable = filter.value === '1d' || uniswapAvailable
                const disabled = !isAvailable
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => !disabled && handleTimeFilterClick(filter.value)}
                    disabled={disabled}
                    title={disabled ? 'Requires THEGRAPH_API_KEY - Uniswap V4 historical data' : `View ${filter.label} data`}
                    className={`h-6 sm:h-7 px-2 sm:px-2.5 rounded-full border text-[10px] sm:text-[11px] font-medium leading-none transition-all duration-200 ${
                      active
                        ? 'border-blue-300/35 bg-blue-500/20 text-blue-100 shadow-[0_8px_20px_-14px_rgba(59,130,246,0.9)]'
                        : disabled
                          ? 'border-transparent text-zinc-600 cursor-not-allowed'
                          : 'border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/7 hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>
            {volumeColumnNote ? (
              <p className="text-[11px] text-zinc-500 max-w-md leading-snug">{volumeColumnNote}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Sort options row — visible below lg, horizontally scrollable */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden -mx-1 px-1">
        <span className="text-[11px] sm:text-xs text-zinc-500 shrink-0">Sort:</span>
        {SORT_OPTIONS.map((option) => {
          const active = currentSort === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSortClick(option.value)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border text-[11px] sm:text-xs font-medium transition-all duration-200 whitespace-nowrap active:scale-[0.97] ${
                active
                  ? 'border-brand-primary/35 bg-brand-primary/14 text-white shadow-[0_10px_22px_-16px_rgba(0,82,255,0.88)]'
                  : 'border-transparent text-zinc-400 hover:text-white hover:border-white/10 hover:bg-white/7'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

