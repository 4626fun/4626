import type { ArenaConfig } from '../arena/arenaConfig.js'
import { runArenaTrade } from '../arena/arenaClient.js'
import { logger } from '../infra/logger.js'
import { type CounterTradeFillAction, findCounterPositionForCoin } from './counterTradeEngine.js'
import { findCoinLeverageFromState } from './counterTradeLeverage.js'
import { postCounterTradeRoomUpdate, postCounterTradeMonitorAlert } from './counterTradeRoomPosting.js'
import { recordCounterTradeAction } from './counterTradeStore.js'
import {
  getClearinghouseState,
  type HyperliquidUserFillDetailed,
} from './hyperliquid.js'

export type CounterTradeEntryFlowResult = {
  executedDelta: number
  failedDelta: number
  resolvedCounterNotionalUsd: number | null
}

export async function executeCounterTradeEntryFlow(params: {
  roomId: string
  senderAddress: string
  eventKey: string
  pair: string
  fill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  counterSide: 'long' | 'short'
  counterLeverage: number
  counterNotionalUsd: number
  userLeverage: number | null
  chatPostEnabled: boolean
  chatPostRoomId: string
  identityConfig: ArenaConfig
  strategyKey: string
  strategySubaccount: string | null
}): Promise<CounterTradeEntryFlowResult> {
  const executionConfig: ArenaConfig = {
    ...params.identityConfig,
    hlSubaccountAddress: params.strategySubaccount,
  }
  const tradeResult = await runArenaTrade(
    {
      action: 'open',
      pair: params.pair,
      side: params.counterSide,
      sizeUsd: params.counterNotionalUsd,
      leverage: params.counterLeverage,
      strategyKey: params.strategyKey,
      subaccountAddress: params.strategySubaccount ?? undefined,
    },
    executionConfig,
  )

  if (tradeResult.ok) {
    let resolvedCounterNotionalUsd = params.counterNotionalUsd
    let resolvedCounterLeverage = params.counterLeverage
    const counterStateAddress = params.strategySubaccount ?? params.identityConfig.agentWalletAddress
    if (counterStateAddress) {
      try {
        const postTradeState = await getClearinghouseState(counterStateAddress)
        const postTradePosition = findCounterPositionForCoin(postTradeState, params.pair)
        const postTradeLeverage = findCoinLeverageFromState(postTradeState, params.pair)
        if (postTradePosition?.positionValue != null && Number.isFinite(postTradePosition.positionValue)) {
          resolvedCounterNotionalUsd = postTradePosition.positionValue
        }
        if (postTradeLeverage != null && Number.isFinite(postTradeLeverage)) {
          resolvedCounterLeverage = postTradeLeverage
        }
      } catch {
        // Best effort: fall back to intended execution values.
      }
    }

    await recordCounterTradeAction({
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      eventKey: params.eventKey,
      status: 'executed',
      reason: 'executed',
      counterSide: params.counterSide,
      counterNotionalUsd: resolvedCounterNotionalUsd,
      counterLeverage: resolvedCounterLeverage,
    })
    logger.info('counter_trade.execution_submitted', {
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      pair: params.pair,
      strategy: params.strategyKey,
      subaccount: params.strategySubaccount,
      counterSide: params.counterSide,
      counterLeverage: resolvedCounterLeverage,
      counterNotionalUsd: resolvedCounterNotionalUsd,
    })

    if (params.chatPostEnabled) {
      try {
        await postCounterTradeRoomUpdate({
          runtimeRoomId: params.roomId,
          postRoomId: params.chatPostRoomId,
          pair: params.pair,
          userFill: params.fill,
          fillAction: params.fillAction,
          counterSide: params.counterSide,
          counterLeverage: resolvedCounterLeverage,
          counterNotionalUsd: resolvedCounterNotionalUsd,
          userLeverage: params.userLeverage,
        })
      } catch (postError) {
        logger.warn('counter_trade.room_post_failed', {
          roomId: params.roomId,
          postRoomId: params.chatPostRoomId,
          senderAddress: params.senderAddress,
          pair: params.pair,
          message: postError instanceof Error ? postError.message : String(postError),
        })
      }
    }

    return {
      executedDelta: 1,
      failedDelta: 0,
      resolvedCounterNotionalUsd,
    }
  }

  await recordCounterTradeAction({
    roomId: params.roomId,
    senderAddress: params.senderAddress,
    eventKey: params.eventKey,
    status: 'failed',
    reason: String(tradeResult.message ?? 'arena_trade_failed'),
    counterSide: params.counterSide,
    counterNotionalUsd: params.counterNotionalUsd,
    counterLeverage: params.counterLeverage,
  })
  logger.warn('counter_trade.execution_failed', {
    roomId: params.roomId,
    senderAddress: params.senderAddress,
    eventKey: params.eventKey,
    pair: params.pair,
      strategy: params.strategyKey,
      subaccount: params.strategySubaccount,
    reason: tradeResult.message,
  })
  if (params.chatPostEnabled) {
    try {
      await postCounterTradeMonitorAlert({
        runtimeRoomId: params.roomId,
        postRoomId: params.chatPostRoomId,
        kind: 'failed',
        reason: String(tradeResult.message ?? 'arena_trade_failed'),
        pair: params.pair,
      })
    } catch (postError) {
      logger.warn('counter_trade.monitor_alert_failed', {
        roomId: params.roomId,
        reason: 'execution_failed',
        message: postError instanceof Error ? postError.message : String(postError),
      })
    }
  }
  return {
    executedDelta: 0,
    failedDelta: 1,
    resolvedCounterNotionalUsd: null,
  }
}
