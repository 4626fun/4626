import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { RouteDisplay } from '@/components/swap/RouteDisplay'
import { cn } from '@/lib/utils'

type SwapDetailsProps = {
  routeSummary: string | null
  aggregator?: string
  executionPrice?: string | null
  marketPrice?: string | null
  slippagePct: string
  onSetSlippagePct: (next: string) => void
  gasEstimateLabel: string | null
  priceImpactLabel: string | null
  lpFeeUsd?: string | null
  protocolFeeUsd?: string | null
  quoteUpdatedAt?: string | null
}

const slippagePresets = ['0.1', '0.5', '1', '2', '5']

function impactColorClass(label: string | null): string {
  if (!label) return 'bg-zinc-600/15 text-zinc-200'
  const numeric = Number(label.replace('%', ''))
  if (!Number.isFinite(numeric)) return 'bg-zinc-600/15 text-zinc-200'
  if (numeric < 0.5) return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
  if (numeric <= 2) return 'bg-amber-500/15 text-amber-300 border border-amber-500/35'
  return 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
}

export function SwapDetails({
  routeSummary,
  aggregator,
  executionPrice,
  marketPrice,
  slippagePct,
  onSetSlippagePct,
  gasEstimateLabel,
  priceImpactLabel,
  lpFeeUsd,
  protocolFeeUsd,
  quoteUpdatedAt,
}: SwapDetailsProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all duration-200 hover:-translate-y-px"
        style={{
          borderColor: 'rgb(var(--vault-border-strong) / 0.6)',
          background: 'linear-gradient(160deg, rgb(var(--vault-card-raised) / 0.74), rgb(var(--vault-card) / 0.52))',
        }}
      >
        <span className="font-medium text-vault-text">Details</span>
        {open ? <ChevronUp className="h-4 w-4 text-vault-subtext" /> : <ChevronDown className="h-4 w-4 text-vault-subtext" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="mt-2 space-y-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            <RouteDisplay
              routeSummary={routeSummary}
              aggregator={aggregator}
              executionPrice={executionPrice}
              marketPrice={marketPrice}
            />

            <div
              className="rounded-xl border p-3 backdrop-blur-sm"
              style={{
                borderColor: 'rgb(var(--vault-border-strong) / 0.52)',
                background: 'linear-gradient(160deg, rgb(var(--vault-card) / 0.5), rgb(var(--vault-card-raised) / 0.35))',
              }}
            >
              <div className="mb-2 text-xs text-vault-subtext uppercase tracking-[0.12em]">Slippage</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={slippagePct}
                  onChange={(event) => onSetSlippagePct(event.target.value)}
                  className={cn(
                    'h-9 w-20 rounded-lg border px-2 text-xs font-mono',
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
                      'rounded-lg border px-2 py-1 text-[11px] font-medium',
                      slippagePct === preset
                        ? 'border-brand-primary/45 bg-brand-primary/18 text-vault-text'
                        : 'border-[rgb(var(--vault-border-strong)/0.45)] bg-[rgb(var(--vault-card-raised)/0.72)] text-vault-subtext',
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <div
              className="grid gap-2 rounded-xl border p-3 text-sm backdrop-blur-sm"
              style={{
                borderColor: 'rgb(var(--vault-border-strong) / 0.52)',
                background: 'linear-gradient(160deg, rgb(var(--vault-card) / 0.5), rgb(var(--vault-card-raised) / 0.35))',
              }}
            >
              <div className="flex items-center justify-between text-vault-subtext">
                <span>Estimated gas</span>
                <span className="font-mono text-vault-text">{gasEstimateLabel ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-vault-subtext">
                <span>LP fee</span>
                <span className="font-mono text-vault-text">{lpFeeUsd ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-vault-subtext">
                <span>Protocol fee</span>
                <span className="font-mono text-vault-text">{protocolFeeUsd ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-vault-subtext">
                <span>Price impact</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', impactColorClass(priceImpactLabel))}>
                  {priceImpactLabel ?? '—'}
                </span>
              </div>
              {quoteUpdatedAt && (
                <div className="text-right text-[11px] text-vault-muted font-mono">Quote: {quoteUpdatedAt}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
