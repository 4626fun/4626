import { CheckCircle2, ExternalLink, X } from 'lucide-react'

import type { SwapCompletion } from '@/hooks/useSwapExecution'

type SwapCompletionNoticeProps = {
  completion: SwapCompletion
  tokenInSymbol: string
  tokenOutSymbol: string
  onDismiss: () => void
}

function basescanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`
}

export function SwapCompletionNotice(props: SwapCompletionNoticeProps) {
  const { completion, tokenInSymbol, tokenOutSymbol, onDismiss } = props
  const explorerHash = completion.txHash ?? completion.userOpHash ?? null
  const shortHash = explorerHash
    ? `${explorerHash.slice(0, 8)}…${explorerHash.slice(-6)}`
    : null
  const confirming = !completion.txHash && Boolean(completion.userOpHash)

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 w-[min(100vw-2rem,22rem)] rounded-2xl border border-emerald-400/25 bg-[rgb(var(--vault-card)/0.97)] p-4 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.85)] backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-vault-text">
            {confirming ? 'Swap submitted' : 'Swap complete'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-vault-subtext">
            Swapped {completion.amountInUnits} {tokenInSymbol} for about {completion.estimatedOut}{' '}
            {tokenOutSymbol} on Base.
            {confirming ? ' Confirming on Base…' : null}
          </p>
          {explorerHash && !confirming ? (
            <a
              href={basescanTxUrl(explorerHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              View on BaseScan
              <ExternalLink className="h-3 w-3" aria-hidden />
              <span className="sr-only">{shortHash}</span>
            </a>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-vault-subtext transition hover:bg-white/5 hover:text-vault-text"
          aria-label="Dismiss swap confirmation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
