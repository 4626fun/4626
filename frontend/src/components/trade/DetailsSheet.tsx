import { AnimatePresence, motion } from 'framer-motion'
import { Clock3, ExternalLink, X } from 'lucide-react'
import { RouteViz } from '@/components/trade/RouteViz'

type DetailsSheetProps = {
  open: boolean
  onClose: () => void
  tokenInSymbol: string
  tokenOutSymbol: string
  amountInUnits: string
  estimatedOut: string
  parsedSlippage: number
  quoteUpdatedAt: number | null
  quoteIsStale: boolean
  priceImpactLabel?: string | null
  gasEstimateLabel?: string | null
  routeSummary?: string | null
}

function DataRow(props: { label: string; value: React.ReactNode; tone?: 'default' | 'warn' | 'ok' }) {
  const valueCx =
    props.tone === 'warn'
      ? 'text-amber-300'
      : props.tone === 'ok'
        ? 'text-emerald-300'
        : 'text-zinc-200'
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-white/6 last:border-0">
      <span className="text-xs text-zinc-500">{props.label}</span>
      <span className={`text-xs tabular-nums font-medium ${valueCx}`}>{props.value}</span>
    </div>
  )
}

function formatRate(amountIn: string, estimatedOut: string, symIn: string, symOut: string): string {
  const inN = Number(amountIn)
  const outN = Number(estimatedOut)
  if (!Number.isFinite(inN) || inN <= 0 || !Number.isFinite(outN) || outN <= 0) return '--'
  return `1 ${symIn} = ${(outN / inN).toFixed(6)} ${symOut}`
}

export function DetailsSheet(props: DetailsSheetProps) {
  const rateLabel = formatRate(props.amountInUnits, props.estimatedOut, props.tokenInSymbol, props.tokenOutSymbol)

  const minReceived = (() => {
    const out = Number(props.estimatedOut)
    if (!Number.isFinite(out) || out <= 0) return '--'
    return `${(out * (1 - props.parsedSlippage / 100)).toFixed(6)} ${props.tokenOutSymbol}`
  })()

  return (
    <AnimatePresence>
      {props.open && (
        <div className="fixed inset-0 z-90">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-[6px]"
            onClick={props.onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-2xl border border-white/8 glass-card shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
          >
            {/* Handle */}
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/10" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-4">
              <span className="text-sm font-medium text-vault-text">Trade details</span>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-lg border border-white/8 p-1 text-vault-subtext hover:text-vault-text hover:bg-white/6 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
                aria-label="Close details"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Details */}
            <div className="px-5">
              <DataRow label="Rate" value={rateLabel} />
              <DataRow label="Slippage tolerance" value={`${props.parsedSlippage}%`} />
              <DataRow label="Minimum received" value={minReceived} />
              <DataRow
                label="Price impact"
                value={props.priceImpactLabel ?? '--'}
                tone={
                  props.priceImpactLabel && parseFloat(props.priceImpactLabel) > 1
                    ? 'warn'
                    : 'default'
                }
              />
              <DataRow label="Network cost" value={props.gasEstimateLabel ?? '--'} />
              <DataRow
                label="Quote"
                tone={props.quoteIsStale ? 'warn' : props.quoteUpdatedAt ? 'ok' : 'default'}
                value={
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {props.quoteIsStale
                      ? 'Expired — refresh'
                      : props.quoteUpdatedAt
                        ? `Updated ${new Date(props.quoteUpdatedAt).toLocaleTimeString()}`
                        : 'Not quoted yet'}
                  </span>
                }
              />
            </div>

            {/* Route viz */}
            {(props.routeSummary || props.estimatedOut) && (
              <div className="mx-5 mt-4 rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="mb-2 text-[10px] font-medium text-zinc-500">Route</div>
                <RouteViz routeSummary={props.routeSummary} />
              </div>
            )}

            {/* About routing */}
            <div className="px-5 mt-4">
              <a
                href="https://docs.uniswap.org/concepts/protocol/swaps"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 app-meta-value text-zinc-600 hover:text-zinc-400 transition"
              >
                About routing
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
