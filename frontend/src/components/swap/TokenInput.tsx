import { Sparkles } from 'lucide-react'

import { TokenAvatar } from '@/components/swap/TokenAvatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { TokenDisplay } from '@/lib/uniswap/swapUtils'

type TokenInputVariant = {
  label: 'Sell' | 'Buy'
  amount: string
  amountUsd?: string
  balanceLabel?: string
  readOnly?: boolean
  token: TokenDisplay
  tokenAddress: string
  isLoadingToken: boolean
  onAmountChange: (value: string) => void
  onSelectToken: () => void
  quickPercentages?: number[]
  onQuickPercent?: (ratio: number, tokenBalance?: string | null) => void
  tokenIdentityLoading?: boolean
  inputAriaLabel?: string
}

export function TokenInput({
  label,
  amount,
  amountUsd,
  balanceLabel,
  readOnly = false,
  token,
  tokenAddress,
  isLoadingToken,
  onAmountChange,
  onSelectToken,
  quickPercentages = [25, 50, 75, 100],
  onQuickPercent,
  tokenIdentityLoading = false,
  inputAriaLabel = 'token amount',
}: TokenInputVariant) {
  return (
    <div className="rounded-2xl border border-white/12 bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-zinc-400">{label}</div>
        {balanceLabel && (
          <div className="text-xs text-zinc-500" aria-live="polite">
            Balance: {balanceLabel}
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-3">
        <div className="min-h-14 flex-1">
          <label htmlFor={`${label}-amount`} className="sr-only">
            {label} amount
          </label>
          <input
            id={`${label}-amount`}
            aria-label={inputAriaLabel}
            type="text"
            inputMode="decimal"
            value={amount}
            readOnly={readOnly}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder={readOnly ? '—' : '0.0'}
            className={cn(
              'w-full bg-transparent text-4xl leading-tight font-semibold tracking-tight text-white outline-none',
              'placeholder:text-zinc-600',
              'border-b border-transparent focus:border-zinc-600',
            )}
          />
          {amountUsd ? <div className="mt-1 text-xs text-zinc-500">{amountUsd}</div> : null}
        </div>
        <button
          type="button"
          onClick={onSelectToken}
          className="inline-flex min-w-34 items-center gap-2 rounded-xl border border-white/12 bg-white/4 px-3 py-2 transition hover:bg-white/8"
          aria-label={`Select ${label} token`}
        >
          <TokenAvatar
            token={{
              address: tokenAddress,
              symbol: token.symbol,
              logoUrl: token.logoUrl ?? undefined,
              logoUrls: token.logoUrls,
            }}
            symbol={token.symbol}
            size={30}
          />
          <span className="font-medium text-sm text-white">
            {tokenIdentityLoading ? 'Loading…' : token.symbol}
          </span>
          <Sparkles className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      {!readOnly && tokenIdentityLoading === false ? (
        <div className="mt-3 flex items-center gap-2">
          {quickPercentages.map((pct) => (
            <Button
              key={pct}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onQuickPercent?.(pct, balanceLabel ? balanceLabel.split(' ')[0] : null)}
            >
              {pct}%
            </Button>
          ))}
        </div>
      ) : null}

      <div className="mt-2 text-[10px] text-zinc-500">
        {isLoadingToken ? <span className="inline-flex items-center gap-1">Resolving token metadata…</span> : null}
      </div>
    </div>
  )
}
