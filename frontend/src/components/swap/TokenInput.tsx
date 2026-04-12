import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'

import { TokenAvatar } from '@/components/swap/TokenAvatar'
import { LoadingText } from '@/components/ui/LoadingState'
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

  const sliderTrackBackground = useMemo(() => {
    const active = 'rgb(var(--brand-primary) / 0.9)'
    const inactive = 'rgb(var(--vault-border-strong) / 0.35)'
    return `linear-gradient(90deg, ${active} 0%, ${active} ${sliderPercent}%, ${inactive} ${sliderPercent}%, ${inactive} 100%)`
  }, [sliderPercent])

  const shellBackground =
    label === 'Sell'
      ? 'linear-gradient(165deg, rgb(var(--vault-card-raised) / 0.66), rgb(var(--vault-card) / 0.5))'
      : 'linear-gradient(165deg, rgb(var(--vault-card-raised) / 0.66), rgba(0, 82, 255, 0.13))'
  const metaValueTextClass = 'app-meta-value'

  return (
    <div
      className="rounded-2xl p-4 backdrop-blur-sm"
      style={{
        background: shellBackground,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="bv-kicker">{label}</div>
      </div>

      <div className="mt-2 flex gap-2.5">
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
          {amountUsd ? <div className="app-meta-value mt-1 text-vault-muted">{amountUsd}</div> : null}
        </div>
        <button
          type="button"
          onClick={onSelectToken}
          className="inline-flex h-10 min-w-[104px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all duration-200 hover:-translate-y-px hover:bg-white/10"
          style={{
            background: 'rgb(var(--vault-card) / 0.58)',
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
            size={28}
          />
          <span className="text-[13px] font-medium text-vault-text">
            {tokenIdentityLoading ? <LoadingText intent="processing" size="sm" labelOverride="Loading..." /> : token.symbol}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-vault-subtext" />
        </button>
      </div>

      {balanceLabel ? (
        <div className={`mt-0.5 flex justify-end ${metaValueTextClass}`} aria-live="polite">
          {balanceLabel}
        </div>
      ) : null}

      {!readOnly && tokenIdentityLoading === false && tokenBalanceValue !== null ? (
        <div className="mt-1">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sliderPercent}
            onChange={(event) =>
              onQuickPercent?.(Number(event.target.value), balanceLabel ? balanceLabel.split(' ')[0] : null)
            }
            className="bv-amount-slider h-1 w-full cursor-pointer appearance-none rounded-full accent-brand-primary"
            style={{ background: sliderTrackBackground }}
            aria-label={`${label} amount percentage`}
          />
          <div className={`mt-1 flex justify-end ${metaValueTextClass}`}>
            {sliderPercent}%
          </div>
        </div>
      ) : null}

      <div className="mt-2 text-[10px] text-vault-muted">
        {isLoadingToken ? <LoadingText intent="processing" size="sm" labelOverride="Resolving token metadata..." /> : null}
      </div>
    </div>
  )
}
