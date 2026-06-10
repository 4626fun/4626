import { cn } from '@/lib/shared/utils'

import { CREATOR_STATS_FINALE_NAV_LABEL } from './creatorStatsScrollNav'
import type { CreatorStatItem } from './creatorStatsModel'

type CreatorStatsScrollNavProps = {
  stats: CreatorStatItem[]
  activeIndex: number
  onSelect: (index: number) => void
  className?: string
}

export function CreatorStatsScrollNav({
  stats,
  activeIndex,
  onSelect,
  className,
}: CreatorStatsScrollNavProps) {
  const items = [
    ...stats.map((stat) => ({ key: stat.id, label: stat.label })),
    { key: 'finale', label: CREATOR_STATS_FINALE_NAV_LABEL },
  ]

  return (
    <nav
      aria-label="On-chain metric sections"
      className={cn(
        'pointer-events-auto flex flex-col items-center gap-3 sm:gap-3.5',
        'lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2 lg:items-end',
        className,
      )}
    >
      {items.map((item, index) => {
        const isActive = activeIndex === index
        return (
          <button
            key={item.key}
            type="button"
            aria-label={`Go to ${item.label}`}
            aria-current={isActive ? 'step' : undefined}
            title={item.label}
            onClick={() => onSelect(index)}
            className={cn(
              'group inline-flex items-center justify-end gap-2 rounded-full p-1.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
              isActive ? 'text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
            )}
          >
            <span
              className={cn(
                'block rounded-full transition-all duration-300',
                isActive
                  ? 'h-2 w-2 scale-100 bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]'
                  : 'h-1.5 w-1.5 bg-zinc-600 group-hover:bg-zinc-400',
              )}
              aria-hidden="true"
            />
          </button>
        )
      })}
    </nav>
  )
}
