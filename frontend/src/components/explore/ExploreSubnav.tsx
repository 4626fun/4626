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
  { label: 'Transactions', to: '/explore/transactions' },
]

// Base timeframes - availability depends on data source
const TIME_FILTERS = [
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '1Y', value: '1y' },
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
}: {
  searchPlaceholder?: string
  onSearch?: (query: string) => void
  onTimeFilterChange?: (filter: string) => void
  onSortChange?: (sort: string) => void
  currentTimeFilter?: string
  currentSort?: string
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
    <div className="space-y-2 sm:space-y-3">
      {/* Main navigation row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const active = isActive(location.pathname, tab.to)
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[13px] sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
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
              className="w-full sm:w-[260px] h-9 sm:h-10 pl-9 sm:pl-10 pr-4 bg-zinc-900 border border-zinc-800 rounded-full text-[13px] sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
              aria-label="Search"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>

          {/* Time filter pills */}
          <div className="w-fit self-start sm:self-auto flex items-center gap-0.5 sm:gap-1 h-8 sm:h-9 bg-zinc-900 border border-zinc-800 rounded-full p-0.5">
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
                  className={`h-6 sm:h-7 px-2 sm:px-2.5 rounded-full text-[10px] sm:text-[11px] font-medium leading-none transition-colors ${
                    active
                      ? 'bg-zinc-700 text-white'
                      : disabled
                        ? 'text-zinc-600 cursor-not-allowed'
                        : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sort options row — visible below lg, horizontally scrollable */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden -mx-1 px-1">
        <span className="text-[11px] sm:text-xs text-zinc-500 flex-shrink-0">Sort:</span>
        {SORT_OPTIONS.map((option) => {
          const active = currentSort === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSortClick(option.value)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap active:scale-[0.97] ${
                active
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
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

