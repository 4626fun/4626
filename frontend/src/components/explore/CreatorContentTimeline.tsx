import { useMemo } from 'react'
import { Image as ImageIcon } from 'lucide-react'

import type { ZoraCoin } from '@/lib/zora/types'
import { cn } from '@/lib/shared/utils'

import { buildTimelineEntries, type TimelineDateParts } from './creatorContentTimelineHelpers'

type CreatorContentTimelineProps = {
  coins: ZoraCoin[]
  getImage: (coin: ZoraCoin) => string | undefined
  onSelect: (coin: ZoraCoin) => void
}

function TimelineCard({
  coin,
  image,
  onSelect,
  side,
}: {
  coin: ZoraCoin
  image?: string
  onSelect: (coin: ZoraCoin) => void
  side: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(coin)}
      className={cn(
        'group w-full rounded-2xl border border-black/15 bg-white/75 p-4 sm:p-5 text-left shadow-[0_14px_36px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:border-black/25 hover:bg-white/90 hover:shadow-[0_18px_44px_rgba(0,0,0,0.14)]',
        side === 'left' ? 'md:mr-3' : 'md:ml-3',
      )}
    >
      {image ? (
        <div className="mb-4 aspect-[4/3] w-full overflow-hidden bg-zinc-100">
          <img
            src={image}
            alt={coin.name || coin.symbol || 'Content coin'}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
      ) : (
        <div className="mb-4 flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 text-zinc-500">
          <ImageIcon className="h-5 w-5" aria-hidden />
        </div>
      )}
      <div className="text-lg font-medium leading-tight text-zinc-900">{coin.name || coin.symbol || 'Untitled'}</div>
      <div className="mt-2 text-xs font-mono uppercase tracking-[1.4px] text-zinc-700">{coin.symbol || '???'}</div>
      <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-zinc-800 sm:text-sm">
        {(coin.description || 'Open tray for full content context.').trim()}
      </p>
    </button>
  )
}

function TimelineNode({ date }: { date: TimelineDateParts }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-1.5 px-1 text-center">
      <span
        className="h-4 w-4 rounded-full border-2 border-black/30 bg-white shadow-[0_0_0_5px_rgba(217,223,114,0.75)]"
        aria-hidden
      />
      <div className="min-w-[4.75rem] rounded-full border border-black/15 bg-white/90 px-2.5 py-1.5 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-900">{date.monthDay}</div>
        {date.relative ? (
          <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.08em] text-zinc-600">{date.relative}</div>
        ) : null}
      </div>
      <time className="sr-only" dateTime={date.timestamp ? new Date(date.timestamp).toISOString() : undefined}>
        {date.full}
      </time>
    </div>
  )
}

export function CreatorContentTimeline({ coins, getImage, onSelect }: CreatorContentTimelineProps) {
  const entries = useMemo(() => buildTimelineEntries(coins), [coins])

  if (entries.length === 0) {
    return (
      <div className="py-10 text-sm text-zinc-700 md:pl-14">
        No content coins available for timeline yet.
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-5xl px-2 sm:px-4 pb-4">
      <div
        className="pointer-events-none absolute left-4 top-3 bottom-3 w-px bg-gradient-to-b from-black/5 via-black/20 to-black/5 md:left-1/2 md:-translate-x-1/2"
        aria-hidden
      />

      <div className="flex flex-col gap-10 sm:gap-14">
        {entries.map((entry, index) => {
          const showYearHeader = index === 0 || entries[index - 1]?.year !== entry.year
          const image = getImage(entry.coin)
          const key = entry.coin.address || entry.coin.id || `${entry.year}-${index}`

          return (
            <section key={key} className="relative">
              {showYearHeader ? (
                <div className="relative mb-8 flex justify-start md:justify-center">
                  <div className="inline-flex items-center gap-3 rounded-full border border-black/15 bg-white/80 px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-800 shadow-sm md:mx-auto">
                    <span className="hidden h-px w-8 bg-black/20 md:inline-block" aria-hidden />
                    {entry.year}
                    <span className="hidden h-px w-8 bg-black/20 md:inline-block" aria-hidden />
                  </div>
                </div>
              ) : null}

              <article className={cn('relative', !showYearHeader && 'mt-0')}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-6">
                  <div className="hidden md:col-start-1 md:block">
                    {entry.side === 'left' ? (
                      <TimelineCard coin={entry.coin} image={image} onSelect={onSelect} side={entry.side} />
                    ) : null}
                  </div>

                  <div className="col-start-1 md:col-start-2">
                    <TimelineNode date={entry.date} />
                  </div>

                  <div className={cn('col-start-2 md:col-start-3', entry.side === 'left' && 'md:hidden')}>
                    <TimelineCard coin={entry.coin} image={image} onSelect={onSelect} side={entry.side} />
                  </div>
                </div>

                <p className="mt-3 pl-12 text-[11px] font-mono uppercase tracking-[0.08em] text-zinc-700 md:hidden">
                  {entry.date.full}
                </p>
              </article>
            </section>
          )
        })}
      </div>
    </div>
  )
}
