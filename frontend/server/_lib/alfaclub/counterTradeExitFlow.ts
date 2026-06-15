import type { ArenaConfig } from '../arena/arenaConfig.js'
import { runArenaTrade } from '../arena/arenaClient.js'
import { logger } from '../infra/logger.js'
import { type CounterTradeFillAction, findCounterPositionForCoin } from './counterTradeEngine.js'
import { type HyperliquidClearinghouseState, type HyperliquidUserFillDetailed } from './hyperliquid.js'
import { postCounterTradeExitRoomUpdate } from './counterTradeRoomPosting.js'
import { type BankedCloseSummary, resolveBotBankedPnlForClose } from './counterTradeHarvest.js'
import {
  COUNTER_TRADE_EXIT_EXECUTED_REASON,
  recordCounterTradeAction,
} from './counterTradeStore.js'

export type CounterTradeExitFlowResult = {
  handled: boolean
  executedDelta: number
  skippedDelta: number
  failedDelta: number
}

export async function handleCounterTradeExitFlow(params: {
  roomId: string
  senderAddress: string
  eventKey: string
  fill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  runtimeExitEnabled: boolean
  chatPostEnabled: boolean
  chatPostRoomId: string
  openedCoinsThisTick: Set<string>
  closedCoinsThisTick: Set<string>
  counterWalletState: HyperliquidClearinghouseState | null
  identityConfig: ArenaConfig
  strategyKey: string
  strategySubaccount: string | null
}): Promise<CounterTradeExitFlowResult> {
  const executionConfig: ArenaConfig = {
    ...params.identityConfig,
    hlSubaccountAddress: params.strategySubaccount,
  }
  const exitPair = String(params.fill.coin ?? '').trim()
  const exitCoinKey = exitPair.toUpperCase()
  const recordExitOutcome = async (status: 'executed' | 'skipped' | 'failed', reason: string) => {
    await recordCounterTradeAction({
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      eventKey: params.eventKey,
      status,
      reason,
      counterSide: null,
      counterNotionalUsd: null,
      counterLeverage: null,
    })
  }

  if (!params.runtimeExitEnabled) {
    await recordExitOutcome('skipped', `exit_disabled:${params.fillAction}`)
    return { handled: true, executedDelta: 0, skippedDelta: 1, failedDelta: 0 }
  }
  if (!exitPair) {
    await recordExitOutcome('skipped', 'exit_missing_pair')
    return { handled: true, executedDelta: 0, skippedDelta: 1, failedDelta: 0 }
  }
  if (params.closedCoinsThisTick.has(exitCoinKey)) {
    await recordExitOutcome('skipped', 'exit_already_closed_this_tick')
    return { handled: true, executedDelta: 0, skippedDelta: 1, failedDelta: 0 }
  }

  const botLeg = findCounterPositionForCoin(params.counterWalletState, exitPair)
  if (!botLeg && !params.openedCoinsThisTick.has(exitCoinKey)) {
    await recordExitOutcome('skipped', 'exit_no_position')
    return { handled: true, executedDelta: 0, skippedDelta: 1, failedDelta: 0 }
  }

  const closeSubmittedAtMs = Date.now()
  const closeResult = await runArenaTrade(
    {
      action: 'close',
      pair: exitPair,
      strategyKey: params.strategyKey,
      subaccountAddress: params.strategySubaccount ?? undefined,
    },
    executionConfig,
  )
  if (closeResult.ok) {
    params.closedCoinsThisTick.add(exitCoinKey)
    params.openedCoinsThisTick.delete(exitCoinKey)
    await recordCounterTradeAction({
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      eventKey: params.eventKey,
      status: 'executed',
      reason: COUNTER_TRADE_EXIT_EXECUTED_REASON,
      counterSide: botLeg?.side ?? null,
      counterNotionalUsd: null,
      counterLeverage: null,
    })

    let banked: BankedCloseSummary | null = null
    if (params.identityConfig.agentWalletAddress) {
      try {
        banked = await resolveBotBankedPnlForClose({
          botWalletAddress: params.identityConfig.agentWalletAddress,
          coin: exitPair,
          closeSubmittedAtMs,
        })
      } catch (harvestError) {
        logger.warn('counter_trade.harvest_lookup_failed', {
          roomId: params.roomId,
          pair: exitPair,
          message: harvestError instanceof Error ? harvestError.message : String(harvestError),
        })
      }
    }
    logger.info('counter_trade.harvest', {
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      pair: exitPair,
      fillAction: params.fillAction,
      strategy: params.strategyKey,
      subaccount: params.strategySubaccount,
      closedSide: botLeg?.side ?? null,
      closedPositionValueUsd: botLeg?.positionValue ?? null,
      bankedRealizedPnlUsd: banked?.realizedPnlUsd ?? null,
      bankedFeesUsd: banked?.feesUsd ?? null,
      bankedNetUsd: banked?.netRealizedUsd ?? null,
      bankedFillCount: banked?.fillCount ?? 0,
    })

    if (params.chatPostEnabled) {
      try {
        await postCounterTradeExitRoomUpdate({
          runtimeRoomId: params.roomId,
          postRoomId: params.chatPostRoomId,
          pair: exitPair,
          userFill: params.fill,
          fillAction: params.fillAction,
          closedSide: botLeg?.side ?? null,
          closedPositionValueUsd: botLeg?.positionValue ?? null,
          banked,
        })
      } catch (postError) {
        logger.warn('counter_trade.exit_room_post_failed', {
          roomId: params.roomId,
          postRoomId: params.chatPostRoomId,
          senderAddress: params.senderAddress,
          pair: exitPair,
          message: postError instanceof Error ? postError.message : String(postError),
        })
      }
    }

    return { handled: true, executedDelta: 1, skippedDelta: 0, failedDelta: 0 }
  }

  await recordExitOutcome('failed', `exit_failed:${String(closeResult.message ?? 'arena_close_failed')}`)
  logger.warn('counter_trade.exit_execution_failed', {
    roomId: params.roomId,
    senderAddress: params.senderAddress,
    eventKey: params.eventKey,
    pair: exitPair,
      strategy: params.strategyKey,
      subaccount: params.strategySubaccount,
    reason: closeResult.message,
  })
  return { handled: true, executedDelta: 0, skippedDelta: 0, failedDelta: 1 }
}
