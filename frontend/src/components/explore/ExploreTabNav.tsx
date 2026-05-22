import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { label: 'Creators', to: '/explore/creators' },
  { label: 'Content', to: '/explore/content' },
  { label: 'Vaults', to: '/explore/vaults' },
  { label: 'Trends', to: '/explore/trends' },
  { label: 'Transactions', to: '/explore/transactions' },
] as const

function isActive(pathname: string, to: string): boolean {
  if (pathname === to) return true
  return pathname.startsWith(`${to}/`)
}

type ExploreTabNavProps = {
  className?: string
}

export function ExploreTabNav({ className }: ExploreTabNavProps) {
  const location = useLocation()

  return (
    <div className={className}>
      <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const active = isActive(location.pathname, tab.to)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={`py-1 text-[13px] sm:text-sm transition-colors duration-150 whitespace-nowrap ${
                active ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white font-medium'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
