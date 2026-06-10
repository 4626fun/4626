import type { ReactNode } from 'react'

import { cn } from '@/lib/shared/utils'
import { CopyButton } from './ui/CopyButton'

export type CreatorCoinTypeTone = 'creator' | 'content' | 'other'

function coinTypeToneClasses(tone: CreatorCoinTypeTone): string {
  switch (tone) {
    case 'creator':
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25'
    case 'content':
      return 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
    case 'other': {
      return 'bg-white/[0.06] text-zinc-300 border border-white/10'
    }
    default: {
      const exhaustive: never = tone
      return exhaustive
    }
  }
}

/**
 * Identity card for the creator coin under review: avatar, name/symbol,
 * truncated address with copy, and a coin-type badge. Children render
 * eligibility warnings beneath the identity row.
 */
export function CreatorCoinCard({
  imageUrl,
  name,
  symbol,
  showSymbol = true,
  address,
  typeLabel,
  typeTone,
  children,
}: {
  imageUrl?: string | null
  name: string
  symbol?: string | null
  showSymbol?: boolean
  address: string
  typeLabel: string
  typeTone: CreatorCoinTypeTone
  children?: ReactNode
}) {
  const initials = (symbol || name || '?').slice(0, 2).toUpperCase()
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          {imageUrl ? (
            <img src={imageUrl} alt={symbol ? String(symbol) : 'Coin'} className="size-14 rounded-full object-cover" loading="lazy" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-linear-to-br from-brand-primary/20 to-brand-accent/20 text-sm font-medium text-brand-accent">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xl font-light text-white">
              {name}
              {symbol && showSymbol ? <span className="text-zinc-500"> ({`$${symbol}`})</span> : null}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="truncate font-mono text-xs text-zinc-600">{address}</span>
              <CopyButton value={address} label={`Copy ${symbol || name} address`} />
            </div>
          </div>
        </div>
        <span className={cn('inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[10px] font-medium', coinTypeToneClasses(typeTone))}>
          {typeLabel}
        </span>
      </div>
      {children}
    </div>
  )
}
