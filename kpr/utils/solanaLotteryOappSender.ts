/**
 * KPR mirror of the pluggable Solana lottery OApp sender.
 * Modes: unset (fail closed), http, mock (explicit allow).
 */

import { keccak256, type Hex } from 'viem'

export const SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED = 'solana_lottery_oapp_sender_unconfigured'

export type SolanaLotteryOappSendRequest = {
  payload: Hex
  sourceEventId: string
  sourceEventDigest: Hex
  buyer: string
  tokenIn: string
  amount: bigint
  peerBytes32: `0x${string}`
  lotteryManager: string
}

export type SolanaLotteryOappSendResult = {
  lzGuid: string
  baseTxHash: string | null
  solanaSignature: string
}

export type SolanaLotteryOappSender = {
  send(request: SolanaLotteryOappSendRequest): Promise<SolanaLotteryOappSendResult>
}

function truthyEnv(value: unknown): boolean {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase())
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
  const token = String(
    process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN ?? process.env.KPR_API_KEY ?? '',
  ).trim()
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
  if (!/^0x[a-fA-F0-9]{64}$/.test(lzGuid)) {
    throw new Error('solana_lottery_oapp_send_invalid_lz_guid')
  }
  const baseTxHash = typeof json.baseTxHash === 'string' ? json.baseTxHash.trim() : null
  if (baseTxHash && !/^0x[a-fA-F0-9]{64}$/.test(baseTxHash)) {
    throw new Error('solana_lottery_oapp_send_invalid_base_tx_hash')
  }
  const solanaSignature = typeof json.solanaSignature === 'string' ? json.solanaSignature.trim() : ''
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(solanaSignature)) {
    throw new Error('solana_lottery_oapp_send_invalid_solana_signature')
  }
  return {
    lzGuid,
    baseTxHash: baseTxHash || null,
    solanaSignature,
  }
}

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
  if (mode === 'http') return { send: sendViaHttp }
  if (mode === 'mock') {
    return {
      async send(request) {
        if (!truthyEnv(process.env.SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND)) {
          throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:mock_send_forbidden`)
        }
        const digest = request.sourceEventDigest.replace(/^0x/i, '').toLowerCase()
        return {
          lzGuid: `mock-${digest.slice(0, 32)}`,
          baseTxHash: null,
          solanaSignature: '1'.repeat(64),
        }
      },
    }
  }
  return {
    async send() {
      throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:unknown_mode:${mode}`)
    },
  }
}
