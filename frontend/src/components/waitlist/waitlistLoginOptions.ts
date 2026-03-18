export const WAITLIST_PRIVY_LOGIN_METHODS = ['email', 'google', 'twitter', 'wallet'] as const

export function buildWaitlistPrivyLoginOptions() {
  return {
    loginMethods: [...WAITLIST_PRIVY_LOGIN_METHODS],
  } as const
}

export const WAITLIST_RECOVERY_LOGIN_METHODS = ['email', 'google', 'twitter'] as const

export function buildWaitlistRecoveryLoginOptions() {
  return {
    loginMethods: [...WAITLIST_RECOVERY_LOGIN_METHODS],
  } as const
}
