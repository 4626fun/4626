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

/** Hyperliquid-only position + alert snapshot for `/position`. */
export function buildHyperliquidPositionReport(params: {
  walletAddress: string
  hlState: HyperliquidClearinghouseState | null
  alert?: PositionAlertConfig | null
}): string {
  const { walletAddress, hlState, alert } = params
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
