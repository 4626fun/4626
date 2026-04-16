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
}

export type SwapConnectGateResult = {
  state: SwapConnectGateState
  /** True when the swap form should render. */
  ready: boolean
  /** Human copy intended for the gate card. */
  title: string
  message: string
  /** Primary CTA label; empty when state === 'ready'. */
  actionLabel: string
}

const COPY: Record<SwapConnectGateState, { title: string; message: string; actionLabel: string }> = {
  hydrating: {
    title: 'Restoring your 4626 session',
    message: 'Checking your account — this only takes a moment.',
    actionLabel: '',
  },
  'signed-out': {
    title: 'Sign in to start swapping',
    message:
      'Swaps on 4626 use Uniswap routing through your 4626 account. Sign in with email or your wallet to get quotes and trade.',
    actionLabel: 'Sign in to 4626',
  },
  'wallet-required': {
    title: 'Connect a wallet to swap',
    message:
      'Your 4626 session is active, but we still need a connected wallet on this device to sign swap transactions.',
    actionLabel: 'Connect wallet',
  },
  ready: {
    title: '',
    message: '',
    actionLabel: '',
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
  }
}

function computeState(input: SwapConnectGateInput): SwapConnectGateState {
  if (!input.sessionHydrated) return 'hydrating'

  if (!input.hasSession) return 'signed-out'

  if (!isNonEmptyString(input.executionAddress)) return 'wallet-required'

  return 'ready'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
