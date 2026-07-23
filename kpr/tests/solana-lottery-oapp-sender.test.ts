import { afterEach, describe, expect, it, vi } from 'vitest'
import { keccak256 } from 'viem'

import {
  resolveSolanaLotteryOappSender,
  type SolanaLotteryOappSendRequest,
} from '../utils/solanaLotteryOappSender.js'

const request: SolanaLotteryOappSendRequest = {
  payload: `0x${'12'.repeat(224)}`,
  sourceEventId: 'gen:program:signature:0:0',
  sourceEventDigest: `0x${'34'.repeat(32)}`,
  buyer: `0x${'56'.repeat(20)}`,
  tokenIn: `0x${'78'.repeat(20)}`,
  amount: 42n,
  peerBytes32: `0x${'9a'.repeat(32)}`,
  lotteryManager: `0x${'bc'.repeat(20)}`,
}

describe('kpr solanaLotteryOappSender', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE
    delete process.env.SOLANA_LOTTERY_OAPP_SEND_URL
    delete process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN
    delete process.env.KPR_API_KEY
  })

  it('fails closed when no sender is configured', async () => {
    await expect(resolveSolanaLotteryOappSender().send(request)).rejects.toThrow(
      'solana_lottery_oapp_sender_unconfigured',
    )
  })

  it('binds HTTP receipts to the exact event and payload', async () => {
    process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE = 'http'
    process.env.SOLANA_LOTTERY_OAPP_SEND_URL = 'https://sender.4626.fun/send'
    process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN = 'machine-secret'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      sourceEventDigest: request.sourceEventDigest,
      payloadHash: keccak256(request.payload),
      lzGuid: `0x${'de'.repeat(32)}`,
      solanaSignature: '1'.repeat(64),
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveSolanaLotteryOappSender().send(request)).resolves.toMatchObject({
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

  it('rejects mismatched event, payload, GUID, or Solana signature receipts', async () => {
    process.env.SOLANA_LOTTERY_OAPP_SENDER_MODE = 'http'
    process.env.SOLANA_LOTTERY_OAPP_SEND_URL = 'https://sender.4626.fun/send'
    process.env.SOLANA_LOTTERY_OAPP_SEND_TOKEN = 'machine-secret'

    const responses = [
      { sourceEventDigest: `0x${'35'.repeat(32)}`, payloadHash: keccak256(request.payload), lzGuid: `0x${'de'.repeat(32)}`, solanaSignature: '1'.repeat(64), error: 'source_event_ack_mismatch' },
      { sourceEventDigest: request.sourceEventDigest, payloadHash: `0x${'00'.repeat(32)}`, lzGuid: `0x${'de'.repeat(32)}`, solanaSignature: '1'.repeat(64), error: 'payload_ack_mismatch' },
      { sourceEventDigest: request.sourceEventDigest, payloadHash: keccak256(request.payload), lzGuid: 'not-a-guid', solanaSignature: '1'.repeat(64), error: 'invalid_lz_guid' },
      { sourceEventDigest: request.sourceEventDigest, payloadHash: keccak256(request.payload), lzGuid: `0x${'de'.repeat(32)}`, solanaSignature: 'not-a-solana-signature', error: 'invalid_solana_signature' },
    ]
    for (const item of responses) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(item), { status: 200 })))
      await expect(resolveSolanaLotteryOappSender().send(request)).rejects.toThrow(item.error)
      vi.unstubAllGlobals()
    }
  })
})
