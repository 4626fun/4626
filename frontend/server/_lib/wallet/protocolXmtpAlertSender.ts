import fs from 'node:fs'
import path from 'node:path'

import { XmtpService } from '../../agents/eliza/plugins/xmtp/service.js'
import { logger } from '../infra/logger.js'
import { resolveXmtpDbDirectory } from '../messaging/xmtpDbDirectory.js'
import {
  hasProtocolCswRuntimeConfig,
  readProtocolCswChainIdEnv,
  readProtocolCswOwnerIndexEnv,
  readProtocolCswPrivyWalletIdEnv,
  resolveServerAgentCswAddress,
} from './canonicalCswEnv.js'
import { createPrivyScwSigner } from './privyXmtpSigner.js'

declare const process: { env: Record<string, string | undefined> }

function readXmtpEnv(): 'dev' | 'local' | 'production' {
  const env = (process.env.XMTP_ENV ?? 'production').trim()
  return env === 'dev' || env === 'local' || env === 'production' ? env : 'production'
}

function readXmtpDbPlaintextOnly(): boolean {
  const raw = String(process.env.XMTP_DB_PLAINTEXT_ONLY ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** Mirrors the encryption-key resolution used by the Keepr queue executor / Eliza XMTP service. */
function readXmtpDbEncryptionKey(): `0x${string}` | undefined {
  if (readXmtpDbPlaintextOnly()) return undefined
  const raw = (process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()
  if (!raw) return undefined
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`
}

function normalizeRecipientAddress(value: string): `0x${string}` | null {
  const trimmed = value.trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? (trimmed as `0x${string}`) : null
}

function makeProtocolAlertDbPath(cswAddress: string): string {
  const dir = resolveXmtpDbDirectory()
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const env = readXmtpEnv().toLowerCase().replace(/[^a-z0-9]/g, '') || 'production'
  const safe = cswAddress.toLowerCase().replace(/[^a-z0-9]/g, '')
  return path.join(dir, `protocol-alerts-${env}-${safe}.db3`)
}

/** Global kill-switch + runtime config gate for cron/Hermit XMTP alert delivery. */
export function isProtocolXmtpAlertDeliveryConfigured(): boolean {
  if ((process.env.ALFACLUB_POSITION_ALERTS_XMTP_ENABLED ?? '1').trim() === '0') {
    return false
  }
  return hasProtocolCswRuntimeConfig()
}

/**
 * Classification for a failed `sendProtocolAgentXmtpDm` attempt so callers
 * (Hermit reply copy, alert delivery metrics) can react differently instead
 * of treating every failure as an opaque "send failed".
 */
export type ProtocolXmtpSendFailureReason =
  | 'not_configured'
  | 'invalid_recipient'
  /** Recipient has no XMTP-registered identity yet (needs to bootstrap once). */
  | 'not_registered'
  | 'send_failed'

export type ProtocolXmtpSendResult =
  | { ok: true; reason: null }
  | { ok: false; reason: ProtocolXmtpSendFailureReason }

/**
 * Send a one-shot XMTP DM from the protocol 4626 agent CSW (`PROTOCOL_CSW_*`).
 * Uses a dedicated local XMTP DB keyed by protocol CSW address.
 */
export async function sendProtocolAgentXmtpDm(params: {
  recipientAddress: string
  text: string
}): Promise<ProtocolXmtpSendResult> {
  if (!isProtocolXmtpAlertDeliveryConfigured()) {
    logger.warn('position_alert.xmtp_not_configured')
    return { ok: false, reason: 'not_configured' }
  }

  const recipient = normalizeRecipientAddress(params.recipientAddress)
  if (!recipient) return { ok: false, reason: 'invalid_recipient' }

  const text = params.text.trim()
  if (!text) return { ok: false, reason: 'invalid_recipient' }

  const cswAddress = resolveServerAgentCswAddress()
  const walletId = readProtocolCswPrivyWalletIdEnv()
  if (!walletId) return { ok: false, reason: 'not_configured' }

  const ownerIndexRaw = readProtocolCswOwnerIndexEnv()
  const ownerIndexParsed = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN
  const ownerIndex =
    Number.isFinite(ownerIndexParsed) && ownerIndexParsed >= 0 ? Math.floor(ownerIndexParsed) : undefined

  const signer = createPrivyScwSigner({
    walletId,
    cswAddress,
    ownerIndex,
    chainId: readProtocolCswChainIdEnv(),
  })

  const dbEncryptionKey = readXmtpDbEncryptionKey()
  const xmtp = new XmtpService({
    signer,
    env: readXmtpEnv(),
    dbPath: makeProtocolAlertDbPath(cswAddress),
    revokeOtherInstallations: false,
    ...(dbEncryptionKey ? { dbEncryptionKey } : {}),
  })

  try {
    await xmtp.start()

    // Preflight: only treat an explicit `false` as "not registered yet" —
    // an ambiguous/unknown result (`null`) should not block the send attempt.
    const reachable = await xmtp.canMessage(recipient)
    if (reachable === false) {
      logger.warn('position_alert.xmtp_recipient_not_registered', { recipient })
      return { ok: false, reason: 'not_registered' }
    }

    const conversationId = await xmtp.createDm(recipient)
    await xmtp.sendToConversation(conversationId, text)
    return { ok: true, reason: null }
  } catch (error) {
    logger.warn('position_alert.xmtp_send_failed', {
      recipient,
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, reason: 'send_failed' }
  } finally {
    await xmtp.stop?.()
  }
}

/**
 * Link surfaced to users to bootstrap a first XMTP conversation with the
 * protocol agent. Deliberately points at this app's own in-app chat (which
 * already handles both EOA and Coinbase Smart Wallet signers, with retry
 * logic for signer-type misclassification) rather than a third-party XMTP
 * client — generic clients like xmtp.chat have no such fallback and can
 * throw a raw `[SignatureError::Invalid]` for smart-contract-wallet senders.
 */
export function formatProtocolAgentXmtpDmLink(): string {
  const address = resolveServerAgentCswAddress()
  const params = new URLSearchParams({
    chatAction: 'help',
    chatPeer: address,
    chatName: '4626 Agent',
  })
  return `https://app.4626.fun/?${params.toString()}`
}
