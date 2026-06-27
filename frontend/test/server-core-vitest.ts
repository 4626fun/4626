import { checkRateLimit as checkInMemoryRateLimit, type RateLimitConfig } from '../server/_lib/infra/rateLimit.js'

export * from '../packages/server-core/src/index.ts'

export {
  getClientIp,
  rateLimitKey,
  type RateLimitConfig,
} from '../server/_lib/infra/rateLimit.js'

const DEFAULT_RATE_LIMIT: RateLimitConfig = { windowMs: 60_000, maxRequests: 120 }

export const RATE_LIMITS = new Proxy(
  {
    accountsMe: { windowMs: 60_000, maxRequests: 30 },
    general: { windowMs: 60_000, maxRequests: 60 },
    telegramWebhookIngest: { windowMs: 60_000, maxRequests: 1200 },
  } as Record<string, RateLimitConfig>,
  {
    get(target, prop) {
      if (typeof prop !== 'string') return Reflect.get(target, prop)
      return target[prop] ?? DEFAULT_RATE_LIMIT
    },
  },
)
export const checkRateLimit = checkInMemoryRateLimit

export type DurableRateLimitResult = ReturnType<typeof checkInMemoryRateLimit> & {
  source: 'db' | 'memory' | 'fail-closed'
}

export async function checkDurableRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<DurableRateLimitResult> {
  return { ...checkInMemoryRateLimit(key, config), source: 'memory' }
}
