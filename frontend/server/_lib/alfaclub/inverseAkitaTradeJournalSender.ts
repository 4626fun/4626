import {
  readAlfaClubApiAuthFlags,
  resolveAlfaClubApiCallBaseUrl,
  resolveAlfaClubProxySecret,
} from './apiAuth.js'

export type AlfaClubStrictBotSendResult = {
  lane: 'bot_token_strict_parent' | 'bot_token_strict_reply'
  messageId: string
}

export type InverseAkitaJournalSendResult = AlfaClubStrictBotSendResult

export type AlfaClubBotSenderReadiness =
  | { ready: true; errorCode: null }
  | { ready: false; errorCode: 'alfaclub_bot_token_missing' }

function messageId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const record = payload as Record<string, unknown>
  for (const key of ['messageId', 'message_id', 'id']) {
    const value = String(record[key] ?? '').trim()
    if (value) return value
  }
  return null
}

function idempotencyKey(roomId: string, clientMessageId: string): string {
  return `inverse-akita-journal:${roomId}:${clientMessageId}`
    .replace(/[^A-Za-z0-9._:-]/g, '-')
    .slice(0, 128)
}

/** Reports strict write-lane readiness without returning credential material. */
export function readAlfaClubBotSenderReadiness(): AlfaClubBotSenderReadiness {
  return readAlfaClubApiAuthFlags().botToken
    ? { ready: true, errorCode: null }
    : { ready: false, errorCode: 'alfaclub_bot_token_missing' }
}

async function post(params: {
  baseUrl: string
  directBaseUrl: string
  proxySecret: string | null
  botToken: string
  roomId: string
  text: string
  replyToMessageId?: string
  clientMessageId: string
  timeoutMs: number
}): Promise<AlfaClubStrictBotSendResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  let response: Response
  try {
    response = await fetch(
      new URL(`/api/room/${encodeURIComponent(params.roomId)}/message`, params.baseUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.botToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey(params.roomId, params.clientMessageId),
          ...(params.proxySecret ? { 'x-proxy-secret': params.proxySecret } : {}),
        },
        body: JSON.stringify({
          body: params.text.slice(0, 2_000),
          ...(params.replyToMessageId ? { reply_id: params.replyToMessageId } : {}),
        }),
        signal: controller.signal,
      },
    )
  } catch {
    throw Object.assign(new Error('bot_send_unknown'), { code: 'bot_send_unknown' })
  } finally {
    clearTimeout(timeout)
  }
  const bodyText = await response.text().catch(() => '')
  if (
    response.status === 404
    && params.baseUrl !== params.directBaseUrl
    && bodyText.includes('path_not_allowed')
  ) {
    return post({
      ...params,
      baseUrl: params.directBaseUrl,
      proxySecret: null,
    })
  }
  if (!response.ok) {
    const state = response.status >= 400 && response.status < 500
      ? 'bot_send_failed'
      : 'bot_send_unknown'
    throw Object.assign(new Error(state), { code: state })
  }
  let payload: unknown = null
  try {
    payload = bodyText ? JSON.parse(bodyText) : null
  } catch {
    payload = null
  }
  const stableMessageId = messageId(payload)
  if (!stableMessageId) {
    throw Object.assign(new Error('bot_send_unknown'), { code: 'bot_send_unknown' })
  }
  return {
    lane: params.replyToMessageId ? 'bot_token_strict_reply' : 'bot_token_strict_parent',
    messageId: stableMessageId,
  }
}

export async function sendAlfaClubBotTextStrict(params: {
  text: string
  roomId: string
  clientMessageId: string
  replyToMessageId?: string
}): Promise<AlfaClubStrictBotSendResult> {
  const flags = readAlfaClubApiAuthFlags()
  const botToken = String(flags.botToken ?? '').trim()
  const text = String(params.text ?? '').trim()
  const roomId = String(params.roomId ?? '').trim()
  const clientMessageId = String(params.clientMessageId ?? '').trim()
  if (!botToken || !text || !roomId || !clientMessageId) {
    throw Object.assign(new Error('bot_send_failed'), { code: 'bot_send_failed' })
  }
  return post({
    baseUrl: resolveAlfaClubApiCallBaseUrl(flags),
    directBaseUrl: flags.apiBaseUrl,
    proxySecret: resolveAlfaClubProxySecret(flags),
    botToken,
    roomId,
    text,
    replyToMessageId: params.replyToMessageId,
    clientMessageId,
    timeoutMs: 15_000,
  })
}

export async function sendInverseAkitaJournalTextStrict(params: {
  text: string
  roomId: string
  clientMessageId: string
  replyToMessageId?: string
}): Promise<InverseAkitaJournalSendResult> {
  try {
    return await sendAlfaClubBotTextStrict(params)
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    const journalCode = code === 'bot_send_failed'
      ? 'journal_send_failed'
      : 'journal_send_unknown'
    throw Object.assign(new Error(journalCode), { code: journalCode })
  }
}
