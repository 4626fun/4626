import { logger } from '../infra/logger.js'
import { sendAlfaClubRoomText } from './chatBridge.js'
import type { CounterTradeFillAction } from './counterTradeEngine.js'
import { type BankedCloseSummary, formatSignedUsd } from './counterTradeHarvest.js'
import type { HyperliquidUserFillDetailed } from './hyperliquid.js'

function formatCounterTradeRoomPost(params: {
  pair: string
  userFill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  counterSide: 'long' | 'short'
  counterLeverage: number
  counterNotionalUsd: number
  userLeverage: number | null
}): string {
  const openedAt = new Date(params.userFill.time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  const userSide = params.userFill.side === 'short' ? 'short' : 'long'
  const counterMarginUsd = params.counterNotionalUsd / Math.max(0.25, params.counterLeverage)
  const markRaw = params.userFill.px
  const mark = markRaw != null ? Number(markRaw) : null
  const oppositeLabel = params.counterSide === 'long' ? 'Long' : 'Short'
  const userLabel = userSide === 'long' ? 'Long' : 'Short'

  return [
    `✅ Opened ${oppositeLabel} · ${openedAt}`,
    '',
    `${params.pair}/USDC ${params.counterLeverage}x`,
    '',
    `Mark ${mark != null && Number.isFinite(mark) ? `$${mark.toFixed(2)}` : 'n/a'}`,
    `Margin/Size $${counterMarginUsd.toFixed(2)} / $${params.counterNotionalUsd.toFixed(2)}`,
    `Signal ${params.fillAction}`,
    '',
    `User ${userLabel}${params.userLeverage != null ? ` ${params.userLeverage}x` : ''} · bot opened ${oppositeLabel}`,
  ].join('\n')
}

function formatCounterTradeExitRoomPost(params: {
  pair: string
  userFill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  closedSide: 'long' | 'short' | null
  closedPositionValueUsd: number | null
  banked: BankedCloseSummary | null
}): string {
  const closedAt = new Date(params.userFill.time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  const userLabel = params.userFill.side === 'short' ? 'Short' : 'Long'
  const closedLabel =
    params.closedSide === 'long' ? 'Long' : params.closedSide === 'short' ? 'Short' : 'position'
  const userVerb = params.fillAction === 'liquidated' ? 'was liquidated out of' : 'closed'

  return [
    `✅ Closed ${closedLabel} · ${closedAt}`,
    '',
    `${params.pair}/USDC`,
    '',
    params.closedPositionValueUsd != null
      ? `Closed position ~$${params.closedPositionValueUsd.toFixed(2)}`
      : 'Closed position',
    ...(params.banked != null
      ? [
          `Banked ${formatSignedUsd(params.banked.netRealizedUsd)} (pnl ${formatSignedUsd(params.banked.realizedPnlUsd)}, fees $${params.banked.feesUsd.toFixed(2)})`,
        ]
      : []),
    `Signal ${params.fillAction}`,
    '',
    `User ${userVerb} ${userLabel} · bot closed ${closedLabel}`,
  ].join('\n')
}

export function formatSpotSweepRoomPost(params: {
  amountUsd: number
  agentWalletAddress: string
  dryRun: boolean
}): string {
  const walletLabel = `${params.agentWalletAddress.slice(0, 6)}…${params.agentWalletAddress.slice(-4)}`
  return [
    '🐈‍⬛ inverseAKITA',
    '',
    '✅ Bridge funds settled',
    '',
    `Swept $${params.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spot -> perp`,
    `Wallet ${walletLabel}`,
    params.dryRun ? '[dry-run]' : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function postCounterTradeExitRoomUpdate(params: {
  runtimeRoomId: string
  postRoomId: string
  pair: string
  userFill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  closedSide: 'long' | 'short' | null
  closedPositionValueUsd: number | null
  banked: BankedCloseSummary | null
}): Promise<void> {
  const message = formatCounterTradeExitRoomPost({
    pair: params.pair,
    userFill: params.userFill,
    fillAction: params.fillAction,
    closedSide: params.closedSide,
    closedPositionValueUsd: params.closedPositionValueUsd,
    banked: params.banked,
  })
  const send = await sendAlfaClubRoomText({
    roomId: params.postRoomId,
    text: message,
  })
  logger.info('counter_trade.exit_room_posted', {
    roomId: params.runtimeRoomId,
    postRoomId: params.postRoomId,
    lane: send.lane,
    pair: params.pair,
    fillAction: params.fillAction,
    closedSide: params.closedSide,
    bankedNetUsd: params.banked?.netRealizedUsd ?? null,
  })
}

export async function postCounterTradeRoomUpdate(params: {
  runtimeRoomId: string
  postRoomId: string
  pair: string
  userFill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  counterSide: 'long' | 'short'
  counterLeverage: number
  counterNotionalUsd: number
  userLeverage: number | null
}): Promise<void> {
  const message = formatCounterTradeRoomPost({
    pair: params.pair,
    userFill: params.userFill,
    fillAction: params.fillAction,
    counterSide: params.counterSide,
    counterLeverage: params.counterLeverage,
    counterNotionalUsd: params.counterNotionalUsd,
    userLeverage: params.userLeverage,
  })
  const send = await sendAlfaClubRoomText({
    roomId: params.postRoomId,
    text: message,
  })
  logger.info('counter_trade.room_posted', {
    roomId: params.runtimeRoomId,
    postRoomId: params.postRoomId,
    lane: send.lane,
    pair: params.pair,
    fillAction: params.fillAction,
    counterSide: params.counterSide,
    counterLeverage: params.counterLeverage,
    counterNotionalUsd: params.counterNotionalUsd,
  })
}
