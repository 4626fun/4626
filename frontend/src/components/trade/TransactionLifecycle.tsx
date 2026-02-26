import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TxLifecycleState = 'idle' | 'review' | 'signing' | 'pending' | 'success' | 'error'

const stateConfig: Record<
  TxLifecycleState,
  { label: string; icon?: typeof Loader2; colorClass: string; bgClass: string; borderClass: string }
> = {
  idle: {
    label: 'Ready',
    colorClass: 'text-zinc-400',
    bgClass: 'bg-transparent',
    borderClass: 'border-white/6',
  },
  review: {
    label: 'Review',
    colorClass: 'text-zinc-300',
    bgClass: 'bg-transparent',
    borderClass: 'border-white/6',
  },
  signing: {
    label: 'Waiting for wallet',
    icon: Loader2,
    colorClass: 'text-brand-accent',
    bgClass: 'bg-brand-primary/5',
    borderClass: 'border-brand-primary/15',
  },
  pending: {
    label: 'Confirming on Base',
    icon: Loader2,
    colorClass: 'text-zinc-300',
    bgClass: 'bg-white/[0.03]',
    borderClass: 'border-white/8',
  },
  success: {
    label: 'Complete',
    icon: CheckCircle2,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-400/5',
    borderClass: 'border-emerald-400/15',
  },
  error: {
    label: 'Failed',
    icon: XCircle,
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-400/5',
    borderClass: 'border-rose-400/15',
  },
}

export function TransactionLifecycle(props: {
  state: TxLifecycleState
  message?: string
  txHash?: string | null
  chainExplorerBase?: string
}) {
  const { state, message, txHash, chainExplorerBase = 'https://basescan.org/tx/' } = props
  if (state === 'idle' && !message) return null

  const config = stateConfig[state]
  const Icon = config.icon
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const spinning = (state === 'signing' || state === 'pending') && !reducedMotion

  return (
    <div
      role={state === 'error' ? 'alert' : 'status'}
      aria-live={state === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition-all duration-200',
        config.bgClass,
        config.borderClass,
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'mt-0.5 h-3.5 w-3.5 shrink-0',
            config.colorClass,
            spinning && 'animate-spin',
          )}
          aria-hidden="true"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className={cn('font-medium', config.colorClass)}>
          {config.label}
          {message ? (
            <span className="font-normal text-vault-subtext"> — {message}</span>
          ) : null}
        </div>
        {txHash && (
          <a
            href={`${chainExplorerBase}${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-brand-accent hover:text-white transition-colors"
          >
            View on BaseScan
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}
