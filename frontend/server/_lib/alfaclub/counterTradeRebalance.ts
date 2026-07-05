/**
 * Room 1659 paired-leg harvest-and-dip rebalancing.
 *
 * A room fill is the trigger — not a directional mirror. On each add/reduce we
 * inspect both silos (AlfaClub user leg + InverseAKITA bot leg), take profit
 * on whichever leg is winning, and add size to whichever leg is losing.
 */
import type { ArenaConfig } from '../arena/arenaConfig.js'
import { runArenaTrade } from '../arena/arenaClient.js'
import { logger } from '../infra/logger.js'
import type { CounterTradeRuntimeConfig, CounterTradeSide } from './counterTradeConfig.js'
import { isDipAddLiqSafeAfterAdd } from './counterTradeDefense.js'
import { resolveDrawdownBasedDipAddUsd, resolveMaxCounterNotionalUsd } from './counterTradeSizing.js'
import {
  classifyCounterTradeFillAction,
  deriveUserPositionChangePct,
  findCounterPositionForCoin,
  type CounterTradeFillAction,
  type CounterWalletPositionLeg,
} from './counterTradeEngine.js'
import { findCoinLeverageFromState } from './counterTradeLeverage.js'
import { sendAlfaClubRoomText } from './chatBridge.js'
import type { HyperliquidClearinghouseState, HyperliquidUserFillDetailed } from './hyperliquid.js'
import {
  COUNTER_TRADE_REBALANCE_DIP_EXECUTED_REASON,
  COUNTER_TRADE_REBALANCE_HARVEST_EXECUTED_REASON,
  countRebalanceDipAddsForLeg,
  recordCounterTradeAction,
} from './counterTradeStore.js'

const PNL_EPSILON = 1e-6

export type RebalanceSilo = 'bot' | 'user'

export type PairedLegRebalanceHarvest = {
  type: 'harvest'
  silo: RebalanceSilo
  coin: string
  side: CounterTradeSide
  reduceNotionalUsd: number
  fullClose: boolean
  positionValueUsd: number
  unrealizedPnlUsd: number
}

export type PairedLegRebalanceDip = {
  type: 'dip_add'
  silo: RebalanceSilo
  coin: string
  side: CounterTradeSide
  addNotionalUsd: number
  leverage: number
  positionValueUsd: number
  unrealizedPnlUsd: number
}

export type PairedLegRebalancePlan = {
  ok: true
  rebalancePct: number
  harvest: PairedLegRebalanceHarvest | null
  dip: PairedLegRebalanceDip | null
}

export type PairedLegRebalanceSkip =
  | 'missing_pair'
  | 'missing_position_change_pct'
  | 'no_paired_legs'
  | 'no_winner_or_loser'
  | 'below_min_notional'
  | 'invalid_input'
  | 'dip_curve_unavailable'
  | 'max_dip_adds'
  | 'liq_gate_unprojectable'
  | 'liq_gate_blocked'

export type PairedLegRebalancePlanResult =
  | PairedLegRebalancePlan
  | { ok: false; reason: PairedLegRebalanceSkip }

export type PairedLegRebalanceFlowResult = {
  executedDelta: number
  skippedDelta: number
  failedDelta: number
}

function findWalletLegForCoin(
  state: HyperliquidClearinghouseState | null,
  coin: string | null | undefined,
): CounterWalletPositionLeg | null {
  const target = String(coin ?? '').trim().toUpperCase()
  if (!target) return null
  for (const leg of state?.assetPositions ?? []) {
    if (String(leg.coin ?? '').trim().toUpperCase() !== target) continue
    if (leg.side !== 'long' && leg.side !== 'short') continue
    if (leg.positionValue == null || !Number.isFinite(leg.positionValue) || leg.positionValue <= 0) continue
    return leg
  }
  return null
}

function clampHarvestNotional(params: {
  targetUsd: number
  positionValueUsd: number
  minReduceNotionalUsd: number
}): { reduceNotionalUsd: number; fullClose: boolean } | null {
  const { targetUsd, positionValueUsd, minReduceNotionalUsd } = params
  if (!Number.isFinite(targetUsd) || targetUsd <= 0) return null
  if (positionValueUsd <= minReduceNotionalUsd * 2) {
    return { reduceNotionalUsd: positionValueUsd, fullClose: true }
  }
  const floored = Math.max(targetUsd, minReduceNotionalUsd)
  if (floored >= positionValueUsd) {
    return { reduceNotionalUsd: positionValueUsd, fullClose: true }
  }
  return { reduceNotionalUsd: floored, fullClose: false }
}

type TaggedLeg = {
  silo: RebalanceSilo
  leg: CounterWalletPositionLeg
}

function pickWinnerAndLoser(legs: TaggedLeg[]): { winner: TaggedLeg; loser: TaggedLeg } | null {
  let winner: TaggedLeg | null = null
  let loser: TaggedLeg | null = null
  for (const tagged of legs) {
    const pnl = tagged.leg.unrealizedPnl ?? 0
    if (pnl > PNL_EPSILON) {
      if (!winner || pnl > (winner.leg.unrealizedPnl ?? 0)) winner = tagged
    } else if (pnl < -PNL_EPSILON) {
      if (!loser || pnl < (loser.leg.unrealizedPnl ?? 0)) loser = tagged
    }
  }
  if (!winner || !loser) return null
  return { winner, loser }
}

export function derivePairedLegRebalancePlan(params: {
  fill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  runtime: CounterTradeRuntimeConfig
  userWalletState: HyperliquidClearinghouseState | null
  botWalletState: HyperliquidClearinghouseState | null
  dipAddsUsed?: number
}): PairedLegRebalancePlanResult {
  const pair = String(params.fill.coin ?? '').trim()
  if (!pair) return { ok: false, reason: 'missing_pair' }

  const positionChangePct = deriveUserPositionChangePct(params.fill, params.fillAction)
  if (positionChangePct == null) {
    return { ok: false, reason: 'missing_position_change_pct' }
  }
  const rebalancePct = positionChangePct * (params.runtime.inverseRebalanceScalePct / 100)
  if (!Number.isFinite(rebalancePct) || rebalancePct <= 0) {
    return { ok: false, reason: 'invalid_input' }
  }

  const userLeg = findWalletLegForCoin(params.userWalletState, pair)
  const botLeg = findWalletLegForCoin(params.botWalletState, pair)
  const taggedLegs: TaggedLeg[] = []
  if (userLeg?.side) taggedLegs.push({ silo: 'user', leg: userLeg })
  if (botLeg?.side) taggedLegs.push({ silo: 'bot', leg: botLeg })
  if (taggedLegs.length < 2) {
    return { ok: false, reason: 'no_paired_legs' }
  }

  const winnerLoser = pickWinnerAndLoser(taggedLegs)
  if (!winnerLoser) {
    return { ok: false, reason: 'no_winner_or_loser' }
  }

  const { winner, loser } = winnerLoser
  const winnerSide = winner.leg.side
  const loserSide = loser.leg.side
  if (!winnerSide || !loserSide) {
    return { ok: false, reason: 'invalid_input' }
  }

  const winnerValue = winner.leg.positionValue ?? 0
  const loserValue = loser.leg.positionValue ?? 0
  const harvestTargetUsd = winnerValue * rebalancePct

  const harvestClamp = clampHarvestNotional({
    targetUsd: harvestTargetUsd,
    positionValueUsd: winnerValue,
    minReduceNotionalUsd: params.runtime.minReduceNotionalUsd,
  })
  if (!harvestClamp) {
    return { ok: false, reason: 'below_min_notional' }
  }

  const dipAddsUsed = params.dipAddsUsed ?? 0
  if (dipAddsUsed >= params.runtime.maxDipAddsPerLeg) {
    return { ok: false, reason: 'max_dip_adds' }
  }

  const dipWalletState = loser.silo === 'user' ? params.userWalletState : params.botWalletState
  const curveAddUsd = resolveDrawdownBasedDipAddUsd({
    runtime: params.runtime,
    accountValueUsd: dipWalletState?.accountValueUsd,
    leg: loser.leg,
  })
  if (curveAddUsd == null) {
    return { ok: false, reason: 'dip_curve_unavailable' }
  }

  const maxDipUsd = resolveMaxCounterNotionalUsd({
    runtime: params.runtime,
    accountValueUsd: dipWalletState?.accountValueUsd,
    strictInverseParity: true,
  })
  const dipNotionalUsd = Math.min(curveAddUsd, maxDipUsd)
  if (!Number.isFinite(dipNotionalUsd) || dipNotionalUsd < params.runtime.minOrderNotionalUsd) {
    return { ok: false, reason: 'below_min_notional' }
  }

  const liqGate = isDipAddLiqSafeAfterAdd({
    leg: loser.leg,
    addNotionalUsd: dipNotionalUsd,
    runtime: params.runtime,
  })
  if (!liqGate.ok) {
    return {
      ok: false,
      reason: liqGate.reason === 'unprojectable' ? 'liq_gate_unprojectable' : 'liq_gate_blocked',
    }
  }

  const loserLeverage =
    findCoinLeverageFromState(
      loser.silo === 'user' ? params.userWalletState : params.botWalletState,
      pair,
    ) ?? params.runtime.globalMaxLeverage

  return {
    ok: true,
    rebalancePct,
    harvest: {
      type: 'harvest',
      silo: winner.silo,
      coin: pair,
      side: winnerSide,
      reduceNotionalUsd: harvestClamp.reduceNotionalUsd,
      fullClose: harvestClamp.fullClose,
      positionValueUsd: winnerValue,
      unrealizedPnlUsd: winner.leg.unrealizedPnl ?? 0,
    },
    dip: {
      type: 'dip_add',
      silo: loser.silo,
      coin: pair,
      side: loserSide,
      addNotionalUsd: dipNotionalUsd,
      leverage: Math.min(loserLeverage, params.runtime.globalMaxLeverage),
      positionValueUsd: loserValue,
      unrealizedPnlUsd: loser.leg.unrealizedPnl ?? 0,
    },
  }
}

function formatRebalanceRoomPost(params: {
  pair: string
  fillAction: CounterTradeFillAction
  rebalancePct: number
  harvest: PairedLegRebalanceHarvest | null
  dip: PairedLegRebalanceDip | null
}): string {
  const pctLabel = `${(params.rebalancePct * 100).toFixed(1)}%`
  const lines = [
    '🔄 **Paired-leg rebalance**',
    '',
    `${params.pair}/USDC · trigger ${params.fillAction} · slice ${pctLabel}`,
  ]
  if (params.harvest) {
    const side = params.harvest.side === 'long' ? 'Long' : 'Short'
    const silo = params.harvest.silo === 'user' ? 'AlfaClub' : 'InverseAKITA'
    lines.push(
      params.harvest.fullClose
        ? `🌾 Harvest ${silo} ${side} (closed ~$${params.harvest.reduceNotionalUsd.toFixed(2)})`
        : `🌾 Harvest ${silo} ${side} (~$${params.harvest.reduceNotionalUsd.toFixed(2)} off $${params.harvest.positionValueUsd.toFixed(2)})`,
    )
  }
  if (params.dip) {
    const side = params.dip.side === 'long' ? 'Long' : 'Short'
    const silo = params.dip.silo === 'user' ? 'AlfaClub' : 'InverseAKITA'
    lines.push(
      `📈 Dip ${silo} ${side} (+$${params.dip.addNotionalUsd.toFixed(2)} on $${params.dip.positionValueUsd.toFixed(2)} loser)`,
    )
  }
  lines.push('', 'Take profit on the winning leg · add to the losing leg.')
  return lines.join('\n')
}

function resolveSiloConfig(params: {
  silo: RebalanceSilo
  baseConfig: ArenaConfig
  botIdentityConfig: ArenaConfig
  userSiloMaster: string
  userSiloHlAgentPrivateKey: string | null
  strategySubaccount: string | null
}): { config: ArenaConfig; canExecute: boolean } {
  if (params.silo === 'bot') {
    return {
      config: {
        ...params.botIdentityConfig,
        hlSubaccountAddress: params.strategySubaccount,
      },
      canExecute: true,
    }
  }
  if (!params.userSiloHlAgentPrivateKey) {
    return { config: params.baseConfig, canExecute: false }
  }
  return {
    config: {
      ...params.baseConfig,
      agentId: null,
      agentWalletAddress: null,
      hlApiWalletAddress: null,
      hlAgentPrivateKey: params.userSiloHlAgentPrivateKey,
      hlMasterAddressOverride: params.userSiloMaster,
    },
    canExecute: true,
  }
}

export async function handlePairedLegRebalanceFlow(params: {
  roomId: string
  senderAddress: string
  eventKey: string
  fill: HyperliquidUserFillDetailed
  runtime: CounterTradeRuntimeConfig
  userWalletState: HyperliquidClearinghouseState | null
  botWalletState: HyperliquidClearinghouseState | null
  userWalletForFills: string
  baseArenaConfig: ArenaConfig
  botIdentityConfig: ArenaConfig
  strategyKey: string
  strategySubaccount: string | null
  chatPostEnabled: boolean
  chatPostRoomId: string
}): Promise<PairedLegRebalanceFlowResult> {
  const fillAction = classifyCounterTradeFillAction(params.fill)
  const pair = String(params.fill.coin ?? '').trim().toUpperCase()

  let dipAddsUsed = 0
  if (pair) {
    const userLeg = findWalletLegForCoin(params.userWalletState, pair)
    const botLeg = findWalletLegForCoin(params.botWalletState, pair)
    const taggedLegs: TaggedLeg[] = []
    if (userLeg?.side) taggedLegs.push({ silo: 'user', leg: userLeg })
    if (botLeg?.side) taggedLegs.push({ silo: 'bot', leg: botLeg })
    const winnerLoser = pickWinnerAndLoser(taggedLegs)
    if (winnerLoser) {
      dipAddsUsed = await countRebalanceDipAddsForLeg({
        roomId: params.roomId,
        senderAddress: params.senderAddress,
        coin: pair,
        silo: winnerLoser.loser.silo,
      })
    }
  }

  const plan = derivePairedLegRebalancePlan({
    fill: params.fill,
    fillAction,
    runtime: params.runtime,
    userWalletState: params.userWalletState,
    botWalletState: params.botWalletState,
    dipAddsUsed,
  })

  const recordSkip = async (reason: string) => {
    await recordCounterTradeAction({
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      eventKey: params.eventKey,
      status: 'skipped',
      reason,
      counterSide: null,
      counterNotionalUsd: null,
      counterLeverage: null,
    })
  }

  if (!plan.ok) {
    await recordSkip(`rebalance_${plan.reason}`)
    return { executedDelta: 0, skippedDelta: 1, failedDelta: 0 }
  }

  const userSiloMaster = params.runtime.userSiloMasterAddress ?? params.userWalletForFills
  let executedDelta = 0
  let failedDelta = 0
  let skippedDelta = 0

  const executeHarvest = async (harvest: PairedLegRebalanceHarvest): Promise<boolean> => {
    const siloCfg = resolveSiloConfig({
      silo: harvest.silo,
      baseConfig: params.baseArenaConfig,
      botIdentityConfig: params.botIdentityConfig,
      userSiloMaster,
      userSiloHlAgentPrivateKey: params.runtime.userSiloHlAgentPrivateKey,
      strategySubaccount: params.strategySubaccount,
    })
    if (!siloCfg.canExecute) {
      await recordSkip(`rebalance_user_silo_unavailable:harvest:${harvest.coin}`)
      skippedDelta += 1
      return false
    }
    const tradeResult = await runArenaTrade(
      {
        action: 'close',
        pair: harvest.coin,
        ...(harvest.fullClose ? {} : { sizeUsd: harvest.reduceNotionalUsd }),
        strategyKey: params.strategyKey,
        subaccountAddress: harvest.silo === 'bot' ? (params.strategySubaccount ?? undefined) : undefined,
      },
      siloCfg.config,
    )
    await recordCounterTradeAction({
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      eventKey: `${params.eventKey}|harvest|${harvest.silo}`,
      status: tradeResult.ok ? 'executed' : 'failed',
      reason: tradeResult.ok
        ? COUNTER_TRADE_REBALANCE_HARVEST_EXECUTED_REASON
        : `rebalance_harvest_failed:${String(tradeResult.message ?? 'arena_close_failed')}`,
      counterSide: harvest.side,
      counterNotionalUsd: harvest.reduceNotionalUsd,
      counterLeverage: null,
    })
    if (tradeResult.ok) {
      executedDelta += 1
      logger.info('counter_trade.rebalance_harvest', {
        roomId: params.roomId,
        senderAddress: params.senderAddress,
        silo: harvest.silo,
        coin: harvest.coin,
        side: harvest.side,
        reduceNotionalUsd: harvest.reduceNotionalUsd,
        fullClose: harvest.fullClose,
      })
      return true
    }
    failedDelta += 1
    return false
  }

  const executeDip = async (dip: PairedLegRebalanceDip): Promise<boolean> => {
    const siloCfg = resolveSiloConfig({
      silo: dip.silo,
      baseConfig: params.baseArenaConfig,
      botIdentityConfig: params.botIdentityConfig,
      userSiloMaster,
      userSiloHlAgentPrivateKey: params.runtime.userSiloHlAgentPrivateKey,
      strategySubaccount: params.strategySubaccount,
    })
    if (!siloCfg.canExecute) {
      await recordSkip(`rebalance_user_silo_unavailable:dip:${dip.coin}`)
      skippedDelta += 1
      return false
    }
    const tradeResult = await runArenaTrade(
      {
        action: 'open',
        pair: dip.coin,
        side: dip.side,
        sizeUsd: dip.addNotionalUsd,
        leverage: dip.leverage,
        strategyKey: params.strategyKey,
        subaccountAddress: dip.silo === 'bot' ? (params.strategySubaccount ?? undefined) : undefined,
      },
      siloCfg.config,
    )
    await recordCounterTradeAction({
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      eventKey: `${params.eventKey}|dip|${dip.silo}`,
      status: tradeResult.ok ? 'executed' : 'failed',
      reason: tradeResult.ok
        ? COUNTER_TRADE_REBALANCE_DIP_EXECUTED_REASON
        : `rebalance_dip_failed:${String(tradeResult.message ?? 'arena_open_failed')}`,
      counterSide: dip.side,
      counterNotionalUsd: dip.addNotionalUsd,
      counterLeverage: dip.leverage,
    })
    if (tradeResult.ok) {
      executedDelta += 1
      logger.info('counter_trade.rebalance_dip', {
        roomId: params.roomId,
        senderAddress: params.senderAddress,
        silo: dip.silo,
        coin: dip.coin,
        side: dip.side,
        addNotionalUsd: dip.addNotionalUsd,
        leverage: dip.leverage,
      })
      return true
    }
    failedDelta += 1
    return false
  }

  if (plan.harvest) await executeHarvest(plan.harvest)
  if (plan.dip) await executeDip(plan.dip)

  if (params.chatPostEnabled && (executedDelta > 0 || skippedDelta > 0)) {
    try {
      await sendAlfaClubRoomText({
        roomId: params.chatPostRoomId,
        text: formatRebalanceRoomPost({
          pair: String(params.fill.coin ?? '').trim(),
          fillAction,
          rebalancePct: plan.rebalancePct,
          harvest: plan.harvest,
          dip: plan.dip,
        }),
      })
    } catch (postError) {
      logger.warn('counter_trade.rebalance_post_failed', {
        roomId: params.roomId,
        message: postError instanceof Error ? postError.message : String(postError),
      })
    }
  }

  if (executedDelta === 0 && skippedDelta === 0 && failedDelta === 0) {
    await recordSkip('rebalance_no_actions')
    skippedDelta = 1
  }

  return { executedDelta, skippedDelta, failedDelta }
}

export { findWalletLegForCoin, findCounterPositionForCoin }
