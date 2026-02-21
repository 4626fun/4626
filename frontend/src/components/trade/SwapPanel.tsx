import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'
import { FlipButton } from '@/components/trade/FlipButton'
import { TokenAmountInput } from '@/components/trade/TokenAmountInput'
import { TradeCard } from '@/components/trade/TradeCard'
import { TradeDetails } from '@/components/trade/TradeDetails'
import type { ReactNode } from 'react'
import type { TokenDisplay, TokenOption } from '@/lib/uniswap/swapUtils'

export function SwapPanel(props: {
  tokenOptions: TokenOption[]
  tokenIn: string
  tokenOut: string
  tokenInDisplay: TokenDisplay
  tokenOutDisplay: TokenDisplay
  tokenInIdentityLoading: boolean
  tokenOutIdentityLoading: boolean
  amountInUnits: string
  estimatedOut: string
  tokenInSymbol: string
  tokenOutSymbol: string
  parsedSlippage: number
  isConnected: boolean
  executionMode: 'canonical' | 'eoa'
  executionReady: boolean
  isReady: boolean
  busy: string | null
  quoteIsStale: boolean
  quoteUpdatedAt: number | null
  status: string
  error: string
  tokensEquivalent: boolean
  priceImpactLabel?: string | null
  gasEstimateLabel?: string | null
  routeSummary?: string | null
  permitSignatureRequired: boolean
  permitSignaturePending: boolean
  permitSignatureReady: boolean
  lifecycle: ReactNode
  onSetTokenIn: (next: string) => void
  onSetTokenOut: (next: string) => void
  onSetAmountInUnits: (next: string) => void
  onSwitchTokens: () => void
  onReviewTrade: () => void
  onRefreshQuote: () => void
}) {
  const reviewDisabled =
    !props.isConnected ||
    !props.executionReady ||
    !props.isReady ||
    props.busy !== null ||
    props.quoteIsStale ||
    props.tokenInIdentityLoading ||
    props.tokenOutIdentityLoading

  return (
    <>
      <TradeCard>
        <TokenAmountInput
          label="Sell"
          amount={props.amountInUnits}
          token={props.tokenIn}
          tokenOptions={props.tokenOptions}
          display={props.tokenInDisplay}
          isLoading={props.tokenInIdentityLoading}
          onAmountChange={props.onSetAmountInUnits}
          onTokenChange={props.onSetTokenIn}
          fiatValueLabel="≈ -- USD"
          amountPlaceholder="0.0"
        />
      </TradeCard>

      <div className="-my-2 flex justify-center">
        <FlipButton onClick={props.onSwitchTokens} />
      </div>

      <TradeCard>
        <TokenAmountInput
          label="Buy"
          amount={props.estimatedOut}
          token={props.tokenOut}
          tokenOptions={props.tokenOptions}
          display={props.tokenOutDisplay}
          isLoading={props.tokenOutIdentityLoading}
          onTokenChange={props.onSetTokenOut}
          amountPlaceholder="0.0"
          readOnlyAmount
          fiatValueLabel="≈ -- USD"
        />
      </TradeCard>

      <TradeDetails
        tokenInSymbol={props.tokenInSymbol}
        tokenOutSymbol={props.tokenOutSymbol}
        amountInUnits={props.amountInUnits}
        estimatedOut={props.estimatedOut}
        parsedSlippage={props.parsedSlippage}
        quoteUpdatedAt={props.quoteUpdatedAt}
        quoteIsStale={props.quoteIsStale}
        priceImpactLabel={props.priceImpactLabel}
        gasEstimateLabel={props.gasEstimateLabel}
        routeSummary={props.routeSummary}
      />

      {props.tokensEquivalent ? (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Choose two non-equivalent tokens to generate a quote.
        </div>
      ) : null}
      {props.permitSignatureRequired ? (
        <div
          className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
            props.permitSignaturePending
              ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
              : props.permitSignatureReady
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                : 'border-blue-400/40 bg-blue-500/10 text-blue-200'
          }`}
        >
          {props.permitSignaturePending
            ? 'Permit2 signature pending in wallet (off-chain).'
            : props.permitSignatureReady
              ? 'Permit2 signature captured for this quote.'
              : 'This quote requires a Permit2 off-chain signature before swap submission.'}
        </div>
      ) : null}
      {props.status ? <div className="mt-2 text-xs text-emerald-300">{props.status}</div> : null}
      {props.error ? <div className="mt-2 text-xs text-rose-300">{props.error}</div> : null}
      {!props.isConnected ? (
        <div className="mt-3">
          <ConnectButtonWeb3 />
        </div>
      ) : null}
      {props.isConnected && !props.executionReady ? (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {props.executionMode === 'canonical'
            ? 'Connect an owner signer for your canonical smart wallet to trade.'
            : 'Connected wallet is not ready to submit transactions.'}
        </div>
      ) : null}

      {props.quoteIsStale ? (
        <button
          type="button"
          onClick={props.onRefreshQuote}
          disabled={props.busy !== null || !props.executionReady}
          className="mt-2 rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-200 disabled:opacity-50"
        >
          Refresh quote
        </button>
      ) : null}
      {props.lifecycle}

      <div className="h-24 md:hidden" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.2rem)] z-60 px-4 md:static md:inset-auto md:bottom-auto md:z-auto md:mt-4 md:px-0">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-vault-card/90 p-2 shadow-[0_-14px_36px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
          <button
            type="button"
            onClick={props.onReviewTrade}
            disabled={reviewDisabled}
            className="min-h-11 w-full rounded-xl bg-fuchsia-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-50"
          >
            {props.busy === 'review' ? 'Reviewing…' : 'Review swap'}
          </button>
        </div>
      </div>
    </>
  )
}

