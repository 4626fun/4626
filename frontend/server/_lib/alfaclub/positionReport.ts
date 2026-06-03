import type { HyperliquidClearinghouseState } from './hyperliquid.js'
import type { PositionAlertConfig } from './positionAlertStore.js'
import {
  computeLiquidationProximityPct,
  computeTargetProgressPct,
  estimateMarkPrice,
  formatPct,
} from './positionProximity.js'

const MAX_REPORT_CHARS = 1900

type HlLeg = NonNullable<HyperliquidClearinghouseState['assetPositions']>[number]
type Room1659MarketSummary = {
  ok: boolean
  hype: number | null
  liquidation: number | null
  roomTotalOpenInterestUsd?: number | null
  userPosition?: {
    side: 'long' | 'short' | null
    unrealizedPnlUsd: number | null
  } | null
  errorReason?: string | null
}
type MarketScopeSummary = {
  snapshotTs: string | null
  previousSnapshotTs: string | null
  majors: Array<{ symbol: string; priceUsd: number | null; change24hPct: number | null }>
  topCreators: Array<{ rank: number; label: string; score: number }>
}
type ConvictionLabel = 'defensive' | 'neutral' | 'aggressive'
type ConvictionProfile = {
  score: number
  label: ConvictionLabel
}
type MarketStats = {
  longCount: number
  shortCount: number
  nearestLiqDist: number | null
}

export function sumHyperliquidUnrealizedPnl(
  state: HyperliquidClearinghouseState | null,
): number | null {
  const legs = state?.assetPositions ?? []
  if (legs.length === 0) return null
  let sum = 0
  let any = false
  for (const leg of legs) {
    if (leg.unrealizedPnl == null) continue
    sum += leg.unrealizedPnl
    any = true
  }
  return any ? sum : null
}

export function formatPositionAlertStatusBlock(alert: PositionAlertConfig | null): string[] {
  if (!alert || !alert.enabled) {
    return [
      '**Hyperliquid alerts** — off',
      '• **`/hermit alert`** — turn on defaults (liq + target, Telegram if linked)',
      '• `/hermit alert off` · `/hermit alert status`',
    ]
  }

  const lines = ['**Hyperliquid alerts** — on']
  if (alert.liquidationWarnPct != null) {
    lines.push(`• Liquidation: within **${alert.liquidationWarnPct}%** on any open HL leg`)
  }
  if (alert.targetPnlUsd != null) {
    lines.push(
      `• Target PnL: **+$${alert.targetPnlUsd.toLocaleString('en-US')}** combined unrealized (fire at **${alert.targetProgressPct}%**)`,
    )
  }
  lines.push(`• Telegram DM: **${alert.telegramEnabled ? 'on' : 'off'}**`)
  lines.push('• `/hermit alert off` · `/hermit alert status`')
  return lines
}

function formatHlLegLine(pos: HlLeg): string[] {
  const side = (pos.side ?? 'flat').toUpperCase()
  const coin = pos.coin ?? 'HL'
  const size = pos.positionValue != null ? `$${Number(pos.positionValue).toFixed(0)}` : '?'
  const entry = pos.entryPx != null ? `$${Number(pos.entryPx).toFixed(2)}` : '?'
  const pnl =
    pos.unrealizedPnl != null
      ? `${pos.unrealizedPnl >= 0 ? '+' : ''}$${Number(pos.unrealizedPnl).toFixed(0)}`
      : '?'
  const liq = pos.liquidationPx != null ? `$${Number(pos.liquidationPx).toFixed(2)}` : '?'
  const lev = pos.leverage != null ? `${Number(pos.leverage).toFixed(1)}x` : '?'

  const lines = [`- ${side} **${coin}** · ${size} · entry ${entry} · ${lev} · PnL **${pnl}** · liq **${liq}**`]

  if (
    pos.side &&
    pos.entryPx != null &&
    pos.liquidationPx != null &&
    pos.positionValue != null &&
    pos.unrealizedPnl != null
  ) {
    const mark = estimateMarkPrice({
      entryPx: pos.entryPx,
      positionValueUsd: pos.positionValue,
      unrealizedPnlUsd: pos.unrealizedPnl,
      side: pos.side,
    })
    if (mark != null) {
      const liqDist = computeLiquidationProximityPct({
        markPrice: mark,
        liquidationPrice: pos.liquidationPx,
        side: pos.side,
      })
      lines.push(`  mark ~$${mark.toFixed(2)} · **${formatPct(liqDist)}** to liquidation`)
    }
  }

  return lines
}

function formatHlPositionsSection(
  state: HyperliquidClearinghouseState | null,
  walletAddress: string,
): string[] {
  const walletLabel = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
  const legs = state?.assetPositions ?? []
  const lines: string[] = [`**Hyperliquid positions** (${walletLabel})`]

  if (legs.length === 0) {
    lines.push('- No open perp positions on Hyperliquid for this wallet.')
    return lines
  }

  for (const leg of legs) {
    lines.push(...formatHlLegLine(leg))
  }

  const totalPnl = sumHyperliquidUnrealizedPnl(state)
  if (totalPnl != null && legs.length > 1) {
    lines.push(
      `- Combined unrealized PnL **${totalPnl >= 0 ? '+' : ''}$${Number(totalPnl).toFixed(0)}**`,
    )
  }

  if (state?.accountValueUsd != null) {
    lines.push(`- Account value **$${Number(state.accountValueUsd).toFixed(0)}**`)
  }

  return lines
}

function collectMarketStats(state: HyperliquidClearinghouseState | null): MarketStats {
  const legs = state?.assetPositions ?? []
  let longCount = 0
  let shortCount = 0
  let nearestLiqDist: number | null = null

  for (const leg of legs) {
    if (leg.side === 'long') longCount += 1
    if (leg.side === 'short') shortCount += 1
    if (
      leg.side &&
      leg.entryPx != null &&
      leg.liquidationPx != null &&
      leg.positionValue != null &&
      leg.unrealizedPnl != null
    ) {
      const mark = estimateMarkPrice({
        entryPx: leg.entryPx,
        positionValueUsd: leg.positionValue,
        unrealizedPnlUsd: leg.unrealizedPnl,
        side: leg.side,
      })
      if (mark != null) {
        const liqDist = computeLiquidationProximityPct({
          markPrice: mark,
          liquidationPrice: leg.liquidationPx,
          side: leg.side,
        })
        if (liqDist != null && (nearestLiqDist == null || liqDist < nearestLiqDist)) {
          nearestLiqDist = liqDist
        }
      }
    }
  }

  return { longCount, shortCount, nearestLiqDist }
}

function computeConvictionProfile(params: {
  state: HyperliquidClearinghouseState | null
  room1659Market?: Room1659MarketSummary | null
}): ConvictionProfile {
  const { state, room1659Market } = params
  const stats = collectMarketStats(state)
  const legs = state?.assetPositions ?? []
  const accountValue = state?.accountValueUsd ?? null
  const notional = state?.totalNtlPosUsd ?? null
  const ratio = accountValue != null && accountValue > 0 && notional != null && notional >= 0 ? notional / accountValue : null

  let score = 25
  if (ratio != null) score += Math.min(Math.max(ratio, 0), 3) * 20
  if (legs.length > 0) score += Math.min(legs.length, 3) * 5
  if (legs.length > 0 && (stats.longCount === 0 || stats.shortCount === 0)) score += 10
  if (room1659Market?.hype != null) score += room1659Market.hype * 0.5

  if (stats.nearestLiqDist != null) {
    if (stats.nearestLiqDist <= 10) score -= 20
    else if (stats.nearestLiqDist <= 20) score -= 10
    else if (stats.nearestLiqDist > 35) score += 10
  } else if (legs.length > 0) {
    score -= 5
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const label: ConvictionLabel = clamped <= 40 ? 'defensive' : clamped <= 70 ? 'neutral' : 'aggressive'
  return { score: clamped, label }
}

function formatMarketReadSection(
  state: HyperliquidClearinghouseState | null,
  conviction: ConvictionProfile,
): string[] {
  const lines: string[] = ['📈 **Market read** (alpha analyst mode)']
  const legs = state?.assetPositions ?? []
  const stats = collectMarketStats(state)
  const accountValue = state?.accountValueUsd ?? null
  const notional = state?.totalNtlPosUsd ?? null

  lines.push(`• Hermit conviction score: **${conviction.score}/100** (${conviction.label}).`)

  if (accountValue != null && accountValue > 0 && notional != null && notional >= 0) {
    const ratio = notional / accountValue
    const regime =
      ratio >= 2.5 ? 'high-leverage / aggressive regime' : ratio >= 1 ? 'moderate risk regime' : 'low-leverage / defensive regime'
    lines.push(`• Notional vs equity: **${ratio.toFixed(2)}x** -> ${regime}.`)
  }

  if (legs.length > 0) {
    lines.push(`• Position posture: **${stats.longCount} long / ${stats.shortCount} short** legs.`)
    if (stats.nearestLiqDist != null) {
      const riskLabel =
        stats.nearestLiqDist <= 10
          ? 'Liquidation buffer is tight; watch this leg first.'
          : 'Liquidation buffers are currently workable.'
      lines.push(`• Nearest liquidation distance: **${formatPct(stats.nearestLiqDist)}**. ${riskLabel}`)
    }
  }

  lines.push('• Preparation edge: monitor liq-distance + target-progress in one loop before changing size.')
  return lines
}

function formatMarketPulseSection(params: {
  roomId?: string | null
  room1659Market?: Room1659MarketSummary | null
  walletAddress: string
}): string[] {
  if (params.roomId !== '1659' || !params.room1659Market) return []
  const pulse = params.room1659Market
  const lines: string[] = ['📡 **Market pulse** (room 1659 context)']
  if (pulse.hype != null) lines.push(`• Hype score: **${pulse.hype}/100**`)
  if (pulse.liquidation != null) lines.push(`• Liquidation pressure signal: **${Number(pulse.liquidation).toFixed(2)}**`)
  if (pulse.roomTotalOpenInterestUsd != null) {
    lines.push(`• Observed open interest proxy: **$${Number(pulse.roomTotalOpenInterestUsd).toFixed(0)}**`)
  }
  if (pulse.userPosition) {
    const side = (pulse.userPosition.side ?? 'flat').toUpperCase()
    const pnl =
      pulse.userPosition.unrealizedPnlUsd != null
        ? `${pulse.userPosition.unrealizedPnlUsd >= 0 ? '+' : ''}$${Number(pulse.userPosition.unrealizedPnlUsd).toFixed(0)}`
        : '?'
    const wallet = `${params.walletAddress.slice(0, 6)}…${params.walletAddress.slice(-4)}`
    lines.push(`• Room 1659 HL leg (${wallet}): **${side}** · PnL **${pnl}**`)
  }
  return lines
}

function formatMarketScopeSection(marketBrief?: MarketScopeSummary | null): string[] {
  if (!marketBrief) return []
  const lines: string[] = ['🌍 **Broader market scope**']
  if (marketBrief.snapshotTs) {
    const snap = marketBrief.previousSnapshotTs
      ? `${marketBrief.snapshotTs} vs ${marketBrief.previousSnapshotTs}`
      : marketBrief.snapshotTs
    lines.push(`• Snapshot: **${snap}**`)
  }

  if (marketBrief.majors.length > 0) {
    const majorLine = marketBrief.majors
      .map((row) => {
        const px =
          row.priceUsd == null
            ? 'n/a'
            : row.priceUsd >= 1000
              ? `$${row.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
              : `$${row.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        const chg =
          row.change24hPct == null
            ? 'n/a'
            : `${row.change24hPct > 0 ? '+' : ''}${row.change24hPct.toFixed(1)}%`
        return `${row.symbol} ${px} (${chg})`
      })
      .join(' · ')
    lines.push(`• Majors: ${majorLine}`)
  }

  if (marketBrief.topCreators.length > 0) {
    const creatorLine = marketBrief.topCreators
      .map((row) => `#${row.rank} ${row.label} (${row.score.toFixed(3)})`)
      .join(' | ')
    lines.push(`• Alfa leaders: ${creatorLine}`)
  }
  return lines
}

function formatOperatorPlaybook(): string[] {
  return [
    '✅ **How this prepares you** (operator playbook)',
    '• Risk control: flags liquidation proximity before forced decision points.',
    '• Profit discipline: quantifies progress to target so exits stay plan-driven.',
    '• Execution speed: one-command defaults keep monitoring always-on.',
    '• Cadence: run `/position` before size changes or after volatility spikes.',
  ]
}

function formatActionCta(conviction: ConvictionProfile, roomId?: string | null): string[] {
  const biasLine =
    conviction.label === 'defensive'
      ? '• Defensive bias: `/hermit alert` now, then reassess exposure before adding size.'
      : conviction.label === 'aggressive'
        ? '• Aggressive bias: momentum is elevated; keep guardrails on before sizing up.'
        : '• Neutral bias: keep defaults on and refresh with `/position` before edits.'
  const lines = [
    '🚀 **Action CTA**',
    biasLine,
    '• Turn on defaults: `/hermit alert`',
    '• Full market breadth: `/market`',
    '• Force refresh intelligence: `/position`',
    '• Disable alerts: `/hermit alert off`',
  ]
  if (roomId === '1659') {
    lines.splice(2, 0, '• Arena lane check: `/arena status`')
  }
  return lines
}

/** Hyperliquid-only position + alert snapshot for `/position`. */
export function buildHyperliquidPositionReport(params: {
  walletAddress: string
  hlState: HyperliquidClearinghouseState | null
  alert?: PositionAlertConfig | null
  roomId?: string | null
  room1659Market?: Room1659MarketSummary | null
  marketBrief?: MarketScopeSummary | null
}): string {
  const { walletAddress, hlState, alert, roomId, room1659Market, marketBrief } = params
  const conviction = computeConvictionProfile({
    state: hlState,
    room1659Market,
  })
  const lines: string[] = [
    '📊 **Hyperliquid snapshot**',
    `_Wallet ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}_`,
    '',
    ...formatHlPositionsSection(hlState, walletAddress),
  ]

  const totalPnl = sumHyperliquidUnrealizedPnl(hlState)
  if (totalPnl != null && alert?.targetPnlUsd != null) {
    const progress = computeTargetProgressPct(totalPnl, alert.targetPnlUsd)
    lines.push('')
    lines.push(
      `**Target progress** — ${formatPct(progress)} of +$${alert.targetPnlUsd.toLocaleString('en-US')} combined unrealized PnL`,
    )
  }

  lines.push('')
  lines.push(...formatPositionAlertStatusBlock(alert ?? null))
  lines.push('', ...formatMarketReadSection(hlState, conviction))

  if (roomId === '1659' && room1659Market && room1659Market.ok === false) {
    lines.push(
      '',
      '⚠️ **Data source note**',
      'One or more upstream sources were unavailable this cycle.',
      'Showing the best available snapshot; retry `/position` in a moment for full enrichment.',
    )
  }

  const pulseSection = formatMarketPulseSection({ roomId, room1659Market, walletAddress })
  if (pulseSection.length > 0) lines.push('', ...pulseSection)
  const marketScopeSection = formatMarketScopeSection(marketBrief)
  if (marketScopeSection.length > 0) lines.push('', ...marketScopeSection)

  lines.push('', ...formatOperatorPlaybook(), '', ...formatActionCta(conviction, roomId))

  let text = lines.join('\n')
  if (text.length > MAX_REPORT_CHARS) {
    text = `${text.slice(0, MAX_REPORT_CHARS - 20).trimEnd()}\n…_(truncated)_`
  }
  return text
}

export function formatHyperliquidLiqAlertMessage(params: {
  walletAddress: string
  warnPct: number
  legs: Array<{ coin: string; side: string; liqDistPct: number }>
}): string {
  const wallet = `${params.walletAddress.slice(0, 6)}…${params.walletAddress.slice(-4)}`
  const legLines = params.legs.map(
    (leg) => `• ${leg.side.toUpperCase()} **${leg.coin}** — **${formatPct(leg.liqDistPct)}** to liq`,
  )
  return [
    '⚠️ **Hyperliquid liquidation alert**',
    wallet,
    `Threshold: within **${params.warnPct}%** of liquidation`,
    '',
    ...legLines,
    '',
    'Review margin and size on Hyperliquid — not financial advice.',
  ].join('\n')
}

export function formatHyperliquidTargetAlertMessage(params: {
  walletAddress: string
  targetPnlUsd: number
  progressPct: number
  currentPnlUsd: number
}): string {
  const wallet = `${params.walletAddress.slice(0, 6)}…${params.walletAddress.slice(-4)}`
  const pnlLabel = `${params.currentPnlUsd >= 0 ? '+' : ''}$${Number(params.currentPnlUsd).toFixed(0)}`
  return [
    '🎯 **Hyperliquid target PnL alert**',
    wallet,
    `Combined unrealized PnL **${pnlLabel}** — **${formatPct(params.progressPct)}** of +$${params.targetPnlUsd.toLocaleString('en-US')} target.`,
    'Consider taking profit or tightening risk — not financial advice.',
  ].join('\n')
}
