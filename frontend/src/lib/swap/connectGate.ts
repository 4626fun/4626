/**
 * Pure state machine for the /swap route-level connect gate.
 *
 * The swap form requires a fully-resolved execution wallet before it is
 * useful — quotes need an on-chain sender, and the session gate inside
 * `useSwapExecution` blocks `isReady` until a 4626 session is active.
 * Rather than letting users sit on a silently-disabled "Swap now" button,
 * /swap pre-gates on a single clear call-to-action.
 *
 * This module is intentionally framework-free so it can be unit-tested
 * without mounting React. The `SwapConnectGate` component maps states to
 * UI, and `Swap.tsx` maps states to actions.
 */

export type SwapConnectGateState =
  | 'hydrating'
  | 'signing-in'
  | 'signed-out'
  | 'wallet-required'
  | 'ready'

export type SwapConnectGateInput = {
  /** True once useSiweAuth has finished its initial /api/auth/me probe. */
  sessionHydrated: boolean
  /** True when a 4626 session cookie is active for this principal. */
  hasSession: boolean
  /**
   * The canonical execution address resolved by `useAccountContext`.
   * Null/undefined means there is no signer wagmi can talk to yet, so
   * quote and swap endpoints would reject the request.
   */
  executionAddress: string | null | undefined
  /**
   * True while a `signIn` / Privy login request is in flight. Keeps the
   * gate in a stable "signing-in" state during the short window between
   * session creation and wagmi attaching the wallet, avoiding a transient
   * "Connect a wallet to swap" flash right after the user signs in.
   */
  authBusy?: boolean
}

export type SwapConnectGateResult = {
  state: SwapConnectGateState
  /** True when the swap form should render. */
  ready: boolean
  /** Human copy intended for the gate card. */
  title: string
  message: string
  /** Primary CTA label; empty when state has no actionable button. */
  actionLabel: string
  /** True when the gate should show a spinner instead of a CTA. */
  showSpinner: boolean
  /** Accessible label for the spinner when shown. */
  spinnerLabel: string
}

type GateCopy = {
  title: string
  message: string
  actionLabel: string
  showSpinner: boolean
  spinnerLabel: string
}

const COPY: Record<SwapConnectGateState, GateCopy> = {
  hydrating: {
    title: 'Restoring your 4626 session',
    message: 'Checking your account — this only takes a moment.',
    actionLabel: '',
    showSpinner: true,
    spinnerLabel: 'Restoring session',
  },
  'signing-in': {
    title: 'Signing you in',
    message: 'Finish the prompt in your wallet or email to continue.',
    actionLabel: '',
    showSpinner: true,
    spinnerLabel: 'Signing in',
  },
  'signed-out': {
    title: 'Sign in to start swapping',
    message:
      'Swaps on 4626 use Uniswap routing through your 4626 account. Sign in with email or your wallet to get quotes and trade.',
    actionLabel: 'Sign in to 4626',
    showSpinner: false,
    spinnerLabel: '',
  },
  'wallet-required': {
    title: 'Connect a wallet to swap',
    message:
      'Your 4626 session is active, but we still need a connected wallet on this device to sign swap transactions.',
    actionLabel: 'Connect wallet',
    showSpinner: false,
    spinnerLabel: '',
  },
  ready: {
    title: '',
    message: '',
    actionLabel: '',
    showSpinner: false,
    spinnerLabel: '',
  },
}

export function deriveSwapConnectGate(input: SwapConnectGateInput): SwapConnectGateResult {
  const state = computeState(input)
  const copy = COPY[state]
  return {
    state,
    ready: state === 'ready',
    title: copy.title,
    message: copy.message,
    actionLabel: copy.actionLabel,
    showSpinner: copy.showSpinner,
    spinnerLabel: copy.spinnerLabel,
  }
}

function computeState(input: SwapConnectGateInput): SwapConnectGateState {
  if (!input.sessionHydrated) return 'hydrating'

  const executionReady = isNonEmptyString(input.executionAddress)

  // Hold a stable "signing-in" state whenever auth is busy and the pipeline
  // has not yet landed on a ready execution wallet. This covers:
  //   1. signed-out + busy — user is finishing the Privy modal.
  //   2. hasSession but no executionAddress + busy — session just created,
  //      wagmi connector still attaching.
  if (input.authBusy && !executionReady) return 'signing-in'

  if (!input.hasSession) return 'signed-out'

  if (!executionReady) return 'wallet-required'

  return 'ready'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
