import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, X } from 'lucide-react'
import { RouteViz } from '@/components/trade/RouteViz'

type ConfirmIntent = 'approval' | 'swap' | 'order'

function TokenRow(props: {
  symbol: string
  amount: string
  fiat?: string | null
  logoUrl?: string | null
  label?: string
}) {
  const [logoErr, setLogoErr] = useState(false)
  const showLogo = Boolean(props.logoUrl) && !logoErr

  return (
    <div className="flex items-center gap-3">
      {showLogo ? (
        <img
          src={props.logoUrl ?? undefined}
          alt={props.symbol}
          className="h-10 w-10 rounded-full object-cover border border-white/10 bg-black/30 shrink-0"
          loading="lazy"
          onError={() => setLogoErr(true)}
        />
      ) : (
        <div className="h-10 w-10 rounded-full border border-white/10 bg-zinc-800 text-sm font-semibold text-zinc-100 flex items-center justify-center shrink-0">
          {props.symbol.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {props.label && (
          <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600 mb-0.5">{props.label}</div>
        )}
        <div className="text-xl font-semibold tabular-nums text-white truncate">
          {props.amount || '—'} <span className="text-base font-medium text-zinc-400">{props.symbol}</span>
        </div>
      </div>
      {props.fiat && (
        <span className="text-xs text-zinc-500 tabular-nums shrink-0">≈ {props.fiat}</span>
      )}
    </div>
  )
}

import { useState } from 'react'

function DataRow(props: { label: string; value: React.ReactNode; tone?: 'warn' | 'ok' | 'default' }) {
  const valueCx =
    props.tone === 'warn' ? 'text-amber-300' : props.tone === 'ok' ? 'text-emerald-300' : 'text-zinc-300'
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/6 last:border-0">
      <span className="text-xs text-zinc-500">{props.label}</span>
      <span className={`text-xs font-medium tabular-nums ${valueCx}`}>{props.value}</span>
    </div>
  )
}

export function SwapConfirmModal(props: {
  intent: ConfirmIntent | null
  busy: string | null
  quoteIsStale: boolean
  executionMode: 'canonical' | 'eoa'
  executionAddress: `0x${string}` | null
  signerAddress: `0x${string}` | null
  tokenInSymbol: string
  tokenOutSymbol: string
  tokenInLogoUrl?: string | null
  tokenOutLogoUrl?: string | null
  amountInUnits: string
  estimatedOut: string
  parsedSlippage?: number
  gasEstimateLabel?: string | null
  priceImpactLabel?: string | null
  routeSummary?: string | null
  approvalRequired: boolean
  permitSignatureRequired: boolean
  permitSignaturePending: boolean
  permitSignatureReady: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!props.intent) return null

  const minReceived = (() => {
    const out = Number(props.estimatedOut)
    const slip = props.parsedSlippage ?? 0.5
    if (!Number.isFinite(out) || out <= 0) return '--'
    return `${(out * (1 - slip / 100)).toFixed(6)} ${props.tokenOutSymbol}`
  })()

  const confirmLabel = props.busy
    ? props.busy === 'approval'
      ? 'Approving…'
      : props.busy === 'review'
        ? 'Preparing…'
        : props.intent === 'order'
          ? 'Submitting…'
          : 'Swapping…'
    : props.quoteIsStale
      ? 'Refresh & confirm'
      : props.intent === 'approval'
        ? 'Approve token'
        : props.intent === 'order'
          ? 'Submit order'
          : 'Confirm swap'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-95">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          onClick={props.busy ? undefined : props.onCancel}
        />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0d0d0d] shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.95)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-5"
        >
          {/* Handle (mobile only) */}
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/12 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-4">
            <span className="text-sm font-semibold text-white">
              {props.intent === 'approval' ? 'Approve token' : props.intent === 'order' ? 'Review order' : 'Review trade'}
            </span>
            <button
              type="button"
              onClick={props.onCancel}
              disabled={props.busy !== null}
              className="rounded-full border border-white/10 p-1.5 text-zinc-400 transition hover:text-white disabled:opacity-40"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5">
            {/* From / To */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-1">
              <TokenRow
                symbol={props.tokenInSymbol}
                amount={props.amountInUnits}
                logoUrl={props.tokenInLogoUrl}
                label="You pay"
              />
              <div className="flex justify-center py-1">
                <div className="rounded-full border border-white/10 bg-[#0d0d0d] p-1.5 text-zinc-600">
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
              </div>
              <TokenRow
                symbol={props.tokenOutSymbol}
                amount={props.estimatedOut}
                logoUrl={props.tokenOutLogoUrl}
                label="You receive"
              />
            </div>

            {/* Details */}
            <div className="mt-3">
              <DataRow label="Minimum received" value={minReceived} />
              {props.gasEstimateLabel && (
                <DataRow label="Network cost" value={props.gasEstimateLabel} />
              )}
              {props.parsedSlippage !== undefined && (
                <DataRow label="Slippage" value={`${props.parsedSlippage}%`} />
              )}
              {props.priceImpactLabel && (
                <DataRow
                  label="Price impact"
                  value={props.priceImpactLabel}
                  tone={parseFloat(props.priceImpactLabel) > 1 ? 'warn' : 'default'}
                />
              )}
            </div>

            {/* Route viz */}
            <div className="mt-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
              <RouteViz routeSummary={props.routeSummary} />
            </div>

            {/* Inline notices */}
            {props.permitSignatureRequired && !props.permitSignatureReady && (
              <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                props.permitSignaturePending
                  ? 'border-amber-400/30 bg-amber-500/8 text-amber-300'
                  : 'border-blue-400/25 bg-blue-500/8 text-blue-300'
              }`}>
                {props.permitSignaturePending
                  ? 'Check your wallet — signature required.'
                  : 'A one-time signature is needed to proceed.'}
              </div>
            )}
            {props.approvalRequired && (props.intent === 'swap' || props.intent === 'order') && (
              <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-300">
                Token approval needed — we'll submit it first, then continue.
              </div>
            )}
            {props.quoteIsStale && (
              <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-300">
                Quote expired — confirming will refresh it automatically.
              </div>
            )}

            {/* CTA */}
            <motion.button
              type="button"
              onClick={props.onConfirm}
              disabled={props.busy !== null}
              whileTap={{ scale: 0.985 }}
              className="mt-4 min-h-12 w-full rounded-2xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_-6px_rgba(0,82,255,0.4)] transition hover:bg-brand-hover disabled:opacity-50 disabled:shadow-none"
            >
              {confirmLabel}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
