/**
 * Pluggable Solana→Base lottery OApp send adapter.
 *
 * The Solana lottery OApp program itself is deployed/authorized out of band.
 * This module only invokes an ops-configured sender once readiness gates pass.
 *
 * Modes (SOLANA_LOTTERY_OAPP_SENDER_MODE):
 * - unset: fail closed (`solana_lottery_oapp_sender_unconfigured`)
 * - http: POST V3 payload to SOLANA_LOTTERY_OAPP_SEND_URL (machine auth)
 * - mock: test/dev only when SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND=1
 */

import { keccak256, type Hex } from 'viem'

export const SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED = 'solana_lottery_oapp_sender_unconfigured'

export type SolanaLotteryOappSendRequest = {
  payload: Hex
  sourceEventId: string
  sourceEventDigest: Hex
  buyer: `0x${string}`
  tokenIn: `0x${string}`
  amount: bigint
  peerBytes32: `0x${string}`
  lotteryManager: `0x${string}`
}

export type SolanaLotteryOappSendResult = {
  lzGuid: string
  baseTxHash: string | null
  solanaSignature: string
}

export type SolanaLotteryOappSender = {
  send(request: SolanaLotteryOappSendRequest): Promise<SolanaLotteryOappSendResult>
}

function envFlag(name: string): boolean {
  return ['1', 'true', 'yes'].includes(String(process.env[name] ?? '').trim().toLowerCase())
}

function senderMode(): string {
  return String(process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE ?? '').trim().toLowerCase()
}

function sendTimeoutMs(): number {
  const configured = Number(process.env.SOLANA_LOTTERY_OAPP_SEND_TIMEOUT_MS ?? 30_000)
  if (!Number.isFinite(configured)) return 30_000
  return Math.max(1_000, Math.min(Math.floor(configured), 120_000))
}

async function sendViaHttp(request: SolanaLotteryOappSendRequest): Promise<SolanaLotteryOappSendResult> {
  const url = String(process.env.SOLANA_LOTTERY_OAPP_SEND_URL ?? '').trim()
  if (!url) throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:missing_send_url`)

  const token = String(process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN ?? '').trim()
  if (!token) throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:missing_send_token`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': request.sourceEventDigest,
    },
    body: JSON.stringify({
      payload: request.payload,
      payloadHash: keccak256(request.payload),
      sourceEventId: request.sourceEventId,
      sourceEventDigest: request.sourceEventDigest,
      buyer: request.buyer,
      tokenIn: request.tokenIn,
      amount: request.amount.toString(),
      peerBytes32: request.peerBytes32,
      lotteryManager: request.lotteryManager,
    }),
    signal: AbortSignal.timeout(sendTimeoutMs()),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`solana_lottery_oapp_send_http_${response.status}:${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as Record<string, unknown>
  const acknowledgedSourceEvent = typeof json.sourceEventDigest === 'string'
    ? json.sourceEventDigest.toLowerCase() : ''
  const acknowledgedPayloadHash = typeof json.payloadHash === 'string'
    ? json.payloadHash.toLowerCase() : ''
  if (acknowledgedSourceEvent !== request.sourceEventDigest.toLowerCase()) {
    throw new Error('solana_lottery_oapp_send_source_event_ack_mismatch')
  }
  if (acknowledgedPayloadHash !== keccak256(request.payload).toLowerCase()) {
    throw new Error('solana_lottery_oapp_send_payload_ack_mismatch')
  }
  const lzGuid = typeof json.lzGuid === 'string' ? json.lzGuid.trim() : ''
  if (!/^0x[a-fA-F0-9]{64}$/.test(lzGuid)) throw new Error('solana_lottery_oapp_send_invalid_lz_guid')
  const baseTxHash = typeof json.baseTxHash === 'string' ? json.baseTxHash.trim() : null
  const solanaSignature = typeof json.solanaSignature === 'string' ? json.solanaSignature.trim() : null
  if (!solanaSignature || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(solanaSignature)) {
    throw new Error('solana_lottery_oapp_send_invalid_solana_signature')
  }
  return {
    lzGuid,
    baseTxHash: baseTxHash || null,
    solanaSignature,
  }
}

function sendViaMock(request: SolanaLotteryOappSendRequest): SolanaLotteryOappSendResult {
  if (!envFlag('SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND')) {
    throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:mock_send_forbidden`)
  }
  const digest = request.sourceEventDigest.replace(/^0x/i, '').toLowerCase()
  return {
    lzGuid: `0x${digest.padEnd(64, '0').slice(0, 64)}`,
    baseTxHash: null,
    solanaSignature: '1'.repeat(64),
  }
}

/** Resolve the configured sender. Fail closed when unset. */
export function resolveSolanaLotteryOappSender(
  override?: SolanaLotteryOappSender | null,
): SolanaLotteryOappSender {
  if (override) return override
  const mode = senderMode()
  if (!mode) {
    return {
      async send() {
        throw new Error(SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED)
      },
    }
  }
  if (mode === 'http') {
    return { send: sendViaHttp }
  }
  if (mode === 'mock') {
    return { send: async (request) => sendViaMock(request) }
  }
  return {
    async send() {
      throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:unknown_mode:${mode}`)
    },
  }
}

export async function sendSolanaLotteryOappMessage(
  request: SolanaLotteryOappSendRequest,
  override?: SolanaLotteryOappSender | null,
): Promise<SolanaLotteryOappSendResult> {
  return resolveSolanaLotteryOappSender(override).send(request)
}
