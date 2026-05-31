import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { SwapRoutePopover } from '@/components/swap/SwapRoutePopover'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/shared/utils'
import {
  formatSwapExchangeRate,
  formatSwapNetworkCostDisplay,
  type SwapRouteLeg,
} from '@/lib/swap/swapQuoteDetails'

type SwapDetailsProps = {
  routeSummary: string | null
  routeLegs?: SwapRouteLeg[]
  aggregator?: string
  amountIn?: string
  tokenInSymbol?: string
  amountOut?: string
  tokenOutSymbol?: string
  slippagePct: string
  onSetSlippagePct: (next: string) => void
  gasEstimateLabel: string | null
  priceImpactLabel: string | null
  lpFeeUsd?: string | null
  protocolFeeUsd?: string | null
  quoteUpdatedAt?: string | null
  sponsoredExecution?: boolean
  showUniswapBranding?: boolean
  /** When true, show an "Auto" pill beside slippage (default preset). */
  slippageIsAuto?: boolean
}

const slippagePresets = ['0.1', '0.5', '1', '2', '5']
const DEFAULT_SLIPPAGE = '0.5'

function impactColorClass(label: string | null): string {
  if (!label) return 'text-zinc-400'
  const numeric = Number(label.replace('%', ''))
  if (!Number.isFinite(numeric)) return 'text-zinc-400'
  if (numeric < 0.5) return 'text-emerald-300'
  if (numeric <= 2) return 'text-amber-300'
  return 'text-rose-300'
}

function DetailRow({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5 text-sm', className)}>
      <span className="shrink-0 text-vault-subtext">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  )
}

export function SwapDetails({
  routeSummary,
  routeLegs,
  aggregator,
  amountIn,
  tokenInSymbol,
  amountOut,
  tokenOutSymbol,
  slippagePct,
  onSetSlippagePct,
  gasEstimateLabel,
  priceImpactLabel,
  lpFeeUsd,
  protocolFeeUsd,
  quoteUpdatedAt,
  sponsoredExecution = false,
  showUniswapBranding = true,
  slippageIsAuto,
}: SwapDetailsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  const exchangeRate =
    amountIn && tokenInSymbol && amountOut && tokenOutSymbol
      ? formatSwapExchangeRate({
          amountIn,
          tokenInSymbol,
          amountOut,
          tokenOutSymbol,
        })
      : null

  const networkCost = formatSwapNetworkCostDisplay({
    gasEstimateLabel,
    sponsoredExecution,
  })

  const showAutoSlippage = slippageIsAuto ?? slippagePct === DEFAULT_SLIPPAGE

  const hasSecondaryDetails =
    Boolean(lpFeeUsd) ||
    Boolean(protocolFeeUsd) ||
    Boolean(priceImpactLabel) ||
    Boolean(quoteUpdatedAt)

  return (
    <section className="mt-3 border-t border-[rgb(var(--vault-border-strong)/0.35)] pt-3">
      <div className="space-y-0.5">
        {exchangeRate ? (
          <DetailRow label="Exchange rate">
            <span className="app-meta-value text-vault-text">{exchangeRate}</span>
          </DetailRow>
        ) : null}

        {networkCost ? (
          <DetailRow label="Network cost">
            <span className="inline-flex items-center gap-1.5">
              <span className="app-meta-value text-vault-text">{networkCost.primary}</span>
              {networkCost.sponsoredFree ? (
                <Badge variant="muted" size="xs" className="normal-case tracking-normal text-zinc-300">
                  Free
                </Badge>
              ) : null}
            </span>
          </DetailRow>
        ) : null}

        <DetailRow label="Slippage tolerance">
          <span className="inline-flex items-center gap-1.5">
            {showAutoSlippage ? (
              <Badge variant="muted" size="xs" className="normal-case tracking-normal text-zinc-300">
                Auto
              </Badge>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className="app-meta-value inline-flex items-center gap-0.5 text-vault-text hover:text-brand-200"
              aria-expanded={settingsOpen}
              aria-label="Edit slippage tolerance"
            >
              {slippagePct}%
              {settingsOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-vault-subtext" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-vault-subtext" />
              )}
            </button>
          </span>
        </DetailRow>

        <SwapRoutePopover
          routeSummary={routeSummary}
          routeLegs={routeLegs}
          aggregator={aggregator}
          showUniswapBranding={showUniswapBranding}
        />
      </div>

      <AnimatePresence initial={false}>
        {settingsOpen ? (
          <motion.div
            className="mt-2 rounded-xl border border-[rgb(var(--vault-border-strong)/0.45)] bg-[rgb(var(--vault-card)/0.45)] p-2.5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={slippagePct}
                onChange={(event) => onSetSlippagePct(event.target.value)}
                className={cn(
                  'h-8 w-20 rounded-lg border px-2 text-[11px]',
                  'text-vault-text placeholder:text-vault-muted outline-none',
                  'bg-[rgb(var(--vault-card-raised)/0.82)]',
                  'border-[rgb(var(--vault-border-strong)/0.62)] focus:border-brand-primary/70',
                )}
                aria-label="Slippage percent"
                placeholder="0.5"
              />
              <span className="text-xs text-vault-subtext">%</span>
              {slippagePresets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => onSetSlippagePct(preset)}
                  className={cn(
                    'rounded-lg border px-1.5 py-1 text-[10px] font-medium',
                    slippagePct === preset
                      ? 'border-brand-primary/45 bg-brand-primary/18 text-vault-text'
                      : 'border-[rgb(var(--vault-border-strong)/0.45)] bg-[rgb(var(--vault-card-raised)/0.72)] text-vault-subtext',
                  )}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {hasSecondaryDetails ? (
        <div className="mt-2 space-y-0.5 border-t border-[rgb(var(--vault-border-strong)/0.25)] pt-2">
          {lpFeeUsd ? (
            <DetailRow label="LP fee">
              <span className="app-meta-value text-vault-text">{lpFeeUsd}</span>
            </DetailRow>
          ) : null}
          {protocolFeeUsd ? (
            <DetailRow label="Protocol fee">
              <span className="app-meta-value text-vault-text">{protocolFeeUsd}</span>
            </DetailRow>
          ) : null}
          {priceImpactLabel ? (
            <DetailRow label="Price impact">
              <span className={cn('app-meta-value font-medium', impactColorClass(priceImpactLabel))}>
                {priceImpactLabel}
              </span>
            </DetailRow>
          ) : null}
          {quoteUpdatedAt ? (
            <div className="pt-1 text-right text-[10px] text-vault-subtext">Quote · {quoteUpdatedAt}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
