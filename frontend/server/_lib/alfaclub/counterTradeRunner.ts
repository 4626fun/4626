import { logger } from '../infra/logger.js'
import { readArenaConfig } from '../arena/arenaConfig.js'
import { resolveArenaIdentityForContext } from '../arena/arenaIdentityMappingStore.js'
import { runArenaSpotPerpTransfer, runArenaTrade } from '../arena/arenaClient.js'
import { sendAlfaClubRoomText } from './chatBridge.js'
import {
  getClearinghouseState,
  getSpotUsdcBalance,
  getUserFillsByTimeDetailed,
  type HyperliquidClearinghouseState,
  type HyperliquidUserFillDetailed,
} from './hyperliquid.js'
import { resolveRoom1659HyperliquidUserForSnapshot } from './room1659Market.js'
import { readCounterTradeRuntimeConfig } from './counterTradeConfig.js'
import { applyCounterTradeLlmGate } from './counterTradeLlmAdvisor.js'
import {
  classifyCounterTradeFillAction,
  type CounterTradeFillAction,
  deriveCounterTradeDecision,
  deriveEventKeyFromFill,
  derivePresetDailyNotionalCap,
  derivePresetHourlyCap,
  deriveUserLeverage,
  deriveUserNotional,
  deriveUserSide,
  findCounterPositionForCoin,
  isExitFillAction,
} from './counterTradeEngine.js'
import {
  type BankedCloseSummary,
  formatSignedUsd,
  resolveBotBankedPnlForClose,
} from './counterTradeHarvest.js'
import { computeBufferRatio, runCounterTradeDefenseForIdentity } from './counterTradeDefense.js'
import {
  COUNTER_TRADE_EXIT_EXECUTED_REASON,
  enforceSingleActiveCounterTradeActor,
  listActiveCounterTradeOptIns,
  readCounterTradeUsageWindow,
  readOrCreateCounterTradeRoomStrategy,
  recordCounterTradeAction,
  registerCounterTradeEventIfNew,
} from './counterTradeStore.js'

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

function formatSpotSweepRoomPost(params: {
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

async function postCounterTradeExitRoomUpdate(params: {
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

async function postCounterTradeRoomUpdate(params: {
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
          const exitPair = String(fill.coin ?? '').trim()
          const exitCoinKey = exitPair.toUpperCase()
          const recordExitOutcome = async (status: 'executed' | 'skipped' | 'failed', reason: string) => {
            await recordCounterTradeAction({
              roomId: runtime.roomId,
              senderAddress: optIn.senderAddress,
              eventKey,
              status,
              reason,
              counterSide: null,
              counterNotionalUsd: null,
              counterLeverage: null,
            })
          }

          if (!runtime.exitEnabled) {
            skipped += 1
            await recordExitOutcome('skipped', `exit_disabled:${fillAction}`)
            continue
          }
          if (!exitPair) {
            skipped += 1
            await recordExitOutcome('skipped', 'exit_missing_pair')
            continue
          }
          if (closedCoinsThisTick.has(exitCoinKey)) {
            skipped += 1
            await recordExitOutcome('skipped', 'exit_already_closed_this_tick')
            continue
          }

          const botLeg = findCounterPositionForCoin(counterWalletState, exitPair)
          if (!botLeg && !openedCoinsThisTick.has(exitCoinKey)) {
            skipped += 1
            await recordExitOutcome('skipped', 'exit_no_position')
            continue
          }

          const closeSubmittedAtMs = Date.now()
          const closeResult = await runArenaTrade({ action: 'close', pair: exitPair }, identityConfig)
          if (closeResult.ok) {
            executed += 1
            closedCoinsThisTick.add(exitCoinKey)
            openedCoinsThisTick.delete(exitCoinKey)
            await recordCounterTradeAction({
              roomId: runtime.roomId,
              senderAddress: optIn.senderAddress,
              eventKey,
              status: 'executed',
              reason: COUNTER_TRADE_EXIT_EXECUTED_REASON,
              counterSide: botLeg?.side ?? null,
              counterNotionalUsd: null,
              counterLeverage: null,
            })

            // Harvest accounting: best-effort read of what this round trip
            // banked on the bot wallet (realized PnL net of fees). Null when
            // the close fill has not landed in the fills API yet.
            let banked: BankedCloseSummary | null = null
            if (identityConfig.agentWalletAddress) {
              try {
                banked = await resolveBotBankedPnlForClose({
                  botWalletAddress: identityConfig.agentWalletAddress,
                  coin: exitPair,
                  closeSubmittedAtMs,
                })
              } catch (harvestError) {
                logger.warn('counter_trade.harvest_lookup_failed', {
                  roomId: runtime.roomId,
                  pair: exitPair,
                  message: harvestError instanceof Error ? harvestError.message : String(harvestError),
                })
              }
            }
            logger.info('counter_trade.harvest', {
              roomId: runtime.roomId,
              senderAddress: optIn.senderAddress,
              pair: exitPair,
              fillAction,
              closedSide: botLeg?.side ?? null,
              closedPositionValueUsd: botLeg?.positionValue ?? null,
              bankedRealizedPnlUsd: banked?.realizedPnlUsd ?? null,
              bankedFeesUsd: banked?.feesUsd ?? null,
              bankedNetUsd: banked?.netRealizedUsd ?? null,
              bankedFillCount: banked?.fillCount ?? 0,
            })

            if (runtime.chatPostEnabled) {
              try {
                await postCounterTradeExitRoomUpdate({
                  runtimeRoomId: runtime.roomId,
                  postRoomId: runtime.chatPostRoomId,
                  pair: exitPair,
                  userFill: fill,
                  fillAction,
                  closedSide: botLeg?.side ?? null,
                  closedPositionValueUsd: botLeg?.positionValue ?? null,
                  banked,
                })
              } catch (postError) {
                logger.warn('counter_trade.exit_room_post_failed', {
                  roomId: runtime.roomId,
                  postRoomId: runtime.chatPostRoomId,
                  senderAddress: optIn.senderAddress,
                  pair: exitPair,
                  message: postError instanceof Error ? postError.message : String(postError),
                })
              }
            }
          } else {
            failed += 1
            await recordExitOutcome(
              'failed',
              `exit_failed:${String(closeResult.message ?? 'arena_close_failed')}`,
            )
            logger.warn('counter_trade.exit_execution_failed', {
              roomId: runtime.roomId,
              senderAddress: optIn.senderAddress,
              eventKey,
              pair: exitPair,
              reason: closeResult.message,
            })
          }
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

        const hourlyUsage = await readCounterTradeUsageWindow({
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          sinceMs: Date.now() - 60 * 60_000,
        })
        const dailyUsage = await readCounterTradeUsageWindow({
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          sinceMs: Date.now() - 24 * 60 * 60_000,
        })

        const hourlyCap = derivePresetHourlyCap({ preset: optIn.preset, runtime })
        const dailyCap = derivePresetDailyNotionalCap({ preset: optIn.preset, runtime })
        if (hourlyUsage.executedCount >= hourlyCap) {
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

        const remainingDailyNotional = Math.max(0, dailyCap - dailyUsage.notionalUsd)
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
          hourlyExecutedCount: hourlyUsage.executedCount,
          hourlyCap,
          dailyNotionalUsedUsd: dailyUsage.notionalUsd,
          dailyNotionalCapUsd: dailyCap,
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

        const tradeResult = await runArenaTrade(
          {
            action: 'open',
            pair,
            side: decision.counterSide,
            sizeUsd: counterNotionalUsd,
            leverage: decision.counterLeverage,
          },
          identityConfig,
        )

        if (tradeResult.ok) {
          let resolvedCounterNotionalUsd = counterNotionalUsd
          let resolvedCounterLeverage = decision.counterLeverage
          if (identity.agentWalletAddress) {
            try {
              const postTradeState = await getClearinghouseState(identity.agentWalletAddress)
              const postTradePosition = findCounterPositionForCoin(postTradeState, pair)
              const postTradeLeverage = findCoinLeverageFromState(postTradeState, pair)
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
          executed += 1
          lastExecutedAtMs = nowMs
          openedCoinsThisTick.add(pair.toUpperCase())
          closedCoinsThisTick.delete(pair.toUpperCase())
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'executed',
            reason: 'executed',
            counterSide: decision.counterSide,
            counterNotionalUsd: resolvedCounterNotionalUsd,
            counterLeverage: resolvedCounterLeverage,
          })
          if (runtime.chatPostEnabled) {
            try {
              await postCounterTradeRoomUpdate({
                runtimeRoomId: runtime.roomId,
                postRoomId: runtime.chatPostRoomId,
                pair,
                userFill: fill,
                fillAction: decision.fillAction,
                counterSide: decision.counterSide,
                counterLeverage: resolvedCounterLeverage,
                counterNotionalUsd: resolvedCounterNotionalUsd,
                userLeverage:
                  deriveUserLeverage(fill) ?? findCoinLeverageFromState(userWalletState, fill.coin),
              })
            } catch (postError) {
              logger.warn('counter_trade.room_post_failed', {
                roomId: runtime.roomId,
                postRoomId: runtime.chatPostRoomId,
                senderAddress: optIn.senderAddress,
                pair,
                message: postError instanceof Error ? postError.message : String(postError),
              })
            }
          }
        } else {
          failed += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'failed',
            reason: String(tradeResult.message ?? 'arena_trade_failed'),
            counterSide: decision.counterSide,
            counterNotionalUsd,
            counterLeverage: decision.counterLeverage,
          })
          logger.warn('counter_trade.execution_failed', {
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            pair,
            reason: tradeResult.message,
          })
        }
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

