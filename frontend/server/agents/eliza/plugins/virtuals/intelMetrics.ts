export type IntelOfferingMetrics = {
  success: number
  failure: number
  submitFailures: number
  skipCount: number
  latencyTotalMs: number
  lastLatencyMs: number
  lastDataAgeMs: number | null
  lastAt: string | null
}

export type IntelServiceMetrics = {
  offerings: Record<string, IntelOfferingMetrics>
  settlementLagMs: number | null
  lastSettlementAt: string | null
}

function emptyOffering(): IntelOfferingMetrics {
  return {
    success: 0,
    failure: 0,
    submitFailures: 0,
    skipCount: 0,
    latencyTotalMs: 0,
    lastLatencyMs: 0,
    lastDataAgeMs: null,
    lastAt: null,
  }
}

export class IntelMetricsTracker {
  private readonly offerings = new Map<string, IntelOfferingMetrics>()
  private settlementLagMs: number | null = null
  private lastSettlementAt: string | null = null

  private bucket(offeringName: string): IntelOfferingMetrics {
    const key = offeringName.trim() || 'unknown'
    const existing = this.offerings.get(key)
    if (existing) return existing
    const created = emptyOffering()
    this.offerings.set(key, created)
    return created
  }

  recordSuccess(params: {
    offeringName: string
    latencyMs: number
    dataAgeMs?: number | null
    decision?: string | null
  }): void {
    const row = this.bucket(params.offeringName)
    row.success += 1
    row.lastLatencyMs = Math.max(0, Math.round(params.latencyMs))
    row.latencyTotalMs += row.lastLatencyMs
    row.lastDataAgeMs =
      params.dataAgeMs != null && Number.isFinite(params.dataAgeMs)
        ? Math.max(0, Math.round(params.dataAgeMs))
        : null
    row.lastAt = new Date().toISOString()
    if (String(params.decision ?? '').toUpperCase() === 'SKIP') row.skipCount += 1
  }

  recordFailure(params: { offeringName: string; latencyMs: number; decision?: string | null }): void {
    const row = this.bucket(params.offeringName)
    row.failure += 1
    row.lastLatencyMs = Math.max(0, Math.round(params.latencyMs))
    row.latencyTotalMs += row.lastLatencyMs
    row.lastAt = new Date().toISOString()
    if (String(params.decision ?? '').toUpperCase() === 'SKIP') row.skipCount += 1
  }

  recordSubmitFailure(offeringName: string): void {
    this.bucket(offeringName).submitFailures += 1
  }

  recordSettlementLag(lagMs: number, settledAtMs = Date.now()): void {
    if (!Number.isFinite(lagMs) || lagMs < 0) return
    this.settlementLagMs = Math.round(lagMs)
    this.lastSettlementAt = new Date(settledAtMs).toISOString()
  }

  snapshot(): IntelServiceMetrics {
    const offerings: Record<string, IntelOfferingMetrics> = {}
    for (const [name, metrics] of this.offerings) {
      offerings[name] = { ...metrics }
    }
    return {
      offerings,
      settlementLagMs: this.settlementLagMs,
      lastSettlementAt: this.lastSettlementAt,
    }
  }

  skipRate(offeringName: string): number {
    const row = this.offerings.get(offeringName.trim())
    if (!row) return 0
    const denom = row.success + row.failure
    return denom > 0 ? row.skipCount / denom : 0
  }
}
