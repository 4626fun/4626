import { ArrowDownUp, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

import { SwapDetails } from '@/components/swap/SwapDetails'
import { TokenInput } from '@/components/swap/TokenInput'
import { WalletModeToggle } from '@/components/trade/WalletModeToggle'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { TokenDisplay } from '@/lib/uniswap/swapUtils'

type SwapCardProps = {
  tokenInDisplay: TokenDisplay
  tokenOutDisplay: TokenDisplay
  tokenInIdentityLoading: boolean
  tokenOutIdentityLoading: boolean
  amountInUnits: string
  estimatedOut: string
  estimatedOutUsd: string | null
  tokenInSymbol: string
  tokenOutSymbol: string
  tokenInBalanceLabel?: string
  tokenOutBalanceLabel?: string
  isConnected: boolean
  isReady: boolean
  busy: string | null
  status?: string | null
  error?: string | null
  quoteIsStale: boolean
  quoteUpdatedAt?: string | null
  approvalRequired?: boolean
  tokenInAddress: string
  tokenOutAddress: string
  routeSummary: string | null
  gasEstimateLabel: string | null
  priceImpactLabel: string | null
  parsedSlippage: string
  lpFeeUsd?: string | null
  protocolFeeUsd?: string | null
  slippagePct: string
  onOpenTokenSelector: (side: 'input' | 'output') => void
  onAmountChange: (value: string) => void
  onQuickPercent: (pct: number, tokenBalance: string | null) => void
  onSwitchTokens: () => void
  onReviewTrade: () => void
  onRefreshQuote: () => void
  onSetSlippagePct: (pct: string) => void
  onSetExecutionMode: (mode: 'canonical' | 'eoa') => void
  onConfirmUnverified: () => void
  preferredMode: 'canonical' | 'eoa'
  executionMode: 'canonical' | 'eoa'
  executionAddress?: string | null
  canonicalAvailable: boolean
  canonicalConfigured: boolean
  eoaAvailable: boolean
  fallbackActive: boolean
  onEnableCanonical: () => void
  needsUnverifiedConfirmation: boolean
  unverifiedTokenLabel?: string | null
  onResetUnverified: () => void
}

export function SwapCard(props: SwapCardProps) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-vault-card/70 p-4 shadow-[0_18px_45px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between">
        <div className="text-sm text-zinc-400">
          <div className="text-[11px] uppercase tracking-[0.25em]">Swap</div>
          <div className="mt-1 text-lg font-semibold text-white">Token exchange</div>
        </div>
        <WalletModeToggle
          mode={props.executionMode}
          preferredMode={props.preferredMode}
          executionAddress={
            props.executionAddress
              ? (props.executionAddress as `0x${string}`)
              : null
          }
          busy={props.busy !== null}
          canonicalAvailable={props.canonicalAvailable}
          canonicalConfigured={props.canonicalConfigured}
          eoaAvailable={props.eoaAvailable}
          fallbackActive={props.fallbackActive}
          onChange={props.onSetExecutionMode}
          onEnableCanonical={props.onEnableCanonical}
          hideLabel
          compact
        />
      </div>

      <div className="space-y-3">
        <TokenInput
          label="Sell"
          amount={props.amountInUnits}
          token={props.tokenInDisplay}
          tokenAddress={props.tokenInAddress}
          tokenIdentityLoading={props.tokenInIdentityLoading}
          readOnly={false}
          onAmountChange={props.onAmountChange}
          onSelectToken={() => props.onOpenTokenSelector('input')}
          onQuickPercent={props.onQuickPercent}
          balanceLabel={props.tokenInBalanceLabel}
          inputAriaLabel="Amount to sell"
        />

        <div className="relative">
          <motion.button
            type="button"
            onClick={props.onSwitchTokens}
            whileTap={{ scale: 0.96 }}
            className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/14 bg-black/45"
            aria-label="Switch tokens"
          >
            <ArrowDownUp className="h-4 w-4 text-zinc-200" />
            <span className="sr-only">Switch tokens</span>
          </motion.button>
          <div className="h-px bg-gradient-to-r from-white/0 via-white/25 to-white/0" />
        </div>

        <TokenInput
          label="Buy"
          amount={props.estimatedOut}
          readOnly
          amountUsd={props.estimatedOutUsd || undefined}
          token={props.tokenOutDisplay}
          tokenAddress={props.tokenOutAddress}
          tokenIdentityLoading={props.tokenOutIdentityLoading}
          onAmountChange={() => {}}
          onSelectToken={() => props.onOpenTokenSelector('output')}
          inputAriaLabel="Amount to receive"
        />
      </div>

      {props.unverifiedTokenLabel ? (
        <Alert variant="warning" className="mt-3">
          Unverified token selected: {props.unverifiedTokenLabel}. Confirm before you swap.
          <div className="mt-2">
            <button
              type="button"
              className="text-xs text-zinc-300 underline"
              onClick={props.onResetUnverified}
            >
              Re-verify token selection
            </button>
          </div>
        </Alert>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        className="mt-3 w-full"
        onClick={props.needsUnverifiedConfirmation ? props.onConfirmUnverified : props.onReviewTrade}
        loading={props.busy === 'pending'}
        disabled={
          !props.isReady ||
          !props.isConnected ||
          props.busy !== null ||
          false
        }
      >
        {props.busy ? 'Preparing…' : props.needsUnverifiedConfirmation ? 'Confirm unverified token to swap' : 'Review swap'}
      </Button>

      {props.error ? <Alert variant="destructive" className="mt-3">{props.error}</Alert> : null}
      {props.status && <div className="mt-2 text-xs text-zinc-500">{props.status}</div>}
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>Quote {props.quoteIsStale ? '(stale)' : '(fresh)'}</span>
        <button
          type="button"
          onClick={props.onRefreshQuote}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <SwapDetails
        routeSummary={props.routeSummary}
        slippagePct={props.slippagePct}
        onSetSlippagePct={props.onSetSlippagePct}
        aggregator={props.routeSummary ? 'Uniswap' : undefined}
        gasEstimateLabel={props.gasEstimateLabel}
        priceImpactLabel={props.priceImpactLabel}
        lpFeeUsd={props.lpFeeUsd ?? null}
        protocolFeeUsd={props.protocolFeeUsd ?? null}
        quoteUpdatedAt={props.quoteUpdatedAt ?? null}
      />
    </div>
  )
}
