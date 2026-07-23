import { afterEach, describe, expect, it, vi } from 'vitest'
import { keccak256 } from 'viem'

import { sendSolanaLotteryOappMessage } from './solanaLotteryOappSender.js'

const request = {
  payload: `0x${'12'.repeat(96)}` as const,
  sourceEventId: 'solana:signature:4',
  sourceEventDigest: `0x${'34'.repeat(32)}` as const,
  buyer: `0x${'56'.repeat(20)}` as const,
  tokenIn: `0x${'78'.repeat(20)}` as const,
  amount: 42n,
  peerBytes32: `0x${'9a'.repeat(32)}` as const,
  lotteryManager: `0x${'bc'.repeat(20)}` as const,
}

describe('solanaLotteryOappSender', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE
    delete process.env.SOLANA_LOTTERY_OAPP_SEND_URL
    delete process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN
    delete process.env.KPR_API_KEY
    delete process.env.KEEPR_API_KEY
  })

  it('fails closed when no production sender is configured', async () => {
    await expect(sendSolanaLotteryOappMessage(request)).rejects.toThrow(
      'solana_lottery_oapp_sender_unconfigured',
    )
  })

  it('does not fall back to keeper API keys for OApp sends', async () => {
    process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE = 'http'
    process.env.SOLANA_LOTTERY_OAPP_SEND_URL = 'https://sender.4626.fun/send'
    process.env.KPR_API_KEY = 'keeper-key'

    await expect(sendSolanaLotteryOappMessage(request)).rejects.toThrow(
      'solana_lottery_oapp_sender_unconfigured:missing_send_token',
    )
  })

  it('accepts only a sender receipt bound to the exact event and payload', async () => {
    process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE = 'http'
    process.env.SOLANA_LOTTERY_OAPP_SEND_URL = 'https://sender.4626.fun/send'
    process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN = 'machine-secret'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      sourceEventDigest: request.sourceEventDigest,
      payloadHash: keccak256(request.payload),
      lzGuid: `0x${'de'.repeat(32)}`,
      solanaSignature: '1'.repeat(64),
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendSolanaLotteryOappMessage(request)).resolves.toMatchObject({
      lzGuid: `0x${'de'.repeat(32)}`,
      solanaSignature: '1'.repeat(64),
      baseTxHash: null,
    })
    expect(fetchMock).toHaveBeenCalledWith('https://sender.4626.fun/send', expect.objectContaining({
      headers: expect.objectContaining({
        authorization: 'Bearer machine-secret',
        'idempotency-key': request.sourceEventDigest,
      }),
    }))
  })

  it('rejects an acknowledgement for a different payload', async () => {
    process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE = 'http'
    process.env.SOLANA_LOTTERY_OAPP_SEND_URL = 'https://sender.4626.fun/send'
    process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN = 'machine-secret'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      sourceEventDigest: request.sourceEventDigest,
      payloadHash: `0x${'00'.repeat(32)}`,
      lzGuid: `0x${'de'.repeat(32)}`,
      solanaSignature: '1'.repeat(64),
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    await expect(sendSolanaLotteryOappMessage(request)).rejects.toThrow(
      'solana_lottery_oapp_send_payload_ack_mismatch',
    )
  })
})
