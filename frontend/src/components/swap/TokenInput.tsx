import { useMemo } from 'react'

import { TokenAvatar } from '@/components/swap/TokenAvatar'
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
  const tokenBalanceValue = useMemo(() => {
    const raw = typeof balanceLabel === 'string' ? balanceLabel.trim() : ''
    if (!raw) return null
    const amountToken = raw.split(/\s+/)[0] ?? ''
    const normalized = amountToken.replace(/,/g, '').replace(/^</, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }, [balanceLabel])

  const sliderPercent = useMemo(() => {
    if (tokenBalanceValue == null || tokenBalanceValue <= 0) return 0
    const next = (Number(amount || '0') / tokenBalanceValue) * 100
    if (!Number.isFinite(next)) return 0
    return Math.max(0, Math.min(100, Math.round(next)))
  }, [amount, tokenBalanceValue])

  return (
    <div
      className="rounded-2xl border p-4 backdrop-blur-sm"
      style={{
        borderColor: 'rgb(var(--vault-border-strong) / 0.6)',
        background: 'rgb(var(--vault-card-raised) / 0.62)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="bv-kicker">{label}</div>
        {balanceLabel && (
          <div className="text-xs text-vault-muted font-mono" aria-live="polite">
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
              'w-full border-b border-transparent bg-transparent font-display text-[2.45rem] leading-tight font-medium tracking-[-0.02em] text-vault-text outline-none',
              'placeholder:text-vault-muted',
              'focus:border-[rgb(var(--vault-border-strong)/0.8)]',
            )}
          />
          {amountUsd ? <div className="mt-1 text-xs text-vault-muted font-mono">{amountUsd}</div> : null}
        </div>
        <button
          type="button"
          onClick={onSelectToken}
          className="inline-flex min-w-34 items-center gap-2 rounded-xl border px-3 py-2 transition hover:bg-white/8"
          style={{
            borderColor: 'rgb(var(--vault-border-strong) / 0.64)',
            background: 'rgb(var(--vault-card) / 0.42)',
          }}
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
          <span className="text-sm font-medium text-vault-text">
            {tokenIdentityLoading ? 'Loading…' : token.symbol}
          </span>
        </button>
      </div>

      {!readOnly && tokenIdentityLoading === false && tokenBalanceValue !== null ? (
        <div
          className="mt-3 rounded-xl border px-3 py-2.5"
          style={{
            borderColor: 'rgb(var(--vault-border-strong) / 0.52)',
            background: 'rgb(var(--vault-card) / 0.35)',
          }}
        >
          <div className="mb-2 flex items-center justify-between text-[10px] text-vault-muted">
            <span>Amount slider</span>
            <span className="font-medium text-vault-text">{sliderPercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sliderPercent}
            onChange={(event) =>
              onQuickPercent?.(Number(event.target.value), balanceLabel ? balanceLabel.split(' ')[0] : null)
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-brand-primary"
            aria-label={`${label} amount percentage`}
          />
          <div className="mt-2 flex items-center justify-between text-[10px] text-vault-muted">
            <span>0%</span>
            {quickPercentages.map((pct) => (
              <span key={pct}>{pct}%</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-2 text-[10px] text-vault-muted">
        {isLoadingToken ? <span className="inline-flex items-center gap-1">Resolving token metadata…</span> : null}
      </div>
    </div>
  )
}
