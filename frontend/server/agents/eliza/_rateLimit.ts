type AllowResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

type SlidingWindowRateLimiterOptions = {
  maxKeys?: number
  idleTtlMs?: number
}

export class SlidingWindowRateLimiter {
  private readonly windowMs: number
  private readonly maxEvents: number
  private readonly buckets = new Map<string, number[]>()
  private readonly maxKeys: number
  private readonly idleTtlMs: number

  constructor(windowMs: number, maxEvents: number, options: SlidingWindowRateLimiterOptions = {}) {
    this.windowMs = Math.max(1_000, windowMs)
    this.maxEvents = Math.max(1, maxEvents)
    this.maxKeys = Math.max(1, Math.floor(options.maxKeys ?? 5_000))
    this.idleTtlMs = Math.max(this.windowMs, Math.floor(options.idleTtlMs ?? this.windowMs * 5))
  }

  private setBucket(key: string, values: number[]): void {
    this.buckets.delete(key)
    this.buckets.set(key, values)
  }

  private prune(now: number): void {
    if (this.buckets.size === 0) return
    const idleLowerBound = now - this.idleTtlMs
    for (const [key, timestamps] of this.buckets.entries()) {
      const newest = timestamps[timestamps.length - 1] ?? 0
      if (newest < idleLowerBound) {
        this.buckets.delete(key)
      }
    }

    if (this.buckets.size <= this.maxKeys) return

    const byNewestAsc = [...this.buckets.entries()].sort((a, b) => {
      const aNewest = a[1][a[1].length - 1] ?? 0
      const bNewest = b[1][b[1].length - 1] ?? 0
      return aNewest - bNewest
    })
    const overflow = this.buckets.size - this.maxKeys
    for (let i = 0; i < overflow; i += 1) {
      const key = byNewestAsc[i]?.[0]
      if (key) this.buckets.delete(key)
    }
  }

  allow(key: string, now = Date.now()): AllowResult {
    this.prune(now)
    const timestamps = this.buckets.get(key) ?? []
    const lowerBound = now - this.windowMs
    const fresh = timestamps.filter((ts) => ts >= lowerBound)

    if (fresh.length >= this.maxEvents) {
      this.setBucket(key, fresh)
      const oldest = fresh[0] ?? now
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + this.windowMs - now),
      }
    }

    fresh.push(now)
    this.setBucket(key, fresh)
    this.prune(now)
    return {
      allowed: true,
      remaining: Math.max(0, this.maxEvents - fresh.length),
      retryAfterMs: 0,
    }
  }

  getDebugState(): { trackedKeys: number; keys: string[] } {
    return {
      trackedKeys: this.buckets.size,
      keys: [...this.buckets.keys()],
    }
  }
}

type DailyUsage = {
  dayKey: string
  inputTokens: number
  outputTokens: number
  estimatedUsd: number
}

export class DailyBudgetGuard {
  private readonly tokenBudget: number | null
  private readonly usdBudget: number | null
  private readonly usageByKey = new Map<string, DailyUsage>()

  constructor(tokenBudget: number | null, usdBudget: number | null) {
    this.tokenBudget = tokenBudget !== null && tokenBudget > 0 ? tokenBudget : null
    this.usdBudget = usdBudget !== null && usdBudget > 0 ? usdBudget : null
  }

  canConsume(
    key: string,
    usage: { inputTokens?: number; outputTokens?: number; estimatedUsd?: number },
    now = Date.now(),
  ): { allowed: boolean; reason?: 'token_budget' | 'usd_budget' } {
    const current = this.getSnapshot(key, now)
    const nextInput = Math.max(0, usage.inputTokens ?? 0)
    const nextOutput = Math.max(0, usage.outputTokens ?? 0)
    const nextUsd = Math.max(0, usage.estimatedUsd ?? 0)
    const nextTotalTokens = current.inputTokens + current.outputTokens + nextInput + nextOutput
    const nextTotalUsd = current.estimatedUsd + nextUsd

    if (this.tokenBudget !== null && nextTotalTokens > this.tokenBudget) {
      return { allowed: false, reason: 'token_budget' }
    }
    if (this.usdBudget !== null && nextTotalUsd > this.usdBudget) {
      return { allowed: false, reason: 'usd_budget' }
    }
    return { allowed: true }
  }

  record(
    key: string,
    usage: { inputTokens?: number; outputTokens?: number; estimatedUsd?: number },
    now = Date.now(),
  ): DailyUsage {
    const current = this.getSnapshot(key, now)
    const updated: DailyUsage = {
      dayKey: current.dayKey,
      inputTokens: current.inputTokens + Math.max(0, usage.inputTokens ?? 0),
      outputTokens: current.outputTokens + Math.max(0, usage.outputTokens ?? 0),
      estimatedUsd: current.estimatedUsd + Math.max(0, usage.estimatedUsd ?? 0),
    }
    this.usageByKey.set(key, updated)
    return updated
  }

  getSnapshot(key: string, now = Date.now()): DailyUsage {
    const dayKey = new Date(now).toISOString().slice(0, 10)
    const current = this.usageByKey.get(key)
    if (!current || current.dayKey !== dayKey) {
      const fresh: DailyUsage = {
        dayKey,
        inputTokens: 0,
        outputTokens: 0,
        estimatedUsd: 0,
      }
      this.usageByKey.set(key, fresh)
      return fresh
    }
    return current
  }
}

export function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(String(raw ?? '').trim())
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

