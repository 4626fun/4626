import { motion } from 'framer-motion'
import { Settings, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'
import { FlipButton } from '@/components/trade/FlipButton'
import { InfoStrip } from '@/components/trade/InfoStrip'
import { RouteViz } from '@/components/trade/RouteViz'
import { TokenAmountSurface } from '@/components/trade/TokenAmountSurface'
import { WalletModeToggle } from '@/components/trade/WalletModeToggle'
import type { WalletMode } from '@/lib/uniswap/walletMode'
import type { TokenDisplay, TokenOption } from '@/lib/uniswap/swapUtils'

export function SwapPanel(props: {
  // Token state
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
  tokenInBalanceLabel?: string
  tokenOutBalanceLabel?: string
  // Wallet / execution
  isConnected: boolean
  executionMode: WalletMode
  preferredMode: WalletMode
  executionAddress: `0x${string}` | null
  executionReady: boolean
  canonicalAvailable: boolean
  canonicalConfigured: boolean
  eoaAvailable: boolean
  executionFallbackActive: boolean
  // Trade state
  parsedSlippage: number
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
  isOrderRoute: boolean
  permitSignatureRequired: boolean
  permitSignaturePending: boolean
  permitSignatureReady: boolean
  // Active panel (for mode toggle in execution bar)
  activePanel: 'swap' | 'liquidity'
  // TX lifecycle node
  lifecycle: ReactNode
  // Callbacks
  onSetTokenIn: (next: string) => void
  onSetTokenOut: (next: string) => void
  onSetAmountInUnits: (next: string) => void
  onSwitchTokens: () => void
  onReviewTrade: () => void
  onRefreshQuote: () => void
  onOpenSettings: () => void
  onSetActivePanel: (panel: 'swap' | 'liquidity') => void
  onSetExecutionMode: (mode: WalletMode) => void
  onEnableCanonical: () => void
}) {
  const reviewDisabled =
    !props.isConnected ||
    !props.executionReady ||
    !props.isReady ||
    props.busy !== null ||
    props.quoteIsStale ||
    props.tokenInIdentityLoading ||
    props.tokenOutIdentityLoading

  const showInfoStrip =
    Boolean(props.amountInUnits) && Boolean(props.estimatedOut) && !props.tokensEquivalent

  return (
    <>
      {/* ─── Execution Bar ─────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {/* Swap / Liquidity segmented control */}
        <div className="inline-flex rounded-full border border-white/12 bg-black/40 p-0.5 text-xs">
          {(['swap', 'liquidity'] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => props.onSetActivePanel(panel)}
              className={`min-h-7 rounded-full px-3 py-1 transition-colors capitalize ${
                props.activePanel === panel
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {panel}
            </button>
          ))}
        </div>

        {/* Route chip — tapping opens the settings sheet */}
        <button
          type="button"
          onClick={props.onOpenSettings}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:bg-white/8 hover:text-zinc-300"
        >
          <Zap className="h-3 w-3 text-brand-400" />
          <RouteViz routeSummary={props.routeSummary} compact />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <button
          type="button"
          onClick={props.onOpenSettings}
          className="rounded-full border border-white/12 bg-white/4 p-2 text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200"
          title="Trade settings"
          aria-label="Open trade settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {/* Wallet mode toggle (compact) */}
        <WalletModeToggle
          mode={props.executionMode}
          preferredMode={props.preferredMode}
          executionAddress={props.executionAddress}
          busy={props.busy !== null}
          canonicalAvailable={props.canonicalAvailable}
          canonicalConfigured={props.canonicalConfigured}
          eoaAvailable={props.eoaAvailable}
          fallbackActive={props.executionFallbackActive}
          onChange={props.onSetExecutionMode}
          onEnableCanonical={props.onEnableCanonical}
          compact
        />
      </div>

      {props.activePanel === 'swap' ? (
        <>
          {/* ─── Token surfaces ──────────────────────────────────────────── */}
          <div className="space-y-0.5">
            <TokenAmountSurface
              label="You pay"
              amount={props.amountInUnits}
              token={props.tokenIn}
              tokenOptions={props.tokenOptions}
              display={props.tokenInDisplay}
              isLoading={props.tokenInIdentityLoading}
              onAmountChange={props.onSetAmountInUnits}
              onTokenChange={props.onSetTokenIn}
              amountPlaceholder="0"
              fiatValueLabel="≈ -- USD"
              balanceLabel={props.tokenInBalanceLabel}
              showMax={false}
              className="rounded-b-md"
            />

            {/* Flip button overlapping the two surfaces */}
            <div className="-my-3 flex justify-center relative z-10">
              <FlipButton onClick={props.onSwitchTokens} disabled={props.busy !== null} />
            </div>

            <TokenAmountSurface
              label="You receive"
              amount={props.estimatedOut}
              token={props.tokenOut}
              tokenOptions={props.tokenOptions}
              display={props.tokenOutDisplay}
              isLoading={props.tokenOutIdentityLoading}
              onTokenChange={props.onSetTokenOut}
              amountPlaceholder="0"
              readOnlyAmount
              fiatValueLabel="≈ -- USD"
              balanceLabel={props.tokenOutBalanceLabel}
              className="rounded-t-md"
            />
          </div>

          {/* ─── Info strip ──────────────────────────────────────────────── */}
          {showInfoStrip && (
            <div className="mt-3">
              <InfoStrip
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
            </div>
          )}

          {/* ─── Inline notices (single priority notice shown at a time) ─── */}
          {props.tokensEquivalent && (
            <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-xs text-rose-300">
              Select two different tokens to get a quote.
            </div>
          )}

          {!props.tokensEquivalent && (() => {
            // Show exactly one notice based on priority:
            // 1. error  2. stale quote  3. permit signature  4. status
            if (props.error) {
              return (
                <div className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-xs text-rose-300">
                  {props.error}
                </div>
              )
            }
            if (props.quoteIsStale && props.executionReady) {
              return (
                <motion.button
                  type="button"
                  onClick={props.onRefreshQuote}
                  disabled={props.busy !== null}
                  whileTap={{ scale: 0.97 }}
                  className="mt-2 rounded-full border border-amber-400/30 bg-amber-500/8 px-3 py-1 text-xs text-amber-300 transition hover:bg-amber-500/15 disabled:opacity-50"
                >
                  Quote expired — refresh
                </motion.button>
              )
            }
            if (props.permitSignatureRequired) {
              return (
                <div
                  className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
                    props.permitSignaturePending
                      ? 'border-amber-400/30 bg-amber-500/8 text-amber-300'
                      : props.permitSignatureReady
                        ? 'border-emerald-400/30 bg-emerald-500/8 text-emerald-200'
                        : 'border-blue-400/25 bg-blue-500/8 text-blue-300'
                  }`}
                >
                  {props.permitSignaturePending
                    ? 'Check your wallet — signature required.'
                    : props.permitSignatureReady
                      ? props.isOrderRoute
                        ? 'Signature captured. Ready to submit order.'
                        : 'Signature captured. Ready to swap.'
                      : 'A one-time signature is needed before submission.'}
                </div>
              )
            }
            if (props.status) {
              return <div className="mt-2 text-xs text-emerald-400">{props.status}</div>
            }
            return null
          })()}

          {/* ─── Not connected ───────────────────────────────────────────── */}
          {!props.isConnected && (
            <div className="mt-3">
              <ConnectButtonWeb3 />
            </div>
          )}

          {/* ─── Execution not ready ─────────────────────────────────────── */}
          {props.isConnected && !props.executionReady && (
            <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-300">
              {props.executionMode === 'canonical'
                ? 'Set up your Smart Wallet to trade with enhanced security.'
                : 'Your wallet is not ready to submit transactions.'}
            </div>
          )}

          {/* ─── TX lifecycle ────────────────────────────────────────────── */}
          {props.lifecycle}

          {/* Safe-area spacer — tall enough to clear the sticky CTA + its shadow */}
          <div className="h-36 md:hidden" />

          {/* ─── Sticky CTA ──────────────────────────────────────────────── */}
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-60 px-4 md:static md:inset-auto md:bottom-auto md:z-auto md:mt-4 md:px-0">
            <div className="pointer-events-auto rounded-2xl border border-white/8 bg-vault-card/90 p-2 shadow-[0_-6px_20px_-4px_rgba(0,0,0,0.7)] backdrop-blur-xl md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
              <motion.button
                type="button"
                onClick={props.onReviewTrade}
                disabled={reviewDisabled}
                whileTap={reviewDisabled ? {} : { scale: 0.985 }}
                className="min-h-12 w-full rounded-xl bg-brand-primary px-4 py-3 text-base font-semibold text-white shadow-[0_4px_24px_-8px_rgba(0,82,255,0.5)] transition hover:bg-brand-hover disabled:opacity-50 disabled:shadow-none"
              >
                {props.busy === 'review' ? 'Reviewing…' : props.isOrderRoute ? 'Review order' : 'Review swap'}
              </motion.button>
            </div>
          </div>
        </>
      ) : (
        /* Liquidity panel placeholder — rendered by parent Swap.tsx */
        null
      )}
    </>
  )
}
