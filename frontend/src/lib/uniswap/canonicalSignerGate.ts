import { isAddress } from 'viem'

import type { WalletMode } from '@/lib/uniswap/walletMode'

export type CanonicalOwnerCheckStatus = 'owner' | 'not-owner' | 'pending' | 'unknown'
export type CanonicalAuthStatus = 'authenticated' | 'unauthenticated' | 'unknown'
export type CanonicalPrivyClientStatus = 'disabled' | 'loading' | 'ready'

export type CanonicalSignerGateInput = {
  executionMode: WalletMode
  canonicalAddress: string | null
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
    | 'embedded-wallet-missing'
    | 'embedded-wallet-address-invalid'
    | 'embedded-wallet-cannot-sign'
    | 'owner-check-pending'
    | 'embedded-wallet-not-owner'
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

  if (input.ownerCheckStatus === 'pending' || input.ownerCheckStatus === 'unknown') {
    return gateFailure(
      'owner-check-pending',
      'Waiting for canonical ownership check to confirm embedded wallet permissions.',
    )
  }

  if (input.ownerCheckStatus === 'not-owner') {
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
