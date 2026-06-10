import { Alert } from '@/components/ui/Alert'
import { shortAddress } from '@/lib/uniswap/swapUtils'
import { getChainMeta } from '@/config/chains'
import { SwapCompletionNotice } from './SwapCompletionNotice'
import type { SupportedChainId } from '@/config/chains'

type SwapStatusAlertsProps = {
  activePanel: 'swap' | 'liquidity'
  needsPrivyCanonicalAuth: boolean
  authBusy: boolean
  privyClientStatus: string
  handlePrivyCanonicalSignIn: () => void
  authError: string | null
  needsEmbeddedWalletReconnect: boolean
  hydrationRecoveryBusy: boolean
  manualRecover: () => void
  privyEmbeddedEoaAddress: `0x${string}` | null
  privyEmbeddedEoaAddressSource: string | null
  showPrivyClientDisabledHint: boolean
  showPrivyLoadingHint: boolean
  quoteCooldownActive: boolean
  quoteCooldownUntil?: number | null | undefined
  showCanonicalSessionGuardHint: boolean
  canonicalSessionGuardTitle: string
  canonicalSubmitSession: any
  canonicalSessionRefreshBusy: boolean
  chainMismatch: boolean
  walletChainId?: number
  chainMeta: any
  swapChainId: SupportedChainId
  switchChainAsync: any
  swapCompletion: any
  tokenInSymbol: string
  tokenOutSymbol: string
  handleClearSwapCompletion: () => void
}

export function SwapStatusAlerts(props: SwapStatusAlertsProps) {
  const {
    activePanel,
    needsPrivyCanonicalAuth,
    authBusy,
    privyClientStatus,
    handlePrivyCanonicalSignIn,
    authError,
    needsEmbeddedWalletReconnect,
    hydrationRecoveryBusy,
    manualRecover,
    privyEmbeddedEoaAddress,
    privyEmbeddedEoaAddressSource,
    showPrivyClientDisabledHint,
    showPrivyLoadingHint,
    quoteCooldownActive,
    quoteCooldownUntil,
    showCanonicalSessionGuardHint,
    canonicalSessionGuardTitle,
    canonicalSubmitSession,
    canonicalSessionRefreshBusy,
    chainMismatch,
    walletChainId,
    chainMeta,
    swapChainId,
    switchChainAsync,
    swapCompletion,
    tokenInSymbol,
    tokenOutSymbol,
    handleClearSwapCompletion,
  } = props

  return (
    <>
      {activePanel === 'swap' && needsPrivyCanonicalAuth ? (
        <div data-screenshot-hide="true" className="mx-auto mt-4 max-w-4xl">
          <Alert
            variant="warning"
            title="Privy sign-in required for canonical swaps"
            action={{
              label: authBusy ? 'Signing in...' : 'Sign in with email',
              onClick: () => {
                if (authBusy || privyClientStatus !== 'ready') return
                handlePrivyCanonicalSignIn()
              },
            }}
          >
            Your 4626 session is active, but Privy needs to restore your embedded signer. Use the same email
            you verified on the waitlist — do not create a new wallet-only account.
            {authError ? <div className="mt-2 text-rose-300">{authError}</div> : null}
          </Alert>
        </div>
      ) : null}

      {activePanel === 'swap' && needsEmbeddedWalletReconnect ? (
        <div data-screenshot-hide="true" className="mx-auto mt-4 max-w-4xl">
          <Alert
            variant="warning"
            title="Reconnect embedded wallet to sign"
            action={{
              label: hydrationRecoveryBusy ? 'Reconnecting…' : 'Reconnect wallet',
              onClick: () => {
                if (hydrationRecoveryBusy) return
                manualRecover()
              },
            }}
          >
            Your Privy embedded wallet is detected but its signer hasn&rsquo;t fully attached
            in this session. This usually clears in a moment — tap reconnect if it doesn&rsquo;t.
            {privyEmbeddedEoaAddress ? (
              <div className="mt-2 font-mono text-xs text-zinc-300">
                Embedded EOA: {shortAddress(privyEmbeddedEoaAddress)}
                {privyEmbeddedEoaAddressSource ? (
                  <span className="ml-1 text-zinc-500">({privyEmbeddedEoaAddressSource})</span>
                ) : null}
              </div>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {activePanel === 'swap' && showPrivyClientDisabledHint ? (
        <div data-screenshot-hide="true" className="mx-auto mt-4 max-w-4xl">
          <Alert variant="warning" title="Privy is not configured for canonical swaps">
            Canonical mode requires Privy authentication and an embedded signer wallet. Enable Privy for this environment,
            then reload.
            <div className="mt-2 text-zinc-300">
              Set <span className="font-mono text-zinc-200">VITE_PRIVY_ENABLED=true</span> with a valid Privy app
              configuration.
            </div>
          </Alert>
        </div>
      ) : null}

      {activePanel === 'swap' && showPrivyLoadingHint ? (
        <div data-screenshot-hide="true" className="mx-auto mt-4 max-w-4xl">
          <Alert variant="warning" title="Initializing Privy for canonical signing">
            Waiting for the Privy client/session to finish loading before canonical signer checks can complete.
          </Alert>
        </div>
      ) : null}

      {activePanel === 'swap' && quoteCooldownActive ? (
        <div data-screenshot-hide="true" className="mx-auto mt-4 max-w-4xl">
          <Alert variant="warning" title="Auto-quote paused briefly">
            Repeated upstream failures were detected. Auto-quote will resume in a few seconds.
            {quoteCooldownUntil ? (
              <div className="mt-1 text-zinc-300">
                Resume time: {new Date(quoteCooldownUntil).toLocaleTimeString()}
              </div>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {showCanonicalSessionGuardHint && !canonicalSessionRefreshBusy ? (
        <div data-screenshot-hide="true" className="mx-auto mt-4 max-w-4xl">
          <Alert variant="warning" title={canonicalSessionGuardTitle}>
            {canonicalSubmitSession.message}
          </Alert>
        </div>
      ) : null}

      {chainMismatch ? (
        <div
          data-screenshot-hide="true"
          className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-linear-to-b from-amber-500/16 to-amber-500/8 px-3 py-2.5 backdrop-blur-sm"
        >
          <div className="text-xs text-amber-200">
            Your wallet is on {walletChainId ? getChainMeta(walletChainId)?.name ?? `chain ${walletChainId}` : 'a different network'}. Switch to {chainMeta?.name ?? 'the selected network'} to trade.
          </div>
          <button
            type="button"
            onClick={() => {
              if (switchChainAsync) void switchChainAsync({ chainId: swapChainId }).catch(() => {})
            }}
            className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 transition"
          >
            Switch
          </button>
        </div>
      ) : null}

      {activePanel === 'swap' && swapCompletion ? (
        <SwapCompletionNotice
          completion={swapCompletion}
          tokenInSymbol={tokenInSymbol}
          tokenOutSymbol={tokenOutSymbol}
          onDismiss={handleClearSwapCompletion}
        />
      ) : null}
    </>
  )
}
