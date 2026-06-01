import type { HyperliquidClearinghouseState } from './hyperliquid.js'
import type { Room1659MarketSnapshot } from './room1659Market.js'
import { formatRoom1659MarketForHermit, formatUsdc } from './room1659Market.js'
import type { PositionAlertConfig } from './positionAlertStore.js'
import {
  computeLiquidationProximityPct,
  computeTargetProgressPct,
  estimateMarkPrice,
  formatPct,
} from './positionProximity.js'

const ROOM_1659 = '1659'
const MAX_REPORT_CHARS = 1900

export function formatPositionAlertStatusBlock(alert: PositionAlertConfig | null): string[] {
  if (!alert || !alert.enabled) {
    return [
      '**Alerts** — off',
      '• `/hermit alert liq 10` — Telegram when within 10% of liquidation',
      '• `/hermit alert target 5000` — target +$5k unrealized PnL',
      '• `/hermit alert progress 80` — fire at 80% of target',
      '• `/hermit alert telegram on` — DM your linked Telegram (4626 account required)',
    ]
  }

  const lines = ['**Alerts** — on']
  if (alert.liquidationWarnPct != null) {
    lines.push(`• Liquidation warn: within **${alert.liquidationWarnPct}%** of liq price`)
  }
  if (alert.targetPnlUsd != null) {
    lines.push(
      `• Target gain: **+$${alert.targetPnlUsd.toLocaleString('en-US')}** unrealized PnL (fire at **${alert.targetProgressPct}%** of target)`,
    )
  }
  lines.push(`• Telegram DM: **${alert.telegramEnabled ? 'on' : 'off'}**`)
  lines.push('• `/hermit alert off` — disable · `/hermit alert status` — refresh')
  return lines
}

function formatHlPositionSection(
  state: HyperliquidClearinghouseState | null,
  walletAddress: string,
): string[] {
  const walletLabel = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
  const lines: string[] = [`**Hyperliquid** (${walletLabel})`]
  const pos = state?.assetPositions?.[0]
  if (!pos) {
    lines.push('- No open perp position.')
    return lines
  }

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

  lines.push(`- ${side} **${coin}** · notional ${size} · entry ${entry} · lev ${lev}`)
  lines.push(`- Unrealized PnL **${pnl}** · liquidation **${liq}**`)

  if (pos.side && pos.entryPx != null && pos.liquidationPx != null && pos.positionValue != null && pos.unrealizedPnl != null) {
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
      lines.push(`- Est. mark **$${mark.toFixed(2)}** · **${formatPct(liqDist)}** buffer to liquidation`)
    }
  }

  return lines
}

function formatRoom1659Extras(snapshot: Room1659MarketSnapshot): string[] {
  const lines: string[] = []
  const meta: string[] = []
  if (snapshot.hype != null) meta.push(`Hype **${snapshot.hype}**/100`)
  if (snapshot.liquidation != null) meta.push(`Room liq signal **${snapshot.liquidation}**`)
  if (meta.length > 0) lines.push(`**Room signals** — ${meta.join(' · ')}`)

  const formatted = formatRoom1659MarketForHermit(snapshot)
  const curveLines = formatted.yourPosition.split('\n').filter((line) => line.trim().length > 0)
  if (curveLines.length > 0) {
    lines.push('')
    lines.push('**FriendKey curve (room 1659)**')
    for (const line of curveLines) {
      if (line.startsWith('YOUR POSITION:')) continue
      lines.push(line.startsWith('-') ? line : `- ${line}`)
    }
  }

  if (snapshot.onchain?.userBalance != null && snapshot.onchain.userBalance > 0n) {
    const keys = Number(snapshot.onchain.userBalance)
    lines.push(`- You hold **${keys.toLocaleString('en-US')}** FriendKey${keys === 1 ? '' : 's'}`)
  }

  return lines
}

export function buildComprehensivePositionReport(params: {
  roomId: string
  walletAddress: string
  hlState: HyperliquidClearinghouseState | null
  room1659Snapshot?: Room1659MarketSnapshot | null
  alert?: PositionAlertConfig | null
}): string {
  const { roomId, walletAddress, hlState, room1659Snapshot, alert } = params
  const lines: string[] = [
    '📊 **Position snapshot**',
    `_Live read for ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)} · room ${roomId}_`,
    '',
    ...formatHlPositionSection(hlState, walletAddress),
  ]

  if (roomId === ROOM_1659 && room1659Snapshot?.ok) {
    lines.push('')
    lines.push(...formatRoom1659Extras(room1659Snapshot))
  }

  const pos = hlState?.assetPositions?.[0]
  if (pos?.unrealizedPnl != null && alert?.targetPnlUsd != null) {
    const progress = computeTargetProgressPct(pos.unrealizedPnl, alert.targetPnlUsd)
    lines.push('')
    lines.push(`**Target progress** — ${formatPct(progress)} of +$${alert.targetPnlUsd.toLocaleString('en-US')} goal`)
  }

  lines.push('')
  lines.push(...formatPositionAlertStatusBlock(alert ?? null))

  let text = lines.join('\n')
  if (text.length > MAX_REPORT_CHARS) {
    text = `${text.slice(0, MAX_REPORT_CHARS - 20).trimEnd()}\n…_(truncated)_`
  }
  return text
}

export function formatPositionAlertTriggerMessage(params: {
  kind: 'liq' | 'target'
  roomId: string
  walletAddress: string
  coin: string
  side: string
  liqDistPct?: number | null
  currentPnlUsd?: number | null
  targetPnlUsd?: number | null
  progressPct?: number | null
}): string {
  const wallet = `${params.walletAddress.slice(0, 6)}…${params.walletAddress.slice(-4)}`
  if (params.kind === 'liq') {
    return [
      '⚠️ **4626 position alert — liquidation proximity**',
      `Room **${params.roomId}** · ${wallet}`,
      `${params.side.toUpperCase()} **${params.coin}** — **${formatPct(params.liqDistPct ?? null)}** from liquidation.`,
      'Review size, margin, and stops in Hyperliquid / AlfaClub.',
    ].join('\n')
  }
  return [
    '🎯 **4626 position alert — target gain**',
    `Room **${params.roomId}** · ${wallet}`,
    `${params.side.toUpperCase()} **${params.coin}** — **${formatPct(params.progressPct ?? null)}** of +$${(params.targetPnlUsd ?? 0).toLocaleString('en-US')} target (${params.currentPnlUsd != null ? (params.currentPnlUsd >= 0 ? '+' : '') + '$' + Number(params.currentPnlUsd).toFixed(0) : '?'} now).`,
    'Consider taking profit or tightening risk — not financial advice.',
  ].join('\n')
}

// Re-export for tests that need USDC formatting from curve block
export { formatUsdc }
