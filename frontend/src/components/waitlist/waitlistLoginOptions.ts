export const WAITLIST_PRIVY_LOGIN_METHODS = ['email', 'google', 'twitter', 'telegram', 'wallet'] as const

export function buildWaitlistPrivyLoginOptions() {
  return {
    loginMethods: [...WAITLIST_PRIVY_LOGIN_METHODS],
  } as const
}
