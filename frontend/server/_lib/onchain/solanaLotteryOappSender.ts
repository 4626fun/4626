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

import type { Hex } from 'viem'

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
  solanaSignature: string | null
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

async function sendViaHttp(request: SolanaLotteryOappSendRequest): Promise<SolanaLotteryOappSendResult> {
  const url = String(process.env.SOLANA_LOTTERY_OAPP_SEND_URL ?? '').trim()
  if (!url) throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:missing_send_url`)

  const token = String(
    process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN ??
      process.env.KPR_API_KEY ??
      process.env.KEEPR_API_KEY ??
      '',
  ).trim()
  if (!token) throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:missing_send_token`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      payload: request.payload,
      sourceEventId: request.sourceEventId,
      sourceEventDigest: request.sourceEventDigest,
      buyer: request.buyer,
      tokenIn: request.tokenIn,
      amount: request.amount.toString(),
      peerBytes32: request.peerBytes32,
      lotteryManager: request.lotteryManager,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`solana_lottery_oapp_send_http_${response.status}:${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as Record<string, unknown>
  const lzGuid = typeof json.lzGuid === 'string' ? json.lzGuid.trim() : ''
  if (!lzGuid) throw new Error('solana_lottery_oapp_send_missing_lz_guid')
  const baseTxHash = typeof json.baseTxHash === 'string' ? json.baseTxHash.trim() : null
  const solanaSignature = typeof json.solanaSignature === 'string' ? json.solanaSignature.trim() : null
  return {
    lzGuid,
    baseTxHash: baseTxHash || null,
    solanaSignature: solanaSignature || null,
  }
}

function sendViaMock(request: SolanaLotteryOappSendRequest): SolanaLotteryOappSendResult {
  if (!envFlag('SOLANA_LOTTERY_OAPP_ALLOW_MOCK_SEND')) {
    throw new Error(`${SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED}:mock_send_forbidden`)
  }
  const digest = request.sourceEventDigest.replace(/^0x/i, '').toLowerCase()
  return {
    lzGuid: `mock-${digest.slice(0, 32)}`,
    baseTxHash: null,
    solanaSignature: `mock-sig-${digest.slice(0, 16)}`,
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
