/**
 * Postability policy for daily Integrity Cards.
 *
 * Cards should only ship when room economics look publicly bullish.
 * Composite rank alone is not enough — today's quiet #1 must not auto-post.
 */

export type IntegrityCardRoomMetrics = {
  fundUsd: number | null
  holders: number | null
  /** All-time room PnL percent (e.g. 50.0 => +50%). */
  pnlPctAllTime: number | null
  /** 30d room PnL percent when absolute 30d USD is unavailable. */
  pnlPct30d: number | null
  /** Absolute 30d PnL USD (Hyperliquid or room), preferred for the 30d chip. */
  pnl30dUsd: number | null
  /** Absolute room PnL USD (often all-time). */
  pnlUsd: number | null
}

export type IntegrityCardRoomMetricsSource = {
  tradingFundUsdc?: number | null
  uniqueHolders?: number | null
  pnlPctAllTime?: number | null
  pnlPct30d?: number | null
  pnlUsdc?: number | null
}

/**
 * Map live room-directory economics into Integrity Card chip metrics.
 * Optional `pnl30dUsd` (e.g. Hyperliquid from the scorecard) overlays the 30d absolute chip.
 */
export function roomMetricsFromDirectoryItem(
  room: IntegrityCardRoomMetricsSource,
  opts?: { pnl30dUsd?: number | null },
): IntegrityCardRoomMetrics {
  return {
    fundUsd: finiteOrNull(room.tradingFundUsdc),
    holders: finiteOrNull(room.uniqueHolders),
    pnlPctAllTime: finiteOrNull(room.pnlPctAllTime),
    pnlPct30d: finiteOrNull(room.pnlPct30d),
    pnl30dUsd: finiteOrNull(opts?.pnl30dUsd),
    pnlUsd: finiteOrNull(room.pnlUsdc),
  }
}

export type IntegrityCardPostGate = {
  /** Minimum trading fund USD. */
  minFundUsd: number
  /** Minimum absolute 30d PnL USD. */
  minPnl30dUsd: number
  /** Minimum all-time PnL percent (e.g. 100 => +100%). */
  minPnlPctAllTime: number
  /** Fund floor that must accompany the all-time % path. */
  minFundUsdForPctPath: number
}

export const DEFAULT_INTEGRITY_CARD_POST_GATE: IntegrityCardPostGate = {
  minFundUsd: 25_000,
  minPnl30dUsd: 5_000,
  minPnlPctAllTime: 100,
  minFundUsdForPctPath: 10_000,
}

export type IntegrityCardPostability = {
  ok: boolean
  reasons: string[]
  bullishScore: number
}

export type IntegrityCardSubjectCandidate = {
  id: string
  rank: number
  metrics: IntegrityCardRoomMetrics
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function bullishScoreForMetrics(metrics: IntegrityCardRoomMetrics): number {
  const fund = Math.max(0, finiteOrNull(metrics.fundUsd) ?? 0)
  const holders = Math.max(0, finiteOrNull(metrics.holders) ?? 0)
  const pnl30d = Math.max(0, finiteOrNull(metrics.pnl30dUsd) ?? 0)
  const pnlPct = Math.max(0, finiteOrNull(metrics.pnlPctAllTime) ?? 0)
  const pnlAbs = Math.max(0, finiteOrNull(metrics.pnlUsd) ?? 0)
  // Prefer absolute economics; % is a tie-breaker when funds are similar.
  return fund + pnl30d * 2 + pnlAbs + pnlPct * 50 + holders * 25
}

/**
 * Returns whether a subject is bullish enough to post publicly.
 * Any single strong path is enough (fund OR 30d PnL OR AT%+fund floor).
 */
export function evaluateIntegrityCardPostability(
  metrics: IntegrityCardRoomMetrics,
  gate: IntegrityCardPostGate = DEFAULT_INTEGRITY_CARD_POST_GATE,
): IntegrityCardPostability {
  const fund = finiteOrNull(metrics.fundUsd)
  const pnl30d = finiteOrNull(metrics.pnl30dUsd)
  const pnlPct = finiteOrNull(metrics.pnlPctAllTime)
  const reasons: string[] = []

  const fundOk = fund != null && fund >= gate.minFundUsd
  const pnl30dOk = pnl30d != null && pnl30d >= gate.minPnl30dUsd
  const pctPathOk =
    pnlPct != null
    && pnlPct >= gate.minPnlPctAllTime
    && fund != null
    && fund >= gate.minFundUsdForPctPath

  if (fundOk) reasons.push('fund_threshold')
  if (pnl30dOk) reasons.push('pnl_30d_threshold')
  if (pctPathOk) reasons.push('pnl_pct_all_time_threshold')

  if (!fundOk && !pnl30dOk && !pctPathOk) {
    return {
      ok: false,
      reasons: ['below_bullish_thresholds'],
      bullishScore: bullishScoreForMetrics(metrics),
    }
  }

  return {
    ok: true,
    reasons,
    bullishScore: bullishScoreForMetrics(metrics),
  }
}

/**
 * Among top-N ranked candidates, pick the most postable (highest bullish score
 * among those that clear the gate). Returns null when none are postable.
 */
export function pickMostPostableIntegrityCardSubject(
  candidates: IntegrityCardSubjectCandidate[],
  gate: IntegrityCardPostGate = DEFAULT_INTEGRITY_CARD_POST_GATE,
): IntegrityCardSubjectCandidate | null {
  let best: IntegrityCardSubjectCandidate | null = null
  let bestScore = -Infinity
  for (const candidate of candidates) {
    const postability = evaluateIntegrityCardPostability(candidate.metrics, gate)
    if (!postability.ok) continue
    if (postability.bullishScore > bestScore) {
      best = candidate
      bestScore = postability.bullishScore
    }
  }
  return best
}
