import type { ZoraCoin } from '@/lib/zora/types'

export type TimelineDateParts = {
  full: string
  weekday: string
  monthDay: string
  year: string
  relative: string
  timestamp: number | null
}

export type TimelineYearGroup = {
  year: string
  items: ZoraCoin[]
}

export type TimelineEntry = {
  coin: ZoraCoin
  side: 'left' | 'right'
  year: string
  date: TimelineDateParts
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function toTimestamp(value?: string | null): number | null {
  if (!value) return null
  const date = new Date(value)
  const ts = date.getTime()
  return Number.isNaN(ts) ? null : ts
}

export function formatTimelineDateParts(value?: string | null): TimelineDateParts {
  const timestamp = toTimestamp(value)
  if (timestamp == null) {
    return {
      full: 'Date unknown',
      weekday: '',
      monthDay: '--',
      year: '----',
      relative: '',
      timestamp: null,
    }
  }

  const date = new Date(timestamp)
  const full = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const year = date.toLocaleDateString('en-US', { year: 'numeric' })

  const diffMs = Date.now() - timestamp
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  let relative = ''
  if (Math.abs(diffDays) < 1) relative = 'Today'
  else if (Math.abs(diffDays) === 1) relative = diffDays > 0 ? 'Yesterday' : 'Tomorrow'
  else if (Math.abs(diffDays) < 28) relative = rtf.format(-diffDays, 'day')
  else if (Math.abs(diffDays) < 365) relative = rtf.format(-Math.round(diffDays / 30), 'month')
  else relative = rtf.format(-Math.round(diffDays / 365), 'year')

  return { full, weekday, monthDay, year, relative, timestamp }
}

export function groupTimelineCoinsByYear(coins: ZoraCoin[]): TimelineYearGroup[] {
  const order: string[] = []
  const grouped = new Map<string, ZoraCoin[]>()

  for (const coin of coins) {
    const { year } = formatTimelineDateParts(coin.createdAt)
    if (!grouped.has(year)) {
      grouped.set(year, [])
      order.push(year)
    }
    grouped.get(year)!.push(coin)
  }

  return order.map((year) => ({ year, items: grouped.get(year)! }))
}

export function resolveTimelineSide(globalIndex: number): 'left' | 'right' {
  return globalIndex % 2 === 0 ? 'right' : 'left'
}

export function buildTimelineEntries(coins: ZoraCoin[]): TimelineEntry[] {
  const groups = groupTimelineCoinsByYear(coins)
  const entries: TimelineEntry[] = []

  for (const group of groups) {
    for (const coin of group.items) {
      entries.push({
        coin,
        side: resolveTimelineSide(entries.length),
        year: group.year,
        date: formatTimelineDateParts(coin.createdAt),
      })
    }
  }

  return entries
}
