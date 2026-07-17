/**
 * KPR mirror of the pluggable Solana lottery OApp sender.
 * Modes: unset (fail closed), http, mock (explicit allow).
 */

export const SOLANA_LOTTERY_OAPP_SENDER_UNCONFIGURED = 'solana_lottery_oapp_sender_unconfigured'

export type SolanaLotteryOappSendRequest = {
  sourceEventId: string
  sourceEventDigest: `0x${string}`
  buyer: string
  tokenIn: string
  amount: bigint
  peerBytes32: `0x${string}`
  lotteryManager: string
}

export type SolanaLotteryOappSendResult = {
  lzGuid: string
  baseTxHash: string | null
  solanaSignature: string | null
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
    },
    body: JSON.stringify({
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
  return {
    lzGuid,
    baseTxHash: typeof json.baseTxHash === 'string' ? json.baseTxHash.trim() || null : null,
    solanaSignature:
      typeof json.solanaSignature === 'string' ? json.solanaSignature.trim() || null : null,
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
          solanaSignature: `mock-sig-${digest.slice(0, 16)}`,
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
