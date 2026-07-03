import { vi } from 'vitest'

import { checkRateLimit as checkInMemoryRateLimit, type RateLimitConfig } from '../server/_lib/infra/rateLimit.js'

export * from '../packages/server-core/src/index.ts'

export {
  getClientIp,
  rateLimitKey,
  type RateLimitConfig,
} from '../server/_lib/infra/rateLimit.js'

const DEFAULT_RATE_LIMIT: RateLimitConfig = { windowMs: 60_000, maxRequests: 120 }

// Load the real preset map while bypassing any test-level vi.mock of the
// rateLimit module, so the harness never breaks when a test partially mocks
// '../server/_lib/infra/rateLimit.js' without re-exporting RATE_LIMITS.
const { RATE_LIMITS: REAL_RATE_LIMITS } = await vi.importActual<
  typeof import('../server/_lib/infra/rateLimit.js')
>('../server/_lib/infra/rateLimit.js')

// Spread the real RATE_LIMITS into the Proxy target so tests that do
// `{ ...actual.RATE_LIMITS }` (which only copies own enumerable keys and
// loses the Proxy `get` fallback) still see every production limit key.
export const RATE_LIMITS = new Proxy(
  {
    ...REAL_RATE_LIMITS,
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
