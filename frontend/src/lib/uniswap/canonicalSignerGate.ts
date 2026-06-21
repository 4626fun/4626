import { isAddress } from 'viem'

import type { WalletMode } from '@/lib/uniswap/walletMode'
import type { UserExecutionTrack } from '@/lib/tx/txRouter'

export type CanonicalOwnerCheckStatus = 'owner' | 'not-owner' | 'pending' | 'unknown'
export type CanonicalAuthStatus = 'authenticated' | 'unauthenticated' | 'unknown'
export type CanonicalPrivyClientStatus = 'disabled' | 'loading' | 'ready'

export type CanonicalSignerGateInput = {
  executionMode: WalletMode
  executionTrack?: UserExecutionTrack | null
  canonicalAddress: string | null
  baseSubAccountAddress?: string | null
  subAccountProviderReady?: boolean
  clientStatus?: CanonicalPrivyClientStatus
  authStatus?: CanonicalAuthStatus
  embeddedWalletDetected: boolean
  embeddedWalletAddress: string | null
  embeddedWalletCanSign: boolean
  ownerCheckStatus: CanonicalOwnerCheckStatus
}

export type CanonicalSignerGateResult = {
  required: boolean
  ready: boolean
  code:
    | 'not-required'
    | 'privy-client-disabled'
    | 'privy-auth-loading'
    | 'privy-auth-required'
    | 'missing-canonical-address'
    | 'base-sub-account-missing'
    | 'base-sub-account-invalid'
    | 'base-sub-account-provider-missing'
    | 'execution-setup-required'
    | 'embedded-wallet-missing'
    | 'embedded-wallet-address-invalid'
    | 'embedded-wallet-cannot-sign'
    | 'owner-check-pending'
    | 'embedded-wallet-not-owner'
    | 'owner-removed-stale-track'
    | 'ok'
  reason: string | null
}

function gateFailure(
  code: Exclude<CanonicalSignerGateResult['code'], 'not-required' | 'ok'>,
  reason: string,
): CanonicalSignerGateResult {
  return {
    required: true,
    ready: false,
    code,
    reason,
  }
}

function isSubAccountTrack(track: UserExecutionTrack | null | undefined): boolean {
  return track === 'sub-account'
}

export function evaluateCanonicalSignerGate(input: CanonicalSignerGateInput): CanonicalSignerGateResult {
  if (input.executionMode !== 'canonical') {
    return {
      required: false,
      ready: true,
      code: 'not-required',
      reason: null,
    }
  }

  if ((input.clientStatus ?? 'ready') === 'disabled') {
    return gateFailure(
      'privy-client-disabled',
      'Privy is not configured for this environment. Canonical swaps require Privy auth with an embedded wallet.',
    )
  }

  if ((input.clientStatus ?? 'ready') === 'loading') {
    return gateFailure(
      'privy-auth-loading',
      'Privy client is still initializing before canonical signer checks can run.',
    )
  }

  if (!input.canonicalAddress || !isAddress(input.canonicalAddress)) {
    return gateFailure(
      'missing-canonical-address',
      'Canonical mode requires a canonical smart wallet address before signing can proceed.',
    )
  }

  const subAccountTrack = isSubAccountTrack(input.executionTrack)

  if (input.executionTrack === 'none-yet') {
    if (input.ownerCheckStatus === 'owner') {
      // Server track can lag behind on-chain owner confirmation (e.g. stale
      // `/api/accounts/me` during local dev). Do not block swaps when the
      // embedded owner is already verified.
    } else if (input.ownerCheckStatus === 'pending' || input.ownerCheckStatus === 'unknown') {
      return gateFailure(
        'owner-check-pending',
        'Loading account execution status before canonical swaps.',
      )
    } else {
      return gateFailure(
        'execution-setup-required',
        'Enable 4626 signing in account setup before canonical swaps.',
      )
    }
  }

  if ((input.authStatus ?? 'unknown') === 'unauthenticated') {
    return gateFailure(
      'privy-auth-required',
      'Sign in with Privy to load your embedded wallet for canonical swaps.',
    )
  }

  if ((input.authStatus ?? 'unknown') === 'unknown' && !input.embeddedWalletDetected) {
    return gateFailure(
      'privy-auth-loading',
      'Waiting for Privy session state before canonical signer checks.',
    )
  }

  if (!input.embeddedWalletDetected) {
    return gateFailure(
      'embedded-wallet-missing',
      'Privy embedded wallet not detected. Sign in with Privy to authorize canonical swaps.',
    )
  }

  if (!input.embeddedWalletAddress || !isAddress(input.embeddedWalletAddress)) {
    return gateFailure(
      'embedded-wallet-address-invalid',
      'Privy embedded wallet address is unavailable or invalid for canonical signing.',
    )
  }

  if (!input.embeddedWalletCanSign) {
    return gateFailure(
      'embedded-wallet-cannot-sign',
      'Privy embedded wallet cannot sign in this session.',
    )
  }

  if (subAccountTrack) {
    if (!input.baseSubAccountAddress) {
      return gateFailure(
        'base-sub-account-missing',
        'Canonical swaps require your app-scoped Base sub-account.',
      )
    }
    if (!isAddress(input.baseSubAccountAddress)) {
      return gateFailure(
        'base-sub-account-invalid',
        'Canonical swaps require a valid app-scoped Base sub-account address.',
      )
    }
    if (input.baseSubAccountAddress.toLowerCase() === input.canonicalAddress.toLowerCase()) {
      return gateFailure(
        'base-sub-account-invalid',
        'Canonical swaps require a distinct app-scoped Base sub-account.',
      )
    }
    if (input.subAccountProviderReady !== true) {
      if (input.ownerCheckStatus === 'owner') {
        return {
          required: true,
          ready: true,
          code: 'ok',
          reason: null,
        }
      }
      if (input.ownerCheckStatus === 'pending' || input.ownerCheckStatus === 'unknown') {
        return gateFailure(
          'owner-check-pending',
          'Waiting for canonical ownership check before falling back from sub-account routing.',
        )
      }
      return gateFailure(
        'base-sub-account-provider-missing',
        'Reconnect with Base Account to route canonical swaps through your 4626 sub-account.',
      )
    }
    return {
      required: true,
      ready: true,
      code: 'ok',
      reason: null,
    }
  }

  if (input.ownerCheckStatus === 'pending' || input.ownerCheckStatus === 'unknown') {
    return gateFailure(
      'owner-check-pending',
      'Waiting for canonical ownership check to confirm embedded wallet permissions.',
    )
  }

  if (input.ownerCheckStatus === 'not-owner') {
    if (input.executionTrack === 'legacy-owner-install') {
      return gateFailure(
        'owner-removed-stale-track',
        'The embedded wallet is no longer an owner on the canonical smart wallet. Re-enable 4626 signing in account setup.',
      )
    }
    return gateFailure(
      'embedded-wallet-not-owner',
      'Privy embedded wallet is not an owner on the canonical smart wallet.',
    )
  }

  return {
    required: true,
    ready: true,
    code: 'ok',
    reason: null,
  }
}
