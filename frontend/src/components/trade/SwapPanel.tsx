import { motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'

import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'
import { Alert } from '@/components/ui/Alert'
import { FlipButton } from '@/components/trade/FlipButton'
import { InfoStrip } from '@/components/trade/InfoStrip'
import { RouteCompareCard } from '@/components/trade/RouteCompareCard'
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
  compareRoutesEnabled: boolean
  compareRoutesLoading: boolean
  compareRoutesAvailable: boolean
  compareRoutesReason?: string | null
  compareRoutesChainName?: string | null
  compareRoutesChainId?: number | null
  compareUniswapOutUnits: string
  compareZquoteOutUnits: string
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
      <div className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Swap / Liquidity segmented control */}
          <div className="inline-flex rounded-xl border border-white/8 bg-vault-card/50 p-0.5 text-[11px]">
            {(['swap', 'liquidity'] as const).map((panel) => (
              <button
                key={panel}
                type="button"
                onClick={() => props.onSetActivePanel(panel)}
                className={`min-h-8 rounded-lg px-3 py-1 transition-colors capitalize ${
                  props.activePanel === panel
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {panel}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
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

            {/* Settings */}
            <button
              type="button"
              onClick={props.onOpenSettings}
              className="rounded-xl border border-white/8 bg-vault-card/50 p-1.5 text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
              title="Trade settings"
              aria-label="Open trade settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {props.activePanel === 'swap' ? (
        <>
          {/* ─── Token surfaces ──────────────────────────────────────────── */}
          <div className="space-y-1">
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
              className="rounded-b-[14px] border-white/10"
            />

            {/* Flip button overlapping the two surfaces */}
            <div className="-my-3.5 relative z-20 flex justify-center">
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
              className="rounded-t-[14px] border-white/10"
            />
          </div>

          {/* ─── Info strip ──────────────────────────────────────────────── */}
          {showInfoStrip && (
            <div className="mt-2">
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

          <RouteCompareCard
            enabled={props.compareRoutesEnabled}
            loading={props.compareRoutesLoading}
            available={props.compareRoutesAvailable}
            reason={props.compareRoutesReason}
            chainName={props.compareRoutesChainName}
            chainId={props.compareRoutesChainId}
            uniswapOutUnits={props.compareUniswapOutUnits}
            zquoteOutUnits={props.compareZquoteOutUnits}
            tokenOutSymbol={props.tokenOutSymbol}
          />

          {/* ─── Inline notices (single priority notice shown at a time) ─── */}
          {props.tokensEquivalent && (
            <Alert variant="error" className="mt-3">
              Select two different tokens to get a quote.
            </Alert>
          )}

          {!props.tokensEquivalent && (() => {
            // Show exactly one notice based on priority:
            // 1. error  2. stale quote  3. permit signature  4. status
            if (props.error) {
              return (
                <Alert variant="error" className="mt-2">
                  {props.error}
                </Alert>
              )
            }
            if (props.quoteIsStale && props.executionReady) {
              return (
                <Alert
                  variant="warning"
                  className="mt-2"
                  action={{ label: 'Refresh quote', onClick: props.onRefreshQuote }}
                >
                  Quote expired — prices may have changed.
                </Alert>
              )
            }
            if (props.permitSignatureRequired) {
              return (
                <Alert
                  variant={props.permitSignaturePending ? 'warning' : props.permitSignatureReady ? 'success' : 'info'}
                  className="mt-2"
                  title={
                    props.permitSignaturePending
                      ? 'Check your wallet'
                      : props.permitSignatureReady
                        ? 'Approval captured'
                        : 'One-time approval needed'
                  }
                >
                  {props.permitSignaturePending
                    ? 'Sign the one-time token approval in your wallet. No gas required.'
                    : props.permitSignatureReady
                      ? props.isOrderRoute
                        ? 'Ready to submit your order.'
                        : 'Ready to swap.'
                      : 'A one-time signature is needed to allow this token. No gas required.'}
                </Alert>
              )
            }
            if (props.status) {
              return (
                <Alert variant="success" className="mt-2">
                  {props.status}
                </Alert>
              )
            }
            return null
          })()}

          {/* ─── Fallback active notice ──────────────────────────────────── */}
          {props.executionFallbackActive && (
            <Alert variant="warning" className="mt-2" title="Agent unavailable">
              Using your connected wallet instead. Switch to Agent mode for 1-click swaps.
            </Alert>
          )}

          {/* ─── Not connected ───────────────────────────────────────────── */}
          {!props.isConnected && (
            <div className="mt-2">
              <ConnectButtonWeb3 />
            </div>
          )}

          {/* ─── Execution not ready ─────────────────────────────────────── */}
          {props.isConnected && !props.executionReady && (
            <Alert variant="warning" className="mt-2" title="Wallet not ready">
              {props.executionMode === 'canonical'
                ? 'Set up your Agent to enable 1-click swaps.'
                : 'Your wallet is not ready to submit transactions.'}
            </Alert>
          )}

          {/* ─── TX lifecycle ────────────────────────────────────────────── */}
          {props.lifecycle}

          {/* Safe-area spacer — tall enough to clear the sticky CTA + its shadow */}
          <div className="h-36 md:hidden" />

          {/* ─── Sticky CTA ──────────────────────────────────────────────── */}
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.35rem)] z-60 px-3 md:static md:inset-auto md:bottom-auto md:z-auto md:mt-3 md:px-0">
            <div className="pointer-events-auto rounded-2xl border border-white/8 bg-vault-bg/95 p-1.5 shadow-[0_-8px_24px_-6px_rgba(0,0,0,0.6)] backdrop-blur-xl md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
              <motion.button
                type="button"
                onClick={props.onReviewTrade}
                disabled={reviewDisabled}
                whileTap={reviewDisabled ? {} : { scale: 0.985 }}
                className="min-h-11 w-full rounded-xl bg-brand-primary px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_30px_-10px_rgba(0,82,255,0.6)] transition hover:bg-brand-hover disabled:opacity-50 disabled:shadow-none"
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
