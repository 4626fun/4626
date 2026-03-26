export const WAITLIST_EMAIL_LOGIN_METHODS = ['email'] as const
export const WAITLIST_BASE_LOGIN_METHODS = ['wallet'] as const

export function buildWaitlistEmailLoginOptions() {
  return {
    loginMethods: [...WAITLIST_EMAIL_LOGIN_METHODS],
  } as const
}

export function buildWaitlistBaseLoginOptions() {
  return {
    loginMethods: [...WAITLIST_BASE_LOGIN_METHODS],
  } as const
}

export const WAITLIST_RECOVERY_LOGIN_METHODS = ['email'] as const

export function buildWaitlistRecoveryLoginOptions() {
  return {
    loginMethods: [...WAITLIST_RECOVERY_LOGIN_METHODS],
    disableSignup: true,
  } as const
}
