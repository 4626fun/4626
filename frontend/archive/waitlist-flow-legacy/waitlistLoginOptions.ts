type WaitlistEmailLoginOptionsInput = {
  verifiedEmailHint?: string | null
  hasPriorAuthMarker?: boolean
}

export function shouldPreferWaitlistWalletLogin(input?: WaitlistEmailLoginOptionsInput): boolean {
  if (input?.hasPriorAuthMarker === true) return true
  const hint = typeof input?.verifiedEmailHint === 'string' ? input.verifiedEmailHint.trim() : ''
  return hint.length > 0
}

export function buildWaitlistEmailLoginOptions(input?: WaitlistEmailLoginOptionsInput) {
  if (shouldPreferWaitlistWalletLogin(input)) {
    return {
      loginMethods: ['wallet', 'email'] as const,
    }
  }

  return {
    loginMethods: ['email'] as const,
  }
}

export function buildWaitlistRecoveryLoginOptions() {
  return {
    loginMethods: ['email'] as const,
    disableSignup: true,
  }
}
