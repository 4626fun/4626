export function buildWaitlistEmailLoginOptions() {
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
