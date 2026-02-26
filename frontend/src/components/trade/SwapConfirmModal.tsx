import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RouteViz } from '@/components/trade/RouteViz'
import { TokenLogo } from '@/components/ui/TokenLogo'

type ConfirmIntent = 'approval' | 'swap' | 'order'

function TokenRow(props: {
  symbol: string
  amount: string
  fiat?: string | null
  logoUrl?: string | null
  logoUrls?: string[]
  label?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <TokenLogo symbol={props.symbol} logoUrl={props.logoUrl} logoUrls={props.logoUrls} size="lg" />
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
  tokenInLogoUrls?: string[]
  tokenOutLogoUrls?: string[]
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
  const prefersReduced = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.intent) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !props.busy) props.onCancel()
      if (e.key === 'Tab' && dialogRef.current) {
        const sel = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(sel))
        if (focusable.length === 0) { e.preventDefault(); return }
        const first = focusable[0]!, last = focusable[focusable.length - 1]!
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.intent, props.busy, props.onCancel])

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
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          onClick={props.busy ? undefined : props.onCancel}
          aria-hidden="true"
        />
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={props.intent === 'approval' ? 'Approve token' : props.intent === 'order' ? 'Review order' : 'Review trade'}
          initial={prefersReduced ? false : { y: '100%' }}
          animate={{ y: 0 }}
          exit={prefersReduced ? undefined : { y: '100%' }}
          transition={prefersReduced ? { duration: 0 } : { type: 'spring', damping: 32, stiffness: 300 }}
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
                logoUrls={props.tokenInLogoUrls}
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
                logoUrls={props.tokenOutLogoUrls}
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
