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
        className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm"
      >
        <span className="font-medium text-zinc-200">Details</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 text-xs text-zinc-400">Slippage</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={slippagePct}
                  onChange={(event) => onSetSlippagePct(event.target.value)}
                  className={cn(
                    'h-9 w-20 rounded-lg border border-white/12 bg-black/30 px-2 text-xs',
                    'text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-brand-primary/60',
                  )}
                  aria-label="Slippage percent"
                  placeholder="0.5"
                />
                <span className="text-xs text-zinc-400">%</span>
                {slippagePresets.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => onSetSlippagePct(preset)}
                    className={cn(
                      'rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-[11px]',
                      slippagePct === preset ? 'bg-white/18 text-white' : 'text-zinc-300',
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Estimated gas</span>
                <span className="text-zinc-200">{gasEstimateLabel ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>LP fee</span>
                <span className="text-zinc-200">{lpFeeUsd ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Protocol fee</span>
                <span className="text-zinc-200">{protocolFeeUsd ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Price impact</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', impactColorClass(priceImpactLabel))}>
                  {priceImpactLabel ?? '—'}
                </span>
              </div>
              {quoteUpdatedAt && (
                <div className="text-right text-[11px] text-zinc-500">Quote: {quoteUpdatedAt}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
