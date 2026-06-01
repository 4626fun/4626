import { logger } from '../infra/logger.js'
import { getClearinghouseState } from './hyperliquid.js'
import {
  HL_POSITION_ALERT_SCOPE,
  listEnabledPositionAlerts,
  markPositionAlertFired,
  resolveTelegramChatIdForWallet,
  type PositionAlertConfig,
} from './positionAlertStore.js'
import {
  formatHyperliquidLiqAlertMessage,
  formatHyperliquidTargetAlertMessage,
  sumHyperliquidUnrealizedPnl,
} from './positionReport.js'
import {
  computeLiquidationProximityPct,
  computeTargetProgressPct,
  estimateMarkPrice,
} from './positionProximity.js'
import { readAlfaClubChatBridgeFlags } from './chatBridge.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_ALERT_COOLDOWN_MS = 60 * 60 * 1_000
const DEFAULT_TELEGRAM_TIMEOUT_MS = 12_000

export type PositionAlertRunResult = {
  ok: boolean
  reason?: string
  scanned: number
  liqSent: number
  targetSent: number
  skippedCooldown: number
  skippedNoTelegram: number
  errors: number
}

function readFlags() {
  const enabled = (process.env.ALFACLUB_POSITION_ALERTS_ENABLED ?? '1').trim() !== '0'
  const cooldownMs = Number(process.env.ALFACLUB_POSITION_ALERT_COOLDOWN_MS ?? DEFAULT_ALERT_COOLDOWN_MS)
  return {
    enabled,
    cooldownMs: Number.isFinite(cooldownMs) && cooldownMs > 0 ? cooldownMs : DEFAULT_ALERT_COOLDOWN_MS,
  }
}

function withinCooldown(lastAt: string | null, cooldownMs: number, nowMs: number): boolean {
  if (!lastAt) return false
  const ts = Date.parse(lastAt)
  if (!Number.isFinite(ts)) return false
  return nowMs - ts < cooldownMs
}

async function sendTelegramDm(params: { chatId: string; text: string; botToken: string }): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TELEGRAM_TIMEOUT_MS)
  try {
    const response = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.text,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      logger.warn('position_alert.telegram_send_failed', {
        status: response.status,
        body: body.slice(0, 180),
      })
      return false
    }
    return true
  } catch (error) {
    logger.warn('position_alert.telegram_send_error', {
      message: error instanceof Error ? error.message : String(error),
    })
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function evaluateAlert(params: {
  alert: PositionAlertConfig
  botToken: string | null
  cooldownMs: number
  nowMs: number
}): Promise<{ liqSent: boolean; targetSent: boolean; skippedCooldown: number; skippedNoTelegram: number; errors: number }> {
  let liqSent = false
  let targetSent = false
  let skippedCooldown = 0
  let skippedNoTelegram = 0
  let errors = 0

  if (params.alert.roomId !== HL_POSITION_ALERT_SCOPE) {
    return { liqSent, targetSent, skippedCooldown, skippedNoTelegram, errors }
  }

  if (!params.alert.telegramEnabled) {
    return { liqSent, targetSent, skippedCooldown, skippedNoTelegram: 1, errors }
  }
  if (!params.botToken) {
    return { liqSent, targetSent, skippedCooldown, skippedNoTelegram: 1, errors: 1 }
  }

  const chatId = await resolveTelegramChatIdForWallet(params.alert.senderAddress)
  if (!chatId) {
    return { liqSent, targetSent, skippedCooldown, skippedNoTelegram: 1, errors }
  }

  const hl = await getClearinghouseState(params.alert.senderAddress)
  const legs = hl?.assetPositions ?? []

  if (
    params.alert.liquidationWarnPct != null &&
    !withinCooldown(params.alert.lastLiqAlertAt, params.cooldownMs, params.nowMs)
  ) {
    const atRisk: Array<{ coin: string; side: string; liqDistPct: number }> = []
    for (const pos of legs) {
      if (
        !pos.side ||
        pos.entryPx == null ||
        pos.liquidationPx == null ||
        pos.positionValue == null ||
        pos.unrealizedPnl == null
      ) {
        continue
      }
      const mark = estimateMarkPrice({
        entryPx: pos.entryPx,
        positionValueUsd: pos.positionValue,
        unrealizedPnlUsd: pos.unrealizedPnl,
        side: pos.side,
      })
      if (mark == null) continue
      const liqDist = computeLiquidationProximityPct({
        markPrice: mark,
        liquidationPrice: pos.liquidationPx,
        side: pos.side,
      })
      if (liqDist != null && liqDist <= params.alert.liquidationWarnPct) {
        atRisk.push({ coin: pos.coin ?? 'HL', side: pos.side, liqDistPct: liqDist })
      }
    }

    if (atRisk.length > 0) {
      const text = formatHyperliquidLiqAlertMessage({
        walletAddress: params.alert.senderAddress,
        warnPct: params.alert.liquidationWarnPct,
        legs: atRisk,
      })
      const ok = await sendTelegramDm({ chatId, text, botToken: params.botToken })
      if (ok) {
        await markPositionAlertFired({
          roomId: params.alert.roomId,
          senderAddress: params.alert.senderAddress,
          kind: 'liq',
        })
        liqSent = true
      } else {
        errors += 1
      }
    }
  } else if (params.alert.liquidationWarnPct != null && withinCooldown(params.alert.lastLiqAlertAt, params.cooldownMs, params.nowMs)) {
    skippedCooldown += 1
  }

  if (
    params.alert.targetPnlUsd != null &&
    !withinCooldown(params.alert.lastTargetAlertAt, params.cooldownMs, params.nowMs)
  ) {
    const totalPnl = sumHyperliquidUnrealizedPnl(hl)
    if (totalPnl != null) {
      const progress = computeTargetProgressPct(totalPnl, params.alert.targetPnlUsd)
      if (progress != null && progress >= params.alert.targetProgressPct) {
        const text = formatHyperliquidTargetAlertMessage({
          walletAddress: params.alert.senderAddress,
          targetPnlUsd: params.alert.targetPnlUsd,
          progressPct: progress,
          currentPnlUsd: totalPnl,
        })
        const ok = await sendTelegramDm({ chatId, text, botToken: params.botToken })
        if (ok) {
          await markPositionAlertFired({
            roomId: params.alert.roomId,
            senderAddress: params.alert.senderAddress,
            kind: 'target',
          })
          targetSent = true
        } else {
          errors += 1
        }
      }
    }
  } else if (params.alert.targetPnlUsd != null && withinCooldown(params.alert.lastTargetAlertAt, params.cooldownMs, params.nowMs)) {
    skippedCooldown += 1
  }

  return { liqSent, targetSent, skippedCooldown, skippedNoTelegram, errors }
}

export async function runPositionAlerts(): Promise<PositionAlertRunResult> {
  const flags = readFlags()
  if (!flags.enabled) {
    return {
      ok: false,
      reason: 'disabled',
      scanned: 0,
      liqSent: 0,
      targetSent: 0,
      skippedCooldown: 0,
      skippedNoTelegram: 0,
      errors: 0,
    }
  }

  const bridgeFlags = readAlfaClubChatBridgeFlags()
  const botToken = bridgeFlags.botToken
  const alerts = (await listEnabledPositionAlerts()).filter(
    (row) => row.roomId === HL_POSITION_ALERT_SCOPE,
  )
  const nowMs = Date.now()

  let liqSent = 0
  let targetSent = 0
  let skippedCooldown = 0
  let skippedNoTelegram = 0
  let errors = 0

  for (const alert of alerts) {
    try {
      const result = await evaluateAlert({
        alert,
        botToken,
        cooldownMs: flags.cooldownMs,
        nowMs,
      })
      if (result.liqSent) liqSent += 1
      if (result.targetSent) targetSent += 1
      skippedCooldown += result.skippedCooldown
      skippedNoTelegram += result.skippedNoTelegram
      errors += result.errors
    } catch (error) {
      errors += 1
      logger.warn('position_alert.evaluate_failed', {
        sender: alert.senderAddress,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    ok: true,
    scanned: alerts.length,
    liqSent,
    targetSent,
    skippedCooldown,
    skippedNoTelegram,
    errors,
  }
}
