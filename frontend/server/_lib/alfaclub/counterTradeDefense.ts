/**
 * Liquidation defense + profit recycling for the counter-trade bot wallet.
 *
 * The bot and the countered user hold opposite legs in separate wallets
 * ("silos"). dgclaw opens everything in cross margin, so each silo's free
 * USDC automatically backs its positions — the buffer IS the liquidation
 * defense. There are no cross-wallet transfers; each silo defends itself:
 *
 * - defend_reduce: when a leg's liquidation distance falls to/below the
 *   defend threshold, partially close it (reduce-only). This shrinks notional
 *   and maintenance margin while equity stays put, pushing the liquidation
 *   price away and returning margin to the silo's buffer.
 * - harvest_take_profit: when a leg's unrealized PnL exceeds the trigger ROI
 *   (vs its margin), partially realize it. That converts paper profit into
 *   banked USDC inside the same silo — the buffer that will defend this
 *   wallet when the market turns and this side becomes the loser.
 *
 * Decisions are pure (deriveCounterTradeDefenseActions); execution goes
 * through the same arena close lane as mirrored exits, with partial sizing.
 */
import { logger } from '../infra/logger.js'
import type { ArenaConfig } from '../arena/arenaConfig.js'
import { runArenaTrade } from '../arena/arenaClient.js'
import { sendAlfaClubRoomText } from './chatBridge.js'
import type { HyperliquidClearinghouseState } from './hyperliquid.js'
import type { CounterTradeRuntimeConfig, CounterTradeSide } from './counterTradeConfig.js'
import { isAssetAllowlisted } from '../arena/arenaPairPolicy.js'
import { computeLegLiqDistancePct, type CounterWalletPositionLeg } from './counterTradeEngine.js'
import {
  COUNTER_TRADE_DEFENSE_ALERT_REASON,
  COUNTER_TRADE_DEFENSE_EXECUTED_REASON,
  COUNTER_TRADE_HARVEST_ALERT_REASON,
  COUNTER_TRADE_HARVEST_EXECUTED_REASON,
  recordCounterTradeAction,
} from './counterTradeStore.js'

export type CounterTradeDefenseActionType = 'defend_reduce' | 'harvest_take_profit'

/**
 * How a defense pass acts on its decisions:
 * - execute: place reduce-only closes via the arena trade lane.
 * - alert: post a warning card in the room instead of trading — used for the
 *   user silo while the account is custodied (e.g. an AlfaClub room wallet)
 *   and no approved HL API-wallet key exists yet.
 */
export type CounterTradeDefenseMode = 'execute' | 'alert'

/**
 * Which wallet the defense pass is protecting: the bot's Arena agent wallet
 * or the countered user's own wallet (when an approved HL API-wallet key for
 * that account is configured). Same rules, separate silos.
 */
export type CounterTradeDefenseSilo = 'bot' | 'user'

export type CounterTradeDefenseAction = {
  type: CounterTradeDefenseActionType
  coin: string
  side: CounterTradeSide
  /** USD notional to shave off the leg (ignored when fullClose). */
  reduceNotionalUsd: number
  /** True when the remaining leg would be dust — close it entirely instead. */
  fullClose: boolean
  positionValueUsd: number
  liqDistancePct: number | null
  unrealizedRoiPct: number | null
}

export type CounterTradeDefenseRunOutcome = {
  executed: number
  failed: number
  /** Alert-mode warnings posted this tick (no orders placed). */
  alerted: number
  /** Coins whose legs were fully closed by defense this tick. */
  fullyClosedCoins: string[]
}

/**
 * Alert-mode anti-spam: remember when each (silo, coin, action-type) leg was
 * last alerted so a 2-minute tick does not repost the same warning. The
 * runtime is a single long-lived Railway process, so in-memory is enough; a
 * restart re-alerts once, which is acceptable for a risk warning.
 */
const lastAlertAtMsByKey = new Map<string, number>()

export const DEFENSE_ALERT_COOLDOWN_MS = 30 * 60 * 1000

export function __resetDefenseAlertStateForTests(): void {
  lastAlertAtMsByKey.clear()
}

/** Free-collateral share of account equity (withdrawable / accountValue). */
export function computeBufferRatio(state: HyperliquidClearinghouseState | null): number | null {
  const accountValue = state?.accountValueUsd
  const withdrawable = state?.withdrawableUsd
  if (accountValue == null || !Number.isFinite(accountValue) || accountValue <= 0) return null
  if (withdrawable == null || !Number.isFinite(withdrawable)) return null
  return Math.max(0, Math.min(1, withdrawable / accountValue))
}

function computeLegRoiPct(leg: CounterWalletPositionLeg): number | null {
  if (leg.positionValue == null || leg.positionValue <= 0) return null
  if (leg.unrealizedPnl == null || !Number.isFinite(leg.unrealizedPnl)) return null
  const leverage =
    leg.leverage != null && Number.isFinite(leg.leverage) && leg.leverage >= 1 ? leg.leverage : 1
  const marginUsd = leg.positionValue / leverage
  if (!Number.isFinite(marginUsd) || marginUsd <= 0) return null
  return (leg.unrealizedPnl / marginUsd) * 100
}

function clampReduce(params: {
  targetUsd: number
  positionValueUsd: number
  minReduceNotionalUsd: number
}): { reduceNotionalUsd: number; fullClose: boolean } | null {
  const { targetUsd, positionValueUsd, minReduceNotionalUsd } = params
  if (!Number.isFinite(targetUsd) || targetUsd <= 0) return null
  // Tiny leg: a compliant partial would leave dust (or be below HL's minimum
  // order) — close the whole thing instead.
  if (positionValueUsd <= minReduceNotionalUsd * 2) {
    return { reduceNotionalUsd: positionValueUsd, fullClose: true }
  }
  const floored = Math.max(targetUsd, minReduceNotionalUsd)
  if (floored >= positionValueUsd) {
    return { reduceNotionalUsd: positionValueUsd, fullClose: true }
  }
  return { reduceNotionalUsd: floored, fullClose: false }
}

/**
 * Pure decision pass over the bot wallet's open legs. Returns at most
 * `maxDefenseActionsPerTick` actions: urgent defends first (closest to
 * liquidation), then harvests (highest ROI first).
 */
export function deriveCounterTradeDefenseActions(params: {
  state: HyperliquidClearinghouseState | null
  runtime: CounterTradeRuntimeConfig
  assetAllowlist?: Set<string> | null
}): CounterTradeDefenseAction[] {
  const { state, runtime } = params
  if (!runtime.defenseEnabled) return []

  const defends: CounterTradeDefenseAction[] = []
  const harvests: CounterTradeDefenseAction[] = []

  for (const leg of state?.assetPositions ?? []) {
    if (leg.side !== 'long' && leg.side !== 'short') continue
    if (leg.positionValue == null || !Number.isFinite(leg.positionValue) || leg.positionValue <= 0) continue
    const coin = String(leg.coin ?? '').trim()
    if (!coin) continue
    if (!isAssetAllowlisted(coin, params.assetAllowlist)) continue

    const liqDistancePct = computeLegLiqDistancePct(leg)
    const unrealizedRoiPct = computeLegRoiPct(leg)

    if (liqDistancePct != null && liqDistancePct <= runtime.defendLiqDistancePct) {
      // Escalate when already inside half the defend threshold: shave twice
      // as much (capped) so a fast move gets a meaningful response per tick.
      const escalated = liqDistancePct <= runtime.defendLiqDistancePct / 2
      const fraction = Math.min(0.5, runtime.defendReduceFraction * (escalated ? 2 : 1))
      const clamped = clampReduce({
        targetUsd: leg.positionValue * fraction,
        positionValueUsd: leg.positionValue,
        minReduceNotionalUsd: runtime.minReduceNotionalUsd,
      })
      if (clamped) {
        defends.push({
          type: 'defend_reduce',
          coin,
          side: leg.side,
          reduceNotionalUsd: clamped.reduceNotionalUsd,
          fullClose: clamped.fullClose,
          positionValueUsd: leg.positionValue,
          liqDistancePct,
          unrealizedRoiPct,
        })
      }
      continue
    }

    if (
      unrealizedRoiPct != null &&
      unrealizedRoiPct >= runtime.harvestTriggerRoiPct &&
      (leg.unrealizedPnl ?? 0) > 0
    ) {
      const clamped = clampReduce({
        targetUsd: leg.positionValue * runtime.harvestFraction,
        positionValueUsd: leg.positionValue,
        minReduceNotionalUsd: runtime.minReduceNotionalUsd,
      })
      // Harvest never full-closes a healthy winner: keep the leg (and the
      // hedge) on; the exit mirror owns full closes.
      if (clamped && !clamped.fullClose) {
        harvests.push({
          type: 'harvest_take_profit',
          coin,
          side: leg.side,
          reduceNotionalUsd: clamped.reduceNotionalUsd,
          fullClose: false,
          positionValueUsd: leg.positionValue,
          liqDistancePct,
          unrealizedRoiPct,
        })
      }
    }
  }

  defends.sort((a, b) => (a.liqDistancePct ?? Infinity) - (b.liqDistancePct ?? Infinity))
  harvests.sort((a, b) => (b.unrealizedRoiPct ?? -Infinity) - (a.unrealizedRoiPct ?? -Infinity))
  return [...defends, ...harvests].slice(0, Math.max(1, runtime.maxDefenseActionsPerTick))
}

export function formatDefenseRoomPost(params: {
  action: CounterTradeDefenseAction
  bufferRatio: number | null
  silo?: CounterTradeDefenseSilo
}): string {
  const { action, bufferRatio } = params
  const siloTag = params.silo === 'user' ? ' (user silo)' : ''
  const sideLabel = action.side === 'long' ? 'Long' : 'Short'
  const lines: string[] = []
  if (action.type === 'defend_reduce') {
    lines.push(
      action.fullClose
        ? `🛡️ Defense${siloTag}: closed ${sideLabel} ${action.coin} (~$${action.positionValueUsd.toFixed(2)}) — too close to liquidation`
        : `🛡️ Defense${siloTag}: reduced ${sideLabel} ${action.coin} by ~$${action.reduceNotionalUsd.toFixed(2)} of $${action.positionValueUsd.toFixed(2)}`,
    )
    if (action.liqDistancePct != null) {
      lines.push(`Liq distance ${action.liqDistancePct.toFixed(1)}% → margin released to buffer`)
    }
  } else {
    lines.push(
      `🌾 Harvest${siloTag}: took ~$${action.reduceNotionalUsd.toFixed(2)} off winning ${sideLabel} ${action.coin}`,
    )
    if (action.unrealizedRoiPct != null) {
      lines.push(`Unrealized ROI ${action.unrealizedRoiPct >= 0 ? '+' : ''}${action.unrealizedRoiPct.toFixed(0)}% → profit banked to buffer`)
    }
  }
  if (bufferRatio != null) {
    lines.push(`Silo buffer ${(bufferRatio * 100).toFixed(0)}% of equity`)
  }
  return lines.join('\n')
}

/**
 * Advisory card for alert mode: the same trigger fired, but the silo's
 * account is custodied so the bot cannot place the reduce itself.
 */
export function formatDefenseAlertPost(params: {
  action: CounterTradeDefenseAction
  bufferRatio: number | null
  silo?: CounterTradeDefenseSilo
}): string {
  const { action, bufferRatio } = params
  const siloTag = params.silo === 'user' ? ' (user silo)' : ''
  const sideLabel = action.side === 'long' ? 'Long' : 'Short'
  const lines: string[] = []
  if (action.type === 'defend_reduce') {
    lines.push(
      `⚠️ Defense alert${siloTag}: ${sideLabel} ${action.coin} is ${
        action.liqDistancePct != null ? `${action.liqDistancePct.toFixed(1)}% ` : ''
      }from liquidation`,
    )
    lines.push(
      action.fullClose
        ? `Suggested: close the leg (~$${action.positionValueUsd.toFixed(2)}) — too small to partially reduce`
        : `Suggested: reduce ~$${action.reduceNotionalUsd.toFixed(2)} of $${action.positionValueUsd.toFixed(2)} to release margin`,
    )
  } else {
    lines.push(
      `🌾 Harvest alert${siloTag}: ${sideLabel} ${action.coin} is up ${
        action.unrealizedRoiPct != null
          ? `${action.unrealizedRoiPct >= 0 ? '+' : ''}${action.unrealizedRoiPct.toFixed(0)}% ROI`
          : 'strongly'
      }`,
    )
    lines.push(
      `Suggested: take ~$${action.reduceNotionalUsd.toFixed(2)} off to bank profit into the buffer`,
    )
  }
  if (bufferRatio != null) {
    lines.push(`Silo buffer ${(bufferRatio * 100).toFixed(0)}% of equity`)
  }
  return lines.join('\n')
}

/**
 * Execute defense/harvest actions for one identity. Each action is a
 * (partial) reduce-only close on the bot wallet, recorded in the action
 * ledger under a risk-reducing reason (never counted as an entry).
 *
 * In `alert` mode no orders are placed: each triggered action posts an
 * advisory card instead (deduped per silo/coin/type for
 * DEFENSE_ALERT_COOLDOWN_MS) and is ledgered as `skipped`.
 */
export async function runCounterTradeDefenseForIdentity(params: {
  runtime: CounterTradeRuntimeConfig
  senderAddress: string
  identityConfig: ArenaConfig
  counterWalletState: HyperliquidClearinghouseState | null
  silo?: CounterTradeDefenseSilo
  mode?: CounterTradeDefenseMode
  nowMs?: number
  assetAllowlist?: Set<string> | null
}): Promise<CounterTradeDefenseRunOutcome> {
  const { runtime, senderAddress, identityConfig, counterWalletState } = params
  const silo: CounterTradeDefenseSilo = params.silo ?? 'bot'
  const mode: CounterTradeDefenseMode = params.mode ?? 'execute'
  const outcome: CounterTradeDefenseRunOutcome = {
    executed: 0,
    failed: 0,
    alerted: 0,
    fullyClosedCoins: [],
  }
  if (!runtime.defenseEnabled) return outcome

  const actions = deriveCounterTradeDefenseActions({
    state: counterWalletState,
    runtime,
    assetAllowlist: params.assetAllowlist,
  })
  if (actions.length === 0) return outcome

  const bufferRatio = computeBufferRatio(counterWalletState)
  const tickMs = params.nowMs ?? Date.now()

  for (const action of actions) {
    if (mode === 'alert') {
      const alertKey = [silo, action.coin.toUpperCase(), action.type].join('|')
      const lastAlertAtMs = lastAlertAtMsByKey.get(alertKey) ?? 0
      if (tickMs - lastAlertAtMs < DEFENSE_ALERT_COOLDOWN_MS) continue
      lastAlertAtMsByKey.set(alertKey, tickMs)

      logger.info('counter_trade.defense_alert', {
        roomId: runtime.roomId,
        senderAddress,
        silo,
        type: action.type,
        coin: action.coin,
        side: action.side,
        reduceNotionalUsd: action.reduceNotionalUsd,
        fullClose: action.fullClose,
        positionValueUsd: action.positionValueUsd,
        liqDistancePct: action.liqDistancePct,
        unrealizedRoiPct: action.unrealizedRoiPct,
        bufferRatio,
      })

      await recordCounterTradeAction({
        roomId: runtime.roomId,
        senderAddress,
        eventKey: ['defense-alert', silo, action.coin.toUpperCase(), action.type, String(tickMs)].join('|'),
        status: 'skipped',
        reason:
          action.type === 'defend_reduce'
            ? COUNTER_TRADE_DEFENSE_ALERT_REASON
            : COUNTER_TRADE_HARVEST_ALERT_REASON,
        counterSide: action.side,
        counterNotionalUsd: action.reduceNotionalUsd,
        counterLeverage: null,
      })

      if (runtime.chatPostEnabled) {
        try {
          await sendAlfaClubRoomText({
            roomId: runtime.chatPostRoomId,
            text: formatDefenseAlertPost({ action, bufferRatio, silo }),
          })
        } catch (postError) {
          logger.warn('counter_trade.defense_room_post_failed', {
            roomId: runtime.roomId,
            postRoomId: runtime.chatPostRoomId,
            coin: action.coin,
            message: postError instanceof Error ? postError.message : String(postError),
          })
        }
      }
      outcome.alerted += 1
      continue
    }

    const reason =
      action.type === 'defend_reduce'
        ? COUNTER_TRADE_DEFENSE_EXECUTED_REASON
        : COUNTER_TRADE_HARVEST_EXECUTED_REASON
    const eventKey = ['defense', silo, action.coin.toUpperCase(), action.type, String(tickMs)].join('|')

    const tradeResult = await runArenaTrade(
      {
        action: 'close',
        pair: action.coin,
        ...(action.fullClose ? {} : { sizeUsd: action.reduceNotionalUsd }),
      },
      identityConfig,
    )

    logger.info('counter_trade.defense', {
      roomId: runtime.roomId,
      senderAddress,
      silo,
      type: action.type,
      coin: action.coin,
      side: action.side,
      reduceNotionalUsd: action.reduceNotionalUsd,
      fullClose: action.fullClose,
      positionValueUsd: action.positionValueUsd,
      liqDistancePct: action.liqDistancePct,
      unrealizedRoiPct: action.unrealizedRoiPct,
      bufferRatio,
      ok: tradeResult.ok,
    })

    await recordCounterTradeAction({
      roomId: runtime.roomId,
      senderAddress,
      eventKey,
      status: tradeResult.ok ? 'executed' : 'failed',
      reason: tradeResult.ok
        ? reason
        : `${reason}_failed:${String(tradeResult.message ?? 'arena_close_failed')}`,
      counterSide: action.side,
      counterNotionalUsd: action.reduceNotionalUsd,
      counterLeverage: null,
    })

    if (!tradeResult.ok) {
      outcome.failed += 1
      logger.warn('counter_trade.defense_execution_failed', {
        roomId: runtime.roomId,
        senderAddress,
        silo,
        type: action.type,
        coin: action.coin,
        reason: tradeResult.message,
      })
      continue
    }

    outcome.executed += 1
    if (action.fullClose) outcome.fullyClosedCoins.push(action.coin.toUpperCase())

    if (runtime.chatPostEnabled) {
      try {
        await sendAlfaClubRoomText({
          roomId: runtime.chatPostRoomId,
          text: formatDefenseRoomPost({ action, bufferRatio, silo }),
        })
      } catch (postError) {
        logger.warn('counter_trade.defense_room_post_failed', {
          roomId: runtime.roomId,
          postRoomId: runtime.chatPostRoomId,
          coin: action.coin,
          message: postError instanceof Error ? postError.message : String(postError),
        })
      }
    }
  }

  return outcome
}
