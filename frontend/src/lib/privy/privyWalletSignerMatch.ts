/**
 * Guard: Privy Wallet API `/wallets/{id}/rpc` must use the wallet whose
 * address equals the UserOp / Permit2 `ownerAddress`. Binding wallet id
 * `l8pocg69…` (embedded `0xceca…`) to session/admin EOA `0xb05cf…` causes
 * Wallet RPC 401s and AA24-style signature failures.
 *
 * Desktop lane: Privy embedded EOA + authorized Wallet RPC.
 * Base App lane: Base Account connector / wallet_sendCalls — do not use this RPC.
 */

export const PRIVY_WALLET_SIGNER_MISMATCH_MESSAGE =
  'Privy wallet id does not match the signing owner address. ' +
  'Use your Privy embedded signer on desktop, or connect your Base Account in Base App — do not mix those lanes.'

export const PRIVY_SIGNING_SESSION_RECOVERY_MESSAGE =
  'Signing session was refreshed but UserOperation signing still failed — sign out and sign in again (email OTP), then retry.'

export type EmbeddedVsBaseAppSigningLane = 'legacy-embedded' | 'base-app-direct' | 'unknown'

export function normalizePrivySignerAddress(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw
}

export function resolveEmbeddedVsBaseAppSigningLane(input: {
  executionTrack?: string | null
  baseAppDirectConnected?: boolean
}): EmbeddedVsBaseAppSigningLane {
  if (input.baseAppDirectConnected === true) return 'base-app-direct'
  if (input.executionTrack === 'base-app-direct') return 'base-app-direct'
  if (input.executionTrack === 'legacy-owner-install') return 'legacy-embedded'
  return 'unknown'
}

/**
 * Fail closed before Wallet RPC when the live wallet address disagrees with
 * the address we will advertise as UserOp/Permit2 owner.
 */
export function assertPrivyWalletIdMatchesSignerAddress(params: {
  walletId: string
  walletAddress?: string | null
  expectedSignerAddress: string
}): void {
  const walletId = String(params.walletId ?? '').trim()
  if (!walletId) {
    throw new Error('Privy wallet id is required for authorized signing.')
  }
  const walletAddress = normalizePrivySignerAddress(params.walletAddress)
  const expected = normalizePrivySignerAddress(params.expectedSignerAddress)
  if (!expected) {
    throw new Error('Expected Privy signer address is required for authorized signing.')
  }
  // Unknown wallet address: allow resolvePrivyUnifiedWalletId lookup by expected address.
  if (!walletAddress) return
  if (walletAddress !== expected) {
    throw new Error(PRIVY_WALLET_SIGNER_MISMATCH_MESSAGE)
  }
}

export function isPrivyWalletSignerMismatchError(message: string): boolean {
  const m = String(message ?? '').trim().toLowerCase()
  if (!m) return false
  return (
    m.includes('privy wallet id does not match') ||
    m.includes('do not mix those lanes') ||
    (m.includes('wallet id') && m.includes('signing owner'))
  )
}
