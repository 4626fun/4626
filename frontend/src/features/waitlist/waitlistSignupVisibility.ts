/** Hide email OTP signup once the user chose returning-wallet sign-in. */
export function shouldShowWaitlistEmailSignup(input: {
  joinedSessionAddress?: string | null
  walletSignInPending?: boolean
  walletSessionAddress?: string | null
}): boolean {
  if (input.joinedSessionAddress?.trim()) return false
  if (input.walletSignInPending) return false
  if (input.walletSessionAddress?.trim()) return false
  return true
}
