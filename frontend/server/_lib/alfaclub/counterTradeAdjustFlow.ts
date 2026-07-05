import type { ArenaConfig } from '../arena/arenaConfig.js'
import { runArenaTrade } from '../arena/arenaClient.js'
import { logger } from '../infra/logger.js'
import type { CounterTradeFillAction } from './counterTradeEngine.js'
import { findCounterPositionForCoin } from './counterTradeEngine.js'
import { postCounterTradeMirrorReduceRoomUpdate } from './counterTradeRoomPosting.js'
import { COUNTER_TRADE_MIRROR_REDUCE_EXECUTED_REASON, recordCounterTradeAction } from './counterTradeStore.js'
import { getClearinghouseState, type HyperliquidUserFillDetailed } from './hyperliquid.js'

export type CounterTradeAdjustFlowResult = {
  executedDelta: number
  failedDelta: number
  resolvedReduceNotionalUsd: number | null
}

export async function executeCounterTradeMirrorReduceFlow(params: {
  roomId: string
  senderAddress: string
  eventKey: string
  pair: string
  fill: HyperliquidUserFillDetailed
  fillAction: CounterTradeFillAction
  counterSide: 'long' | 'short'
  reduceNotionalUsd: number
  fullClose: boolean
  mirrorPositionChangePct?: number | null
  chatPostEnabled: boolean
  chatPostRoomId: string
  identityConfig: ArenaConfig
  strategyKey: string
  strategySubaccount: string | null
}): Promise<CounterTradeAdjustFlowResult> {
  const executionConfig: ArenaConfig = {
    ...params.identityConfig,
    hlSubaccountAddress: params.strategySubaccount,
  }
  const tradeResult = await runArenaTrade(
    {
      action: 'close',
      pair: params.pair,
      ...(params.fullClose ? {} : { sizeUsd: params.reduceNotionalUsd }),
      strategyKey: params.strategyKey,
      subaccountAddress: params.strategySubaccount ?? undefined,
    },
    executionConfig,
  )

  if (tradeResult.ok) {
    let resolvedReduceNotionalUsd = params.reduceNotionalUsd
    const counterStateAddress = params.strategySubaccount ?? params.identityConfig.agentWalletAddress
    let remainingPositionValueUsd: number | null = null
    if (counterStateAddress) {
      try {
        const postTradeState = await getClearinghouseState(counterStateAddress)
        const postTradePosition = findCounterPositionForCoin(postTradeState, params.pair)
        remainingPositionValueUsd = postTradePosition?.positionValue ?? 0
        if (params.fullClose || remainingPositionValueUsd <= 0) {
          resolvedReduceNotionalUsd = params.reduceNotionalUsd
        } else if (remainingPositionValueUsd != null) {
          resolvedReduceNotionalUsd = Math.max(0, params.reduceNotionalUsd)
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
      reason: COUNTER_TRADE_MIRROR_REDUCE_EXECUTED_REASON,
      counterSide: params.counterSide,
      counterNotionalUsd: resolvedReduceNotionalUsd,
      counterLeverage: null,
    })
    logger.info('counter_trade.mirror_reduce_submitted', {
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      pair: params.pair,
      strategy: params.strategyKey,
      subaccount: params.strategySubaccount,
      counterSide: params.counterSide,
      reduceNotionalUsd: resolvedReduceNotionalUsd,
      fullClose: params.fullClose,
      remainingPositionValueUsd,
    })

    if (params.chatPostEnabled) {
      try {
        await postCounterTradeMirrorReduceRoomUpdate({
          runtimeRoomId: params.roomId,
          postRoomId: params.chatPostRoomId,
          pair: params.pair,
          userFill: params.fill,
          fillAction: params.fillAction,
          counterSide: params.counterSide,
          reduceNotionalUsd: resolvedReduceNotionalUsd,
          fullClose: params.fullClose,
          remainingPositionValueUsd,
          mirrorPositionChangePct: params.mirrorPositionChangePct ?? null,
        })
      } catch (postError) {
        logger.warn('counter_trade.mirror_reduce_post_failed', {
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
      resolvedReduceNotionalUsd,
    }
  }

  await recordCounterTradeAction({
    roomId: params.roomId,
    senderAddress: params.senderAddress,
    eventKey: params.eventKey,
    status: 'failed',
    reason: String(tradeResult.message ?? 'arena_mirror_reduce_failed'),
    counterSide: params.counterSide,
    counterNotionalUsd: params.reduceNotionalUsd,
    counterLeverage: null,
  })
  logger.warn('counter_trade.mirror_reduce_failed', {
    roomId: params.roomId,
    senderAddress: params.senderAddress,
    eventKey: params.eventKey,
    pair: params.pair,
    strategy: params.strategyKey,
    subaccount: params.strategySubaccount,
    reason: tradeResult.message,
  })

  return {
    executedDelta: 0,
    failedDelta: 1,
    resolvedReduceNotionalUsd: null,
  }
}
