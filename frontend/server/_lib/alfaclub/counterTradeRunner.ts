import { logger } from '../infra/logger.js'
import { readArenaConfig } from '../arena/arenaConfig.js'
import { resolveArenaIdentityForContext } from '../arena/arenaIdentityMappingStore.js'
import { runArenaSpotPerpTransfer } from '../arena/arenaClient.js'
import { sendAlfaClubRoomText } from './chatBridge.js'
import { executeCounterTradeEntryFlow } from './counterTradeEntryFlow.js'
import {
  getClearinghouseState,
  getSpotUsdcBalance,
  getUserFillsByTimeDetailed,
  type HyperliquidClearinghouseState,
} from './hyperliquid.js'
import { resolveRoom1659HyperliquidUserForSnapshot } from './room1659Market.js'
import { readCounterTradeRuntimeConfig } from './counterTradeConfig.js'
import { applyCounterTradeLlmGate } from './counterTradeLlmAdvisor.js'
import { handleCounterTradeExitFlow } from './counterTradeExitFlow.js'
import {
  classifyCounterTradeFillAction,
  deriveCounterTradeDecision,
  deriveEventKeyFromFill,
  deriveUserLeverage,
  deriveUserNotional,
  deriveUserSide,
  isExitFillAction,
} from './counterTradeEngine.js'
import {
  formatSpotSweepRoomPost,
} from './counterTradeRoomPosting.js'
import { computeBufferRatio, runCounterTradeDefenseForIdentity } from './counterTradeDefense.js'
import {
  enforceSingleActiveCounterTradeActor,
  listActiveCounterTradeOptIns,
  readOrCreateCounterTradeRoomStrategy,
  recordCounterTradeAction,
  registerCounterTradeEventIfNew,
} from './counterTradeStore.js'
import { initCounterTradeUsageState } from './counterTradeUsageState.js'

export type CounterTradeRunResult = {
  ok: boolean
  reason?: string
  roomId: string
  scannedIdentities: number
  scannedEvents: number
  newEvents: number
  executed: number
  skipped: number
  blocked: number
  failed: number
}

declare const process: { env: Record<string, string | undefined> }

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function computeCounterTradeCooldownRemainingMs(params: {
  lastExecutedAtMs: number | null
  cooldownMs: number
  nowMs?: number
}): number {
  if (params.lastExecutedAtMs == null) return 0
  const nowMs = params.nowMs ?? Date.now()
  const elapsedMs = Math.max(0, nowMs - params.lastExecutedAtMs)
  return Math.max(0, params.cooldownMs - elapsedMs)
}

function isEnabledByEnv(): boolean {
  const raw = String(process.env.ALFACLUB_COUNTER_TRADE_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export function resolveCounterTradeFillSourceWallet(params: {
  roomId: string
  senderAddress: string
  identityHlApiWalletAddress: string | null
}): string {
  if (params.roomId === '1659') {
    return resolveRoom1659HyperliquidUserForSnapshot(params.senderAddress)
  }
  return params.identityHlApiWalletAddress ?? params.senderAddress
}

function findCoinLeverageFromState(
  state: HyperliquidClearinghouseState | null,
  coin: string | null | undefined,
): number | null {
  const target = String(coin ?? '').trim().toUpperCase()
  if (!target) return null
  for (const leg of state?.assetPositions ?? []) {
    if (String(leg.coin ?? '').trim().toUpperCase() !== target) continue
    if (leg.leverage == null || !Number.isFinite(leg.leverage) || leg.leverage <= 0) continue
    return leg.leverage
  }
  return null
}

export async function runCounterTradeLoop(): Promise<CounterTradeRunResult> {
  const runtime = readCounterTradeRuntimeConfig()
  if (!runtime.enabled || !isEnabledByEnv()) {
    return {
      ok: false,
      reason: 'disabled',
      roomId: runtime.roomId,
      scannedIdentities: 0,
      scannedEvents: 0,
      newEvents: 0,
      executed: 0,
      skipped: 0,
      blocked: 0,
      failed: 0,
    }
  }

  const roomStrategy = await readOrCreateCounterTradeRoomStrategy(runtime.roomId)
  if (!roomStrategy?.enabled || roomStrategy.killSwitch) {
    return {
      ok: false,
      reason: roomStrategy?.killSwitch ? 'kill_switch' : 'room_disabled',
      roomId: runtime.roomId,
      scannedIdentities: 0,
      scannedEvents: 0,
      newEvents: 0,
      executed: 0,
      skipped: 0,
      blocked: 0,
      failed: 0,
    }
  }

  const activeOptIns = await listActiveCounterTradeOptIns({ roomId: runtime.roomId, limit: 300 })
  const strategyActors =
    runtime.roomId === '1659' && activeOptIns.length > 1 ? [activeOptIns[0]] : activeOptIns
  if (runtime.roomId === '1659' && activeOptIns.length > 1 && activeOptIns[0]?.senderAddress) {
    const cleanup = await enforceSingleActiveCounterTradeActor({
      roomId: runtime.roomId,
      survivorSenderAddress: activeOptIns[0].senderAddress,
      pauseReason: 'room1659_single_actor_enforced',
    })
    if (cleanup?.pausedSenderAddresses.length) {
      logger.warn('counter_trade.room1659_multiple_active_optins', {
        roomId: runtime.roomId,
        activeCount: activeOptIns.length,
        selectedSenderAddress: cleanup.survivorSenderAddress,
        pausedSenderAddresses: cleanup.pausedSenderAddresses,
      })
    }
  }
  if (strategyActors.length === 0) {
    return {
      ok: true,
      roomId: runtime.roomId,
      scannedIdentities: 0,
      scannedEvents: 0,
      newEvents: 0,
      executed: 0,
      skipped: 0,
      blocked: 0,
      failed: 0,
    }
  }

  const baseArenaConfig = readArenaConfig()
  const startTimeMs = Date.now() - runtime.eventLookbackMs
  let scannedEvents = 0
  let newEvents = 0
  let executed = 0
  let skipped = 0
  let blocked = 0
  let failed = 0
  // One sweep attempt per bot wallet per tick, even when several actors share
  // the same agent wallet.
  const spotSweepAttempted = new Set<string>()

  for (const optIn of strategyActors) {
    try {
      const identity = await resolveArenaIdentityForContext({
        roomId: runtime.roomId,
        senderAddress: optIn.senderAddress,
        baseConfig: baseArenaConfig,
      })

      const userWalletForFills = resolveCounterTradeFillSourceWallet({
        roomId: runtime.roomId,
        senderAddress: optIn.senderAddress,
        identityHlApiWalletAddress: identity.hlApiWalletAddress,
      })
      if (
        runtime.roomId === '1659' &&
        identity.hlApiWalletAddress &&
        identity.hlApiWalletAddress.toLowerCase() !== userWalletForFills.toLowerCase()
      ) {
        logger.info('counter_trade.room_wallet_override', {
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          mappedHlApiWalletAddress: identity.hlApiWalletAddress,
          overriddenFillSourceWallet: userWalletForFills,
        })
      }

      const fills = await getUserFillsByTimeDetailed(userWalletForFills, startTimeMs)
      const userWalletState = await getClearinghouseState(userWalletForFills)

      const counterWalletState =
        identity.agentWalletAddress != null ? await getClearinghouseState(identity.agentWalletAddress) : null

      const identityConfig = {
        ...baseArenaConfig,
        agentId: identity.agentId,
        agentWalletAddress: identity.agentWalletAddress,
        hlApiWalletAddress: identity.hlApiWalletAddress,
      }

      // Spot -> perps margin sweep: deposits sent as Hyperliquid spot
      // transfers land in the bot wallet's SPOT balance, where they cannot
      // back perps positions. Move them into the perps clearinghouse so the
      // counter orders have margin. ACP-signed, bot wallet only.
      if (runtime.spotSweepEnabled && identity.agentWalletAddress) {
        const sweepWallet = identity.agentWalletAddress.toLowerCase()
        if (!spotSweepAttempted.has(sweepWallet)) {
          spotSweepAttempted.add(sweepWallet)
          try {
            const spotUsdc = await getSpotUsdcBalance(sweepWallet)
            if (spotUsdc != null && spotUsdc >= runtime.spotSweepMinUsd) {
              const sweep = await runArenaSpotPerpTransfer({ amountUsd: spotUsdc }, identityConfig)
              logger.info('counter_trade.spot_sweep', {
                roomId: runtime.roomId,
                agentWalletAddress: sweepWallet,
                amountUsd: spotUsdc,
                ok: sweep.ok,
                message: sweep.message,
              })
              if (sweep.ok && runtime.chatPostEnabled) {
                try {
                  await sendAlfaClubRoomText({
                    roomId: runtime.chatPostRoomId,
                    text: formatSpotSweepRoomPost({
                      amountUsd: spotUsdc,
                      agentWalletAddress: sweepWallet,
                      dryRun: sweep.run?.dryRun === true,
                    }),
                  })
                } catch (postError) {
                  logger.warn('counter_trade.spot_sweep_post_failed', {
                    roomId: runtime.roomId,
                    agentWalletAddress: sweepWallet,
                    message: postError instanceof Error ? postError.message : String(postError),
                  })
                }
              }
            }
          } catch (sweepError) {
            logger.warn('counter_trade.spot_sweep_failed', {
              roomId: runtime.roomId,
              agentWalletAddress: sweepWallet,
              message: sweepError instanceof Error ? sweepError.message : String(sweepError),
            })
          }
        }
      }
      // counterWalletState is a single snapshot per tick, so track coins the
      // bot opened/closed during this tick to keep exit decisions coherent
      // when a user entry+exit pair lands inside one lookback window.
      const openedCoinsThisTick = new Set<string>()
      const closedCoinsThisTick = new Set<string>()

      // Liquidation defense + profit recycling runs every tick on the bot
      // wallet's own legs — independent of whether the user traded. Legs too
      // close to liquidation are partially reduced; legs deep in profit are
      // partially realized into the silo's USDC buffer.
      if (runtime.defenseEnabled && counterWalletState) {
        const defense = await runCounterTradeDefenseForIdentity({
          runtime,
          senderAddress: optIn.senderAddress,
          identityConfig,
          counterWalletState,
          silo: 'bot',
        })
        executed += defense.executed
        failed += defense.failed
        for (const coin of defense.fullyClosedCoins) closedCoinsThisTick.add(coin)
      }

      // User-silo defense: the same defend/harvest pass on the countered
      // user's own wallet. With an approved HL API-wallet key (trade only,
      // no withdrawals) it executes reduce-only closes; without one — e.g.
      // an AlfaClub-custodied room wallet awaiting delegation — it runs in
      // alert mode and posts advisory cards instead of trading. Partial
      // reduces on the user wallet land as `reduce` fills, which the mirror
      // ignores; a dust full-close lands as `close` and correctly triggers
      // the exit mirror on the next tick. Each silo still defends itself
      // with its own USDC — no transfers.
      if (runtime.defenseEnabled && runtime.userSiloDefenseEnabled) {
        const userSiloMaster = runtime.userSiloMasterAddress ?? userWalletForFills
        try {
          const userWalletState = await getClearinghouseState(userSiloMaster)
          if (userWalletState) {
            const userSiloKey = runtime.userSiloHlAgentPrivateKey
            const userDefense = await runCounterTradeDefenseForIdentity({
              runtime,
              senderAddress: optIn.senderAddress,
              identityConfig: {
                ...baseArenaConfig,
                agentId: null,
                agentWalletAddress: null,
                hlApiWalletAddress: null,
                hlAgentPrivateKey: userSiloKey,
                hlMasterAddressOverride: userSiloKey ? userSiloMaster : null,
              },
              counterWalletState: userWalletState,
              silo: 'user',
              mode: userSiloKey ? 'execute' : 'alert',
            })
            executed += userDefense.executed
            failed += userDefense.failed
          }
        } catch (userDefenseError) {
          logger.warn('counter_trade.user_silo_defense_failed', {
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            userSiloMaster,
            message:
              userDefenseError instanceof Error ? userDefenseError.message : String(userDefenseError),
          })
        }
      }

      if (!fills?.length) continue
      const sorted = [...fills].sort((a, b) => a.time - b.time).slice(-runtime.runLimitPerIdentity)
      let lastExecutedAtMs = parseIsoMs(optIn.lastActionAt)
      const bufferRatio = computeBufferRatio(counterWalletState)
      // Hot-path optimization: fetch usage windows once per actor/tick and keep
      // local counters in sync as this loop records entry executions.
      const usageState = await initCounterTradeUsageState({
        roomId: runtime.roomId,
        senderAddress: optIn.senderAddress,
        preset: optIn.preset,
        runtime,
      })

      for (const fill of sorted) {
        scannedEvents += 1
        const eventKey = deriveEventKeyFromFill({ walletAddress: userWalletForFills, fill })
        const userSide = deriveUserSide(fill)
        const userNotionalUsd = deriveUserNotional(fill)
        const isNewEvent = await registerCounterTradeEventIfNew({
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          eventKey,
          coin: fill.coin,
          userSide,
          userNotionalUsd,
          eventTimeMs: fill.time,
          rawEvent: fill as unknown as Record<string, unknown>,
        })
        if (!isNewEvent) continue
        newEvents += 1

        // Mirrored exits: when the countered user closes (or is liquidated out
        // of) a pair, close the bot's position on that pair. Risk-reducing, so
        // it runs before cooldown/hourly/daily gates and the LLM gate; dedupe
        // and the env/DB kill switches above still apply.
        const fillAction = classifyCounterTradeFillAction(fill)
        if (isExitFillAction(fillAction)) {
          const exitResult = await handleCounterTradeExitFlow({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            fill,
            fillAction,
            runtimeExitEnabled: runtime.exitEnabled,
            chatPostEnabled: runtime.chatPostEnabled,
            chatPostRoomId: runtime.chatPostRoomId,
            openedCoinsThisTick,
            closedCoinsThisTick,
            counterWalletState,
            identityConfig,
          })
          executed += exitResult.executedDelta
          skipped += exitResult.skippedDelta
          failed += exitResult.failedDelta
          continue
        }

        const nowMs = Date.now()
        const cooldownRemainingMs = computeCounterTradeCooldownRemainingMs({
          lastExecutedAtMs,
          cooldownMs: runtime.cooldownMs,
          nowMs,
        })
        if (cooldownRemainingMs > 0) {
          blocked += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'blocked',
            reason: 'cooldown_active',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        if (!usageState.canExecuteByHourlyCap()) {
          blocked += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'blocked',
            reason: 'hourly_cap_reached',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        // Buffer floor: keep a free-USDC reserve in the bot silo. In cross
        // margin that reserve is what extends liquidation distance on every
        // open leg, so new entries stop before the buffer is consumed.
        if (bufferRatio != null && bufferRatio < runtime.minBufferRatio) {
          blocked += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'blocked',
            reason: 'buffer_floor',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        const decision = deriveCounterTradeDecision({
          bias: roomStrategy.globalBias,
          preset: optIn.preset,
          fill,
          userNotionalUsd,
          userLeverage: deriveUserLeverage(fill) ?? findCoinLeverageFromState(userWalletState, fill.coin),
          runtime,
          counterWalletState,
        })

        if (!decision.ok) {
          skipped += 1
          const skipReason =
            decision.reason === 'fill_action_not_counterable' && decision.fillAction
              ? `fill_action_not_counterable:${decision.fillAction}`
              : decision.reason
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'skipped',
            reason: skipReason,
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        const remainingDailyNotional = usageState.remainingDailyNotionalUsd()
        if (remainingDailyNotional <= 0) {
          blocked += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'blocked',
            reason: 'daily_notional_cap_reached',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        const cappedCounterNotionalUsd = Math.min(decision.counterNotionalUsd, remainingDailyNotional)
        const pair = String(fill.coin ?? '').trim()
        if (!pair) {
          skipped += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'skipped',
            reason: 'missing_pair',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        // Optional LLM risk-review gate: it can veto or shrink the candidate
        // (never enlarge / flip / re-lever). Disabled or advisory by default;
        // see counterTradeLlmAdvisor.ts for the policy.
        const llmGate = await applyCounterTradeLlmGate({
          roomId: runtime.roomId,
          pair,
          fill,
          fillAction: decision.fillAction,
          bias: roomStrategy.globalBias,
          preset: optIn.preset,
          counterSide: decision.counterSide,
          counterLeverage: decision.counterLeverage,
          counterNotionalUsd: cappedCounterNotionalUsd,
          counterWalletState,
          hourlyExecutedCount: usageState.hourlyUsage.executedCount,
          hourlyCap: usageState.hourlyCap,
          dailyNotionalUsedUsd: usageState.dailyUsage.notionalUsd,
          dailyNotionalCapUsd: usageState.dailyCap,
        })
        if (!llmGate.proceed) {
          skipped += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'skipped',
            reason: llmGate.skipReason ?? 'llm_veto',
            counterSide: decision.counterSide,
            counterNotionalUsd: cappedCounterNotionalUsd,
            counterLeverage: decision.counterLeverage,
          })
          continue
        }
        const counterNotionalUsd = llmGate.notionalUsd
        if (counterNotionalUsd < runtime.minOrderNotionalUsd) {
          skipped += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'skipped',
            reason: 'below_hl_min_order_notional',
            counterSide: decision.counterSide,
            counterNotionalUsd,
            counterLeverage: decision.counterLeverage,
          })
          continue
        }

        const entryResult = await executeCounterTradeEntryFlow({
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          eventKey,
          pair,
          fill,
          fillAction: decision.fillAction,
          counterSide: decision.counterSide,
          counterLeverage: decision.counterLeverage,
          counterNotionalUsd,
          userLeverage: deriveUserLeverage(fill) ?? findCoinLeverageFromState(userWalletState, fill.coin),
          chatPostEnabled: runtime.chatPostEnabled,
          chatPostRoomId: runtime.chatPostRoomId,
          identityConfig,
        })

        if (entryResult.executedDelta > 0 && entryResult.resolvedCounterNotionalUsd != null) {
          executed += entryResult.executedDelta
          lastExecutedAtMs = nowMs
          usageState.recordExecutedEntry(entryResult.resolvedCounterNotionalUsd)
          openedCoinsThisTick.add(pair.toUpperCase())
          closedCoinsThisTick.delete(pair.toUpperCase())
        }
        failed += entryResult.failedDelta
      }
    } catch (error) {
      logger.warn('counter_trade.identity_scan_failed', {
        roomId: runtime.roomId,
        senderAddress: optIn.senderAddress,
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }
  }

  return {
    ok: true,
    roomId: runtime.roomId,
    scannedIdentities: strategyActors.length,
    scannedEvents,
    newEvents,
    executed,
    skipped,
    blocked,
    failed,
  }
}

