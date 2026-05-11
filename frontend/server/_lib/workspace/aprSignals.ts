export type StrategyAprSignal = {
  expectedAprBps: number | null
  confidence: 'unknown' | 'low' | 'medium' | 'high'
  source: 'keeper_report' | 'p0_placeholder' | 'none'
}

type AnyObject = Record<string, unknown>

type ActivityEventLike = {
  eventType: string
  createdAt: string
  payload: Record<string, unknown>
}

type MonitoringSnapshotLike = {
  createdAt: string
  payload: Record<string, unknown>
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function normalizeAprBps(value: unknown): number | null {
  const parsed = parseFiniteNumber(value)
  if (parsed === null) return null
  if (parsed < 0 || parsed > 100_000) return null
  return Math.round(parsed)
}

function asObject(value: unknown): AnyObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as AnyObject
}

function readNested(obj: Record<string, unknown>, path: string[]): unknown {
  let cursor: unknown = obj
  for (const segment of path) {
    const record = asObject(cursor)
    if (!(segment in record)) return null
    cursor = record[segment]
  }
  return cursor
}

function inferConfidenceFromRecency(params: {
  ageMs: number
  enoughSignals: boolean
}): StrategyAprSignal['confidence'] {
  if (params.ageMs <= 2 * 60 * 60 * 1000) {
    return params.enoughSignals ? 'high' : 'medium'
  }
  if (params.ageMs <= 24 * 60 * 60 * 1000) return 'medium'
  if (params.ageMs <= 72 * 60 * 60 * 1000) return 'low'
  return 'unknown'
}

function deriveFromActivity(params: {
  kind: 'ajna' | 'charm' | 'solana' | 'unknown'
  strategyAddress?: `0x${string}` | null
  activityEvents?: ActivityEventLike[]
  nowMs: number
}): StrategyAprSignal | null {
  const events = Array.isArray(params.activityEvents) ? params.activityEvents : []
  const expectedStrategyAddress = params.strategyAddress?.toLowerCase() ?? null
  let best: { aprBps: number; createdAtMs: number } | null = null
  let matchedCount = 0

  for (const event of events) {
    const eventType = String(event.eventType ?? '')
    if (
      !eventType.includes('report') &&
      !eventType.includes('harvest') &&
      !eventType.includes('strategy')
    ) {
      continue
    }

    const payload = asObject(event.payload)
    const payloadStrategy = String(
      payload.strategyAddress ?? payload.strategy ?? payload.address ?? '',
    )
      .trim()
      .toLowerCase()
    if (expectedStrategyAddress && payloadStrategy && payloadStrategy !== expectedStrategyAddress) {
      continue
    }

    const payloadKind = String(
      payload.strategyKind ?? payload.kind ?? payload.strategyType ?? '',
    )
      .trim()
      .toLowerCase()
    if (payloadKind && params.kind !== 'unknown' && payloadKind !== params.kind) continue

    const aprCandidates = [
      normalizeAprBps(payload.expectedAprBps),
      normalizeAprBps(payload.aprBps),
      normalizeAprBps(payload.apyBps),
      normalizeAprBps(payload.yieldBps),
      normalizeAprBps(readNested(payload, ['metrics', 'expectedAprBps'])),
      normalizeAprBps(readNested(payload, ['metrics', 'aprBps'])),
      normalizeAprBps(readNested(payload, ['metrics', 'apyBps'])),
      normalizeAprBps(readNested(payload, ['apr', 'expectedBps'])),
    ]
    const aprBps = aprCandidates.find((candidate) => candidate !== null) ?? null
    if (aprBps === null) continue

    const createdAtMs = parseTimestampMs(event.createdAt)
    if (createdAtMs === null) continue
    matchedCount += 1

    if (!best || createdAtMs > best.createdAtMs) {
      best = { aprBps, createdAtMs }
    }
  }

  if (!best) return null
  const ageMs = Math.max(0, params.nowMs - best.createdAtMs)
  const confidence = inferConfidenceFromRecency({
    ageMs,
    enoughSignals: matchedCount >= 2,
  })
  if (confidence === 'unknown') return null

  return {
    expectedAprBps: best.aprBps,
    confidence,
    source: 'keeper_report',
  }
}

function deriveFromSnapshot(params: {
  kind: 'ajna' | 'charm' | 'solana' | 'unknown'
  strategyAddress?: `0x${string}` | null
  monitoringSnapshots?: MonitoringSnapshotLike[]
  nowMs: number
}): StrategyAprSignal | null {
  const snapshots = Array.isArray(params.monitoringSnapshots) ? params.monitoringSnapshots : []
  const latest = snapshots[0]
  if (!latest) return null

  const latestMs = parseTimestampMs(latest.createdAt)
  if (latestMs === null) return null
  const ageMs = Math.max(0, params.nowMs - latestMs)
  const context = asObject(latest.payload.context)
  const confidence = inferConfidenceFromRecency({
    ageMs,
    enoughSignals: snapshots.length >= 3,
  })
  if (confidence === 'unknown') return null

  if (params.kind === 'charm') {
    const twapUsd = parseFiniteNumber(context.v3TwapUsdPerCreator)
    const spotUsd = parseFiniteNumber(context.v3SpotUsdPerCreator)
    if (twapUsd && twapUsd > 0 && spotUsd && spotUsd > 0) {
      const drift = Math.min(1, Math.abs(spotUsd - twapUsd) / twapUsd)
      const apr = Math.max(150, Math.round(1_200 * (1 - drift)))
      return {
        expectedAprBps: apr,
        confidence,
        source: 'keeper_report',
      }
    }
    return null
  }

  if (params.kind === 'ajna') {
    const paused = context.ajnaPaused === true
    if (paused) {
      return {
        expectedAprBps: null,
        confidence: 'low',
        source: 'keeper_report',
      }
    }
    const bufferRatioBps = normalizeAprBps(context.ajnaBufferRatioBps)
    if (bufferRatioBps !== null) {
      const apr = Math.max(200, Math.min(2_000, Math.round(700 + bufferRatioBps * 0.15)))
      return {
        expectedAprBps: apr,
        confidence,
        source: 'keeper_report',
      }
    }
    return null
  }

  if (params.kind === 'solana') {
    const strategyAddress = params.strategyAddress?.toLowerCase() ?? ''
    const reportedAddress = String(context.solanaStrategyAddress ?? '')
      .trim()
      .toLowerCase()
    if (strategyAddress && reportedAddress && strategyAddress !== reportedAddress) return null
    if (reportedAddress || context.solanaBridgeAdapterAddress) {
      return {
        expectedAprBps: 700,
        confidence,
        source: 'keeper_report',
      }
    }
    return null
  }

  return null
}

export function deriveStrategyAprSignal(params: {
  kind: 'ajna' | 'charm' | 'solana' | 'unknown'
  isActive: boolean | null
  strategyAddress?: `0x${string}` | null
  nowIso?: string
  activityEvents?: ActivityEventLike[]
  monitoringSnapshots?: MonitoringSnapshotLike[]
}): StrategyAprSignal {
  if (params.isActive !== true) {
    return {
      expectedAprBps: null,
      confidence: 'unknown',
      source: 'none',
    }
  }

  const nowMs = parseTimestampMs(params.nowIso) ?? Date.now()
  const fromActivity = deriveFromActivity({
    kind: params.kind,
    strategyAddress: params.strategyAddress ?? null,
    activityEvents: params.activityEvents,
    nowMs,
  })
  if (fromActivity) return fromActivity

  const fromSnapshot = deriveFromSnapshot({
    kind: params.kind,
    strategyAddress: params.strategyAddress ?? null,
    monitoringSnapshots: params.monitoringSnapshots,
    nowMs,
  })
  if (fromSnapshot) return fromSnapshot

  switch (params.kind) {
    case 'charm':
      return {
        expectedAprBps: 1_200,
        confidence: 'low',
        source: 'p0_placeholder',
      }
    case 'ajna':
      return {
        expectedAprBps: 900,
        confidence: 'low',
        source: 'p0_placeholder',
      }
    case 'solana':
      return {
        expectedAprBps: 700,
        confidence: 'low',
        source: 'p0_placeholder',
      }
    case 'unknown':
    default:
      return {
        expectedAprBps: null,
        confidence: 'unknown',
        source: 'none',
      }
  }
}
