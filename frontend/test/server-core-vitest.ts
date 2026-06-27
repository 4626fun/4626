export * from '../packages/server-core/src/index.ts'

export {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  type RateLimitConfig,
} from '../server/_lib/infra/rateLimit.js'

import { checkRateLimit, type RateLimitConfig } from '../server/_lib/infra/rateLimit.js'

export type DurableRateLimitResult = ReturnType<typeof checkRateLimit> & {
  source: 'db' | 'memory' | 'fail-closed'
}

export async function checkDurableRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<DurableRateLimitResult> {
  return { ...checkRateLimit(key, config), source: 'memory' }
}
