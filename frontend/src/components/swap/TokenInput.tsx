import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'

import { TokenAvatar } from '@/components/swap/TokenAvatar'
import { LoadingText } from '@/components/ui/LoadingState'
import { formatSwapDisplayAmount } from '@/lib/swap/swapDisplayAmount'
import { cn } from '@/lib/shared/utils'
import type { TokenDisplay } from '@/lib/uniswap/swapUtils'

type TokenInputVariant = {
  label: 'Sell' | 'Buy'
  amount: string
  amountUsd?: string
  amountLoading?: boolean
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
  amountLoading = false,
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
  const balanceAmountToken = useMemo(() => {
    const raw = typeof balanceLabel === 'string' ? balanceLabel.trim() : ''
    if (!raw) return null
    return raw.split(/\s+/)[0] ?? null
  }, [balanceLabel])

  const tokenBalanceValue = useMemo(() => {
    if (!balanceAmountToken) return null
    const normalized = balanceAmountToken.replace(/,/g, '').replace(/^</, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }, [balanceAmountToken])

  const sliderPercent = useMemo(() => {
    if (tokenBalanceValue == null || tokenBalanceValue <= 0) return 0
    const next = (Number(amount || '0') / tokenBalanceValue) * 100
    if (!Number.isFinite(next)) return 0
    return Math.max(0, Math.min(100, Math.round(next)))
  }, [amount, tokenBalanceValue])

  const sliderTrackBackground = useMemo(() => {
    const active = 'rgb(var(--brand-primary) / 0.85)'
    const inactive = 'rgb(var(--vault-border-strong) / 0.35)'
    return `linear-gradient(90deg, ${active} 0%, ${active} ${sliderPercent}%, ${inactive} ${sliderPercent}%, ${inactive} 100%)`
  }, [sliderPercent])

  const showSlider = !readOnly && tokenIdentityLoading === false && tokenBalanceValue !== null

  const displayAmount = useMemo(() => {
    if (readOnly && !amountLoading) {
      return formatSwapDisplayAmount(amount, token.symbol)
    }
    return amount
  }, [amount, amountLoading, readOnly, token.symbol])

  return (
    <div className="rounded-[20px] border border-white/[0.08] bg-[rgb(var(--vault-card-raised)/0.72)] p-4">
      <span className="text-[14px] font-medium leading-none text-zinc-400">{label}</span>

      <div className="mt-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${label}-amount`} className="sr-only">
            {label} amount
          </label>
          <input
            id={`${label}-amount`}
            aria-label={inputAriaLabel}
            type="text"
            inputMode="decimal"
            value={amountLoading && readOnly ? '' : displayAmount}
            readOnly={readOnly}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder={readOnly ? (amountLoading ? '' : '0') : '0'}
            aria-busy={amountLoading || undefined}
            className={cn(
              'w-full border-0 bg-transparent p-0 font-sans text-[36px] leading-[44px] font-medium tabular-nums tracking-[-0.02em] outline-none',
              readOnly ? 'cursor-default text-zinc-300' : 'text-white',
              'placeholder:text-zinc-600',
              amountLoading && readOnly ? 'text-zinc-500' : null,
            )}
          />
          {amountLoading && readOnly ? (
            <div className="mt-1 text-[14px] text-zinc-500">
              <LoadingText intent="processing" size="sm" labelOverride="Fetching quote…" />
            </div>
          ) : amountUsd ? (
            <div className="mt-0.5 text-[14px] font-normal tabular-nums text-zinc-500">{amountUsd}</div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={onSelectToken}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[rgb(var(--vault-card)/0.95)] px-3 py-2 transition-colors hover:bg-white/[0.08]"
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
              size={24}
              noFallback
            />
            <span className="max-w-[5.5rem] truncate text-[16px] font-semibold leading-none text-white">
              {tokenIdentityLoading ? (
                <LoadingText intent="processing" size="sm" labelOverride="…" />
              ) : (
                token.symbol
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
          </button>

          {balanceLabel ? (
            <div className="flex max-w-full items-center justify-end gap-2">
              <span
                className="truncate text-right text-[13px] font-normal tabular-nums text-zinc-500"
                aria-live="polite"
                title={balanceLabel}
              >
                {balanceLabel}
              </span>
              {showSlider && onQuickPercent ? (
                <button
                  type="button"
                  onClick={() => onQuickPercent(100, balanceAmountToken)}
                  className="shrink-0 text-[13px] font-medium text-brand-primary transition-colors hover:text-brand-200"
                >
                  Max
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {showSlider ? (
        <div className="mt-4 px-0.5">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sliderPercent}
            onChange={(event) => onQuickPercent?.(Number(event.target.value), balanceAmountToken)}
            className="bv-amount-slider h-1 w-full cursor-pointer appearance-none rounded-full accent-brand-primary"
            style={{ background: sliderTrackBackground }}
            aria-label={`${label} amount percentage`}
          />
        </div>
      ) : null}

      {isLoadingToken ? (
        <div className="mt-2 text-xs text-zinc-500">
          <LoadingText intent="processing" size="sm" labelOverride="Resolving token metadata..." />
        </div>
      ) : null}
    </div>
  )
}
