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
  isSupportedAlertScope,
  resolveMonitoredHlWalletsForAlert,
  ROOM_1659_ALERT_SCOPE,
} from './hermitAlertWallets.js'
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
import {
  isProtocolXmtpAlertDeliveryConfigured,
  sendProtocolAgentXmtpDm,
} from '../wallet/protocolXmtpAlertSender.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_ALERT_COOLDOWN_MS = 60 * 60 * 1_000
const DEFAULT_TELEGRAM_TIMEOUT_MS = 12_000

export type PositionAlertRunResult = {
  ok: boolean
  reason?: string
  scanned: number
  liqSent: number
  targetSent: number
  xmtpLiqSent: number
  xmtpTargetSent: number
  skippedCooldown: number
  skippedNoTelegram: number
  skippedNoXmtp: number
  skippedNoChannel: number
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

type AtRiskLeg = {
  walletLabel: string
  coin: string
  side: string
  liqDistPct: number
}

async function collectAtRiskLegs(params: {
  monitoredWallets: Awaited<ReturnType<typeof resolveMonitoredHlWalletsForAlert>>
  liquidationWarnPct: number
}): Promise<AtRiskLeg[]> {
  const atRisk: AtRiskLeg[] = []
  for (const wallet of params.monitoredWallets) {
    const hl = await getClearinghouseState(wallet.address)
    const legs = hl?.assetPositions ?? []
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
      if (liqDist != null && liqDist <= params.liquidationWarnPct) {
        atRisk.push({
          walletLabel: wallet.label,
          coin: pos.coin ?? 'HL',
          side: pos.side,
          liqDistPct: liqDist,
        })
      }
    }
  }
  return atRisk
}

async function sumMonitoredUnrealizedPnl(
  monitoredWallets: Awaited<ReturnType<typeof resolveMonitoredHlWalletsForAlert>>,
): Promise<number | null> {
  let total = 0
  let any = false
  for (const wallet of monitoredWallets) {
    const hl = await getClearinghouseState(wallet.address)
    const pnl = sumHyperliquidUnrealizedPnl(hl)
    if (pnl != null) {
      total += pnl
      any = true
    }
  }
  return any ? total : null
}

type AlertDeliveryResult = {
  telegramSent: boolean
  xmtpSent: boolean
  skippedNoTelegram: number
  skippedNoXmtp: number
  skippedNoChannel: number
  errors: number
}

async function deliverAlertText(params: {
  alert: PositionAlertConfig
  text: string
  botToken: string | null
}): Promise<AlertDeliveryResult> {
  let telegramSent = false
  let xmtpSent = false
  let skippedNoTelegram = 0
  let skippedNoXmtp = 0
  let skippedNoChannel = 0
  let errors = 0

  if (!params.alert.telegramEnabled && !params.alert.xmtpEnabled) {
    return {
      telegramSent,
      xmtpSent,
      skippedNoTelegram: 0,
      skippedNoXmtp: 0,
      skippedNoChannel: 1,
      errors,
    }
  }

  if (params.alert.telegramEnabled) {
    if (!params.botToken) {
      errors += 1
    } else {
      const chatId = await resolveTelegramChatIdForWallet(params.alert.senderAddress)
      if (!chatId) {
        skippedNoTelegram += 1
      } else {
        const ok = await sendTelegramDm({ chatId, text: params.text, botToken: params.botToken })
        if (ok) telegramSent = true
        else errors += 1
      }
    }
  }

  if (params.alert.xmtpEnabled) {
    if (!isProtocolXmtpAlertDeliveryConfigured()) {
      skippedNoXmtp += 1
      errors += 1
    } else {
      const result = await sendProtocolAgentXmtpDm({
        recipientAddress: params.alert.senderAddress,
        text: params.text,
      })
      if (result.ok) {
        xmtpSent = true
      } else if (result.reason === 'not_registered') {
        // Wallet hasn't bootstrapped an XMTP conversation with the agent
        // yet — treat as a skip, not a delivery error.
        skippedNoXmtp += 1
      } else {
        errors += 1
      }
    }
  }

  if (
    params.alert.telegramEnabled &&
    params.alert.xmtpEnabled &&
    !telegramSent &&
    !xmtpSent &&
    skippedNoTelegram > 0 &&
    skippedNoXmtp > 0
  ) {
    skippedNoChannel += 1
  }

  return {
    telegramSent,
    xmtpSent,
    skippedNoTelegram,
    skippedNoXmtp,
    skippedNoChannel,
    errors,
  }
}

async function evaluateAlert(params: {
  alert: PositionAlertConfig
  botToken: string | null
  cooldownMs: number
  nowMs: number
}): Promise<{
  liqSent: boolean
  targetSent: boolean
  xmtpLiqSent: boolean
  xmtpTargetSent: boolean
  skippedCooldown: number
  skippedNoTelegram: number
  skippedNoXmtp: number
  skippedNoChannel: number
  errors: number
}> {
  let liqSent = false
  let targetSent = false
  let xmtpLiqSent = false
  let xmtpTargetSent = false
  let skippedCooldown = 0
  let skippedNoTelegram = 0
  let skippedNoXmtp = 0
  let skippedNoChannel = 0
  let errors = 0

  if (!isSupportedAlertScope(params.alert.roomId)) {
    return {
      liqSent,
      targetSent,
      xmtpLiqSent,
      xmtpTargetSent,
      skippedCooldown,
      skippedNoTelegram,
      skippedNoXmtp,
      skippedNoChannel,
      errors,
    }
  }

  if (!params.alert.telegramEnabled && !params.alert.xmtpEnabled) {
    return {
      liqSent,
      targetSent,
      xmtpLiqSent,
      xmtpTargetSent,
      skippedCooldown,
      skippedNoTelegram: 0,
      skippedNoXmtp: 0,
      skippedNoChannel: 1,
      errors,
    }
  }

  const monitoredWallets = await resolveMonitoredHlWalletsForAlert(params.alert)

  if (
    params.alert.liquidationWarnPct != null &&
    !withinCooldown(params.alert.lastLiqAlertAt, params.cooldownMs, params.nowMs)
  ) {
    const atRisk = await collectAtRiskLegs({
      monitoredWallets,
      liquidationWarnPct: params.alert.liquidationWarnPct,
    })

    if (atRisk.length > 0) {
      const text = formatHyperliquidLiqAlertMessage({
        walletAddress: params.alert.senderAddress,
        warnPct: params.alert.liquidationWarnPct,
        legs: atRisk.map((leg) => ({
          coin: leg.coin,
          side: leg.side,
          liqDistPct: leg.liqDistPct,
          walletLabel: leg.walletLabel,
        })),
      })
      const delivery = await deliverAlertText({
        alert: params.alert,
        text,
        botToken: params.botToken,
      })
      if (delivery.telegramSent || delivery.xmtpSent) {
        await markPositionAlertFired({
          roomId: params.alert.roomId,
          senderAddress: params.alert.senderAddress,
          kind: 'liq',
        })
        if (delivery.telegramSent) liqSent = true
        if (delivery.xmtpSent) xmtpLiqSent = true
      }
      skippedNoTelegram += delivery.skippedNoTelegram
      skippedNoXmtp += delivery.skippedNoXmtp
      skippedNoChannel += delivery.skippedNoChannel
      errors += delivery.errors
    }
  } else if (params.alert.liquidationWarnPct != null && withinCooldown(params.alert.lastLiqAlertAt, params.cooldownMs, params.nowMs)) {
    skippedCooldown += 1
  }

  if (
    params.alert.targetPnlUsd != null &&
    !withinCooldown(params.alert.lastTargetAlertAt, params.cooldownMs, params.nowMs)
  ) {
    const totalPnl = await sumMonitoredUnrealizedPnl(monitoredWallets)
    if (totalPnl != null) {
      const progress = computeTargetProgressPct(totalPnl, params.alert.targetPnlUsd)
      if (progress != null && progress >= params.alert.targetProgressPct) {
        const text = formatHyperliquidTargetAlertMessage({
          walletAddress: params.alert.senderAddress,
          targetPnlUsd: params.alert.targetPnlUsd,
          progressPct: progress,
          currentPnlUsd: totalPnl,
          monitoredWalletLabels: monitoredWallets.map((wallet) => wallet.label),
        })
        const delivery = await deliverAlertText({
          alert: params.alert,
          text,
          botToken: params.botToken,
        })
        if (delivery.telegramSent || delivery.xmtpSent) {
          await markPositionAlertFired({
            roomId: params.alert.roomId,
            senderAddress: params.alert.senderAddress,
            kind: 'target',
          })
          if (delivery.telegramSent) targetSent = true
          if (delivery.xmtpSent) xmtpTargetSent = true
        }
        skippedNoTelegram += delivery.skippedNoTelegram
        skippedNoXmtp += delivery.skippedNoXmtp
        skippedNoChannel += delivery.skippedNoChannel
        errors += delivery.errors
      }
    }
  } else if (params.alert.targetPnlUsd != null && withinCooldown(params.alert.lastTargetAlertAt, params.cooldownMs, params.nowMs)) {
    skippedCooldown += 1
  }

  return {
    liqSent,
    targetSent,
    xmtpLiqSent,
    xmtpTargetSent,
    skippedCooldown,
    skippedNoTelegram,
    skippedNoXmtp,
    skippedNoChannel,
    errors,
  }
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
      xmtpLiqSent: 0,
      xmtpTargetSent: 0,
      skippedCooldown: 0,
      skippedNoTelegram: 0,
      skippedNoXmtp: 0,
      skippedNoChannel: 0,
      errors: 0,
    }
  }

  const bridgeFlags = readAlfaClubChatBridgeFlags()
  const botToken = bridgeFlags.botToken
  const alerts = (await listEnabledPositionAlerts()).filter((row) =>
    row.roomId === HL_POSITION_ALERT_SCOPE || row.roomId === ROOM_1659_ALERT_SCOPE,
  )
  const nowMs = Date.now()

  let liqSent = 0
  let targetSent = 0
  let xmtpLiqSent = 0
  let xmtpTargetSent = 0
  let skippedCooldown = 0
  let skippedNoTelegram = 0
  let skippedNoXmtp = 0
  let skippedNoChannel = 0
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
      if (result.xmtpLiqSent) xmtpLiqSent += 1
      if (result.xmtpTargetSent) xmtpTargetSent += 1
      skippedCooldown += result.skippedCooldown
      skippedNoTelegram += result.skippedNoTelegram
      skippedNoXmtp += result.skippedNoXmtp
      skippedNoChannel += result.skippedNoChannel
      errors += result.errors
    } catch (error) {
      errors += 1
      logger.warn('position_alert.evaluate_failed', {
        sender: alert.senderAddress,
        roomId: alert.roomId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    ok: true,
    scanned: alerts.length,
    liqSent,
    targetSent,
    xmtpLiqSent,
    xmtpTargetSent,
    skippedCooldown,
    skippedNoTelegram,
    skippedNoXmtp,
    skippedNoChannel,
    errors,
  }
}
