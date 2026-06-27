/**
 * Simple in-memory rate limiter for serverless functions.
 * Uses a sliding window approach with automatic cleanup.
 *
 * FIX: FINDING-11 — WARNING: this store does NOT persist across serverless invocations.
 * Each cold start resets all counters, and concurrent lambda instances each maintain
 * their own independent store. The effective rate limit is multiplied by the number of
 * warm instances. For security-sensitive endpoints (auth-verify, auth-privy, deploy-create),
 * migrate to a shared store (Redis, Upstash, Vercel KV) or delegate to a WAF/CDN layer.
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
  // Deploy session start wrapper: 20 per minute per address
  deploySessionStart: { windowMs: 60_000, maxRequests: 20 },
  // Deploy session status polling: 240 per minute per address
  deploySessionStatus: { windowMs: 60_000, maxRequests: 240 },
  // Deploy session continue attempts: 30 per minute per address
  deploySessionContinue: { windowMs: 60_000, maxRequests: 30 },
  // Deploy session cancellation attempts: 20 per minute per address
  deploySessionCancel: { windowMs: 60_000, maxRequests: 20 },
  // Deploy dry-run requests: 10 per minute per address
  deploySessionDryRun: { windowMs: 60_000, maxRequests: 10 },
  // Solana route provisioning calls: 20 per minute per client IP
  solanaRouteProvision: { windowMs: 60_000, maxRequests: 20 },
  // Solana canonical wallet mutation: 30 per minute per principal
  solanaSetCanonical: { windowMs: 60_000, maxRequests: 30 },
  // Solana sweep enqueue: 20 per minute per principal
  solanaSweepEnqueue: { windowMs: 60_000, maxRequests: 20 },
  // Solana sweep processor trigger: 30 per minute per client IP
  solanaSweepProcess: { windowMs: 60_000, maxRequests: 30 },
  // Smart-wallet owner read endpoints: 120 per minute per client IP
  smartWalletOwnerRead: { windowMs: 60_000, maxRequests: 120 },
  // Admin actions: 30 per minute per address
  adminAction: { windowMs: 60_000, maxRequests: 30 },
  // Creative generation API: 30 per minute per IP
  agentCreative: { windowMs: 60_000, maxRequests: 30 },
  // Generic read for v1 handlers (legacy)
  read: { windowMs: 60_000, maxRequests: 120 },
  // Agent access proof request minting: 40 per minute per principal
  agentAccessProofRequest: { windowMs: 60_000, maxRequests: 40 },
  // Agent access proof verification: 40 per minute per principal
  agentAccessProofVerify: { windowMs: 60_000, maxRequests: 40 },
  // Agent join token consumption (XMTP/Telegram): 60 per minute per principal
  agentAccessJoin: { windowMs: 60_000, maxRequests: 60 },
  // Agent identity wallet binding payload generation/encoding: 30 per minute per principal
  agentIdentitySetWallet: { windowMs: 60_000, maxRequests: 30 },
  // Agent feedback calldata builder: 40 per minute per principal
  agentFeedbackSubmit: { windowMs: 60_000, maxRequests: 40 },
  // Paid agent technical review generation: 20 per minute per principal
  agentFeedbackReview: { windowMs: 60_000, maxRequests: 20 },
  // Chat command preflight checks: 120 per minute per client IP
  chatCommandPreflight: { windowMs: 60_000, maxRequests: 120 },
  // Chat telemetry ingestion: 180 per minute per client IP
  chatTelemetry: { windowMs: 60_000, maxRequests: 180 },
  // Workspace action mutations: 40 per minute per principal
  workspaceActions: { windowMs: 60_000, maxRequests: 40 },
  // Workspace read endpoints: 120 per minute per principal
  workspaceRead: { windowMs: 60_000, maxRequests: 120 },
  // Creator quickstart onboarding: 20 per minute per principal
  creatorQuickstart: { windowMs: 60_000, maxRequests: 20 },
  // Relay owner-mutation status polling: up to ~30 polls/min for 8 minutes
  relayIntentStatus: { windowMs: 60_000, maxRequests: 300 },
  // Keeper machine-auth ingest reads: 120 per minute per client IP
  keeperIngestRead: { windowMs: 60_000, maxRequests: 120 },
  // Keeper machine-auth ingest writes: 60 per minute per client IP
  keeperIngestWrite: { windowMs: 60_000, maxRequests: 60 },
  // Keeper job / keepr-actions writes: 60 per minute per client IP
  keeperDecisionsWrite: { windowMs: 60_000, maxRequests: 60 },
  // Keeper onchain trigger endpoints: 30 per minute per client IP
  keeperTriggerWrite: { windowMs: 60_000, maxRequests: 30 },
  // Ajna calldata build endpoints: 120 per minute per principal
  buildAjnaCalldata: { windowMs: 60_000, maxRequests: 120 },
  // Auction submitBid calldata build endpoint: 80 per minute per principal
  buildAuctionSubmitBid: { windowMs: 60_000, maxRequests: 80 },
  // Gauge vote calldata build endpoint: 80 per minute per principal
  buildGaugeVote: { windowMs: 60_000, maxRequests: 80 },
  // Auction read endpoints: 120 per minute per principal
  auctionRead: { windowMs: 60_000, maxRequests: 120 },
  // Gauge read endpoints: 120 per minute per principal
  gaugeRead: { windowMs: 60_000, maxRequests: 120 },
  // Vault read endpoints: 120 per minute per principal
  vaultRead: { windowMs: 60_000, maxRequests: 120 },
  // ve4626 read endpoints: 120 per minute per principal
  ve4626Read: { windowMs: 60_000, maxRequests: 120 },
  // Lottery read endpoints: 120 per minute per principal
  lotteryRead: { windowMs: 60_000, maxRequests: 120 },
  // Lottery write endpoints: 40 per minute per principal
  lotteryWrite: { windowMs: 60_000, maxRequests: 40 },
  // Agent and directory read endpoints: 120 per minute per principal
  agentsRead: { windowMs: 60_000, maxRequests: 120 },
  // Agent creator mutation endpoints: 30 per minute per principal
  agentsWrite: { windowMs: 60_000, maxRequests: 30 },
  // Charm strategy read endpoints: 120 per minute per principal
  charmRead: { windowMs: 60_000, maxRequests: 120 },
  // Explore read endpoints: 120 per minute per principal
  exploreRead: { windowMs: 60_000, maxRequests: 120 },
  // Spec/discovery read endpoints: 120 per minute per principal
  specRead: { windowMs: 60_000, maxRequests: 120 },
  // Auth read endpoints (nonce/me): 180 per minute per client IP
  authRead: { windowMs: 60_000, maxRequests: 180 },
  // Auth write endpoints (verify/logout): 120 per minute per client IP
  authWrite: { windowMs: 60_000, maxRequests: 120 },
  // Privy auth verification endpoint: 80 per minute per client IP
  authPrivy: { windowMs: 60_000, maxRequests: 80 },
  // SIWA agent auth endpoints: 80 per minute per client IP
  authAgentWrite: { windowMs: 60_000, maxRequests: 80 },
  // Telegram link flow writes/session issuance: 60 per minute per client IP
  telegramLinkWrite: { windowMs: 60_000, maxRequests: 60 },
  // Telegram link readiness/status reads: 120 per minute per client IP
  telegramLinkRead: { windowMs: 60_000, maxRequests: 120 },
  // Telegram internal/admin operations: 30 per minute per client IP
  telegramAdminWrite: { windowMs: 60_000, maxRequests: 30 },
  // Telegram webhook ingest (high-throughput): 1200 per minute per client IP
  telegramWebhookIngest: { windowMs: 60_000, maxRequests: 1200 },
  // Paymaster JSON-RPC endpoint: 120 requests per minute per client IP
  paymasterRpc: { windowMs: 60_000, maxRequests: 120 },
  // ve4626 lock/increase/extend calldata build endpoints: 80 per minute per principal
  buildVe4626Calldata: { windowMs: 60_000, maxRequests: 80 },
  // Charm calldata build endpoints: 80 per minute per principal
  buildCharmCalldata: { windowMs: 60_000, maxRequests: 80 },
  // General API: 60 per minute per IP
  general: { windowMs: 60_000, maxRequests: 60 },
  // AlfaClub backtest run: 5 per minute per privy user + IP (compute-intensive)
  alfaclubBacktestRun: { windowMs: 60_000, maxRequests: 5 },
  // /api/accounts/me: 30 per minute per IP (performs DB writes + external Privy calls on GET)
  accountsMe: { windowMs: 60_000, maxRequests: 30 },
} as const

/**
 * Helper to get client IP from request headers.
 *
 * FIX: M-10 / 4626-421 — this project is fronted by Vercel, not Cloudflare.
 * The `cf-connecting-ip` header is therefore NOT set by our own edge. On a
 * Vercel-only surface, any caller can attach an arbitrary `cf-connecting-ip`
 * value to the request and we would previously trust it. That allows rate-limit
 * bypass by spoofing unique "client IPs" per request, and also corrupts
 * downstream audit trails.
 *
 * We now trust ONLY Vercel-issued headers (`x-vercel-forwarded-for` and, as a
 * conservative fallback, `x-real-ip` / `x-forwarded-for`). `cf-connecting-ip`
 * is intentionally no longer consulted. If this deployment is ever moved
 * behind Cloudflare in front of Vercel, re-introduce it only under a
 * feature flag that asserts Cloudflare is the true edge.
 */
export function getClientIp(req: { headers?: Record<string, any> }): string {
  const h = req?.headers ?? {}
  const firstHeaderValue = (value: unknown): string => {
    if (Array.isArray(value)) {
      return value.find((entry) => typeof entry === 'string' && entry.trim().length > 0)?.trim() ?? ''
    }
    return typeof value === 'string' ? value.trim() : ''
  }
  const extractFirstIp = (value: string): string => value.split(',')[0]?.trim() ?? ''

  // Vercel's verified client-IP header, stamped by the Vercel edge.
  const fromVercel = extractFirstIp(firstHeaderValue(h['x-vercel-forwarded-for']))
  if (fromVercel) return fromVercel

  // Conservative fallbacks when x-vercel-forwarded-for is absent (local dev,
  // preview environments proxied through a reverse proxy, etc.). These headers
  // are still spoofable by clients, but they are the best remaining signal
  // and are acceptable because they are NOT used as a security boundary on
  // their own — rate-limit keys are joined with a principal (session address /
  // API key / etc.) on security-sensitive endpoints.
  const fromRealIp = extractFirstIp(firstHeaderValue(h['x-real-ip']))
  if (fromRealIp) return fromRealIp

  const fromForwarded = extractFirstIp(firstHeaderValue(h['x-forwarded-for']))
  if (fromForwarded) return fromForwarded

  return 'unknown'
}

/**
 * Build a rate limit key from components.
 */
export function rateLimitKey(...parts: string[]): string {
  return parts.filter(Boolean).join(':')
}
