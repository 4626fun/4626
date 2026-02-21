import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react'

export type TxLifecycleState = 'idle' | 'review' | 'signing' | 'pending' | 'success' | 'error'

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function TransactionLifecycle(props: {
  state: TxLifecycleState
  message?: string
  txHash?: string | null
  chainExplorerBase?: string
  onReset?: () => void
}) {
  const { state, message, txHash, chainExplorerBase = 'https://basescan.org/tx/', onReset } = props

  if (state === 'idle' && !message) return null

  const explorerUrl = txHash ? `${chainExplorerBase}${txHash}` : null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={reducedMotion ? {} : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? {} : { opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className={`mt-3 overflow-hidden rounded-xl border ${stateStyle[state].border} ${stateStyle[state].bg}`}
      >
        <div className="flex items-start gap-3 px-3 py-3">
          <StateIcon state={state} />
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold ${stateStyle[state].text}`}>
              {stateLabel[state]}
            </div>
            {message && (
              <div className="mt-0.5 text-[11px] text-zinc-400 leading-snug">{message}</div>
            )}
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
              >
                View on Basescan
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {(state === 'success' || state === 'error') && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:text-zinc-200"
            >
              {state === 'error' ? 'Try again' : 'Done'}
            </button>
          )}
        </div>
        {/* Shimmer progress for pending */}
        {state === 'pending' && !reducedMotion && (
          <div className="h-0.5 w-full overflow-hidden bg-white/5">
            <motion.div
              className="h-full bg-brand-primary/60"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function StateIcon(props: { state: TxLifecycleState }) {
  switch (props.state) {
    case 'signing':
      return (
        <motion.span
          animate={reducedMotion ? {} : { opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="mt-px shrink-0"
        >
          <div className="h-4 w-4 rounded-full border-2 border-brand-primary/60 bg-brand-primary/15" />
        </motion.span>
      )
    case 'pending':
      return (
        <Loader2
          className={`mt-px h-4 w-4 shrink-0 text-zinc-400 ${reducedMotion ? '' : 'animate-spin'}`}
        />
      )
    case 'success':
      return <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-400" />
    case 'error':
      return <XCircle className="mt-px h-4 w-4 shrink-0 text-rose-400" />
    default:
      return <div className="mt-px h-4 w-4 shrink-0 rounded-full bg-white/10" />
  }
}

const stateLabel: Record<TxLifecycleState, string> = {
  idle: 'Ready',
  review: 'Reviewing',
  signing: 'Waiting for signature',
  pending: 'Transaction submitted',
  success: 'Swap complete',
  error: 'Transaction failed',
}

const stateStyle: Record<TxLifecycleState, { border: string; bg: string; text: string }> = {
  idle: {
    border: 'border-white/8',
    bg: 'bg-white/3',
    text: 'text-zinc-400',
  },
  review: {
    border: 'border-blue-400/20',
    bg: 'bg-blue-500/6',
    text: 'text-blue-300',
  },
  signing: {
    border: 'border-brand-primary/25',
    bg: 'bg-brand-primary/8',
    text: 'text-brand-300',
  },
  pending: {
    border: 'border-zinc-700/60',
    bg: 'bg-white/4',
    text: 'text-zinc-300',
  },
  success: {
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-500/8',
    text: 'text-emerald-300',
  },
  error: {
    border: 'border-rose-400/30',
    bg: 'bg-rose-500/8',
    text: 'text-rose-300',
  },
}
