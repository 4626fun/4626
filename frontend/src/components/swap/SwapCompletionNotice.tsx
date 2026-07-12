import { ExternalLink, X } from 'lucide-react'

import { TokenAvatar } from '@/components/swap/TokenAvatar'
import type { SwapCompletion } from '@/hooks/useSwapExecution'
import type { TokenDisplay } from '@/lib/uniswap/swapUtils'

type SwapCompletionNoticeProps = {
  completion: SwapCompletion
  tokenIn: TokenDisplay
  tokenOut: TokenDisplay
  onDismiss: () => void
}

function basescanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`
}

function formatSwapAmount(rawAmount: string): string {
  const amount = Number(rawAmount)
  if (!Number.isFinite(amount)) return rawAmount
  if (amount === 0) return '0'

  const absoluteAmount = Math.abs(amount)
  if (absoluteAmount >= 1) {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: absoluteAmount >= 1_000 ? 2 : 4,
    })
  }

  return amount.toLocaleString('en-US', {
    maximumSignificantDigits: 4,
  })
}

export function SwapCompletionNotice(props: SwapCompletionNoticeProps) {
  const { completion, tokenIn, tokenOut, onDismiss } = props
  const explorerHash = completion.txHash ?? completion.userOpHash ?? null
  const shortHash = explorerHash
    ? `${explorerHash.slice(0, 8)}…${explorerHash.slice(-6)}`
    : null
  const confirming = !completion.txHash && Boolean(completion.userOpHash)
  const swapSummary = `${formatSwapAmount(completion.amountInUnits)} ${tokenIn.symbol} for ${formatSwapAmount(completion.estimatedOut)} ${tokenOut.symbol}`

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-4 z-50 w-[min(100vw-2rem,22rem)] rounded-[20px] border border-white/10 bg-[rgb(var(--vault-card)/0.98)] px-4 py-3 shadow-[0_18px_48px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <div className="relative h-8 w-11 shrink-0" aria-hidden>
          <TokenAvatar
            imageUrl={tokenIn.logoUrl}
            symbol={tokenIn.symbol}
            size={32}
            className="absolute left-0 top-0"
            withFallbackLabel
          />
          <TokenAvatar
            imageUrl={tokenOut.logoUrl}
            symbol={tokenOut.symbol}
            size={24}
            className="absolute bottom-0 right-0 ring-2 ring-[rgb(var(--vault-card))]"
            withFallbackLabel
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-vault-text">
            {confirming ? 'Swap submitted' : 'Swapped'}
          </p>
          {explorerHash && !confirming ? (
            <a
              href={basescanTxUrl(explorerHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs leading-relaxed text-vault-subtext transition hover:text-vault-text focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70"
              aria-label={`View swap transaction ${shortHash ?? ''} on BaseScan`}
            >
              <span className="truncate">{swapSummary}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          ) : (
            <p className="mt-0.5 truncate text-xs leading-relaxed text-vault-subtext">
              {swapSummary}
              {confirming ? ' · Confirming on Base…' : null}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 rounded-lg p-1 text-vault-subtext transition hover:bg-white/5 hover:text-vault-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70"
          aria-label="Dismiss swap confirmation"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
