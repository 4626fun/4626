/**
 * Simple in-memory rate limiter for serverless functions.
 * Uses a sliding window approach with automatic cleanup.
 */

type RateLimitEntry = {
  count: number
  windowStart: number
}

// In-memory store (resets on cold start, which is acceptable for serverless)
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs * 2) {
      store.delete(key)
    }
  }
}

export type RateLimitConfig = {
  windowMs: number    // Time window in milliseconds
  maxRequests: number // Max requests per window
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check if a key is rate limited.
 * Returns whether the request is allowed and remaining quota.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  cleanup(config.windowMs)
  
  const entry = store.get(key)
  
  if (!entry || now - entry.windowStart >= config.windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    }
  }
  
  // Existing window
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + config.windowMs,
    }
  }
  
  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.windowStart + config.windowMs,
  }
}

// Preset configurations
export const RATE_LIMITS = {
  // Waitlist signup: 5 per minute per IP
  waitlistSignup: { windowMs: 60_000, maxRequests: 5 },
  // CSW linking: 10 per minute per IP
  cswLink: { windowMs: 60_000, maxRequests: 10 },
  // Deploy session creation: 3 per minute per address
  deployCreate: { windowMs: 60_000, maxRequests: 3 },
  // Admin actions: 30 per minute per address
  adminAction: { windowMs: 60_000, maxRequests: 30 },
  // Creative generation API: 30 per minute per IP
  agentCreative: { windowMs: 60_000, maxRequests: 30 },
  // OpenClaw creative adapter: 20 per minute per actor+IP
  openclawCreativeAdapter: { windowMs: 60_000, maxRequests: 20 },
  // General API: 60 per minute per IP
  general: { windowMs: 60_000, maxRequests: 60 },
} as const

/**
 * Helper to get client IP from request headers.
 */
export function getClientIp(req: { headers?: Record<string, any> }): string {
  const h = req?.headers ?? {}
  const xf = h['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]?.trim() || 'unknown'
  }
  if (Array.isArray(xf) && xf.length > 0) {
    const first = String(xf[0] ?? '').trim()
    if (first) return first
  }
  return 'unknown'
}

/**
 * Build a rate limit key from components.
 */
export function rateLimitKey(...parts: string[]): string {
  return parts.filter(Boolean).join(':')
}
