import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  readTelegramToAlfaclubIngressHost,
  readTelegramWebhookHost,
  resolveTelegramWebhookIngressLane,
  shouldRelayTelegramToAlfaclubOnCanonicalWebhook,
} from '../_handlers/telegram/webhook/ingress.js'
import { resolveHermitTelegramWebhookPublicUrl } from '../_handlers/telegram/webhook/hermitWebhookUrl.js'
import { applyEnv, createMockReq, createMockRes } from './helpers.js'

const { relayTelegramMessageToAlfaClubMock, ingestProliquidSignalFromTelegramMock } = vi.hoisted(() => ({
  relayTelegramMessageToAlfaClubMock: vi.fn(),
  ingestProliquidSignalFromTelegramMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/telegramToAlfaclubRelay.js', () => ({
  relayTelegramMessageToAlfaClub: relayTelegramMessageToAlfaClubMock,
}))

vi.mock('../../server/_lib/alfaclub/proliquidSignals.js', () => ({
  readProliquidSignalConfig: vi.fn(() => ({
    enabled: true,
    webhookSecret: 'proliquid-secret',
    sources: [],
    destinationRoomId: '1043',
    textOnly: false,
    scorerBatchLimit: 50,
  })),
  ingestProliquidSignalFromTelegram: ingestProliquidSignalFromTelegramMock,
}))

describe('telegram webhook ingress', () => {
  it('resolves hermit lane from host header', () => {
    const env = { TELEGRAM_TO_ALFACLUB_INGRESS_HOST: 'hermit.4626.fun' }
    expect(
      resolveTelegramWebhookIngressLane({ headers: { host: 'hermit.4626.fun' } }, env),
    ).toBe('hermit')
    expect(resolveTelegramWebhookIngressLane({ headers: { host: '4626.fun' } }, env)).toBe(
      'canonical',
    )
  })

  it('prefers x-forwarded-host', () => {
    expect(
      readTelegramWebhookHost({
        headers: { 'x-forwarded-host': 'hermit.4626.fun', host: '4626.fun' },
      }),
    ).toBe('hermit.4626.fun')
  })

  it('disables canonical relay when ingress host is configured', () => {
    expect(shouldRelayTelegramToAlfaclubOnCanonicalWebhook({})).toBe(true)
    expect(
      shouldRelayTelegramToAlfaclubOnCanonicalWebhook({
        TELEGRAM_TO_ALFACLUB_INGRESS_HOST: 'hermit.4626.fun',
      }),
    ).toBe(false)
    expect(readTelegramToAlfaclubIngressHost({ TELEGRAM_TO_ALFACLUB_INGRESS_HOST: '' })).toBeNull()
  })

  it('prefers HERMIT_TELEGRAM_WEBHOOK_URL override for setWebhook target', () => {
    expect(
      resolveHermitTelegramWebhookPublicUrl({
        TELEGRAM_TO_ALFACLUB_INGRESS_HOST: 'hermit.4626.fun',
        HERMIT_TELEGRAM_WEBHOOK_URL: 'https://app.4626.fun/api/telegram/hermit-webhook',
      }),
    ).toBe('https://app.4626.fun/api/telegram/hermit-webhook')
    expect(
      resolveHermitTelegramWebhookPublicUrl({
        TELEGRAM_TO_ALFACLUB_INGRESS_HOST: 'hermit.4626.fun',
      }),
    ).toBe('https://hermit.4626.fun/api/telegram/webhook')
  })
})

describe('hermit.4626.fun webhook ingress', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    vi.clearAllMocks()
    restoreEnv?.()
    restoreEnv = null
  })

  it('accepts Hermit secret on hermit host and relays without akitai secret', async () => {
    relayTelegramMessageToAlfaClubMock.mockResolvedValue({
      status: 'relayed',
      roomId: '1043',
      lane: 'bot_token_without_reply_id',
    })
    restoreEnv = applyEnv({
      TELEGRAM_BOT_TOKEN: 'akitai-token',
      TELEGRAM_WEBHOOK_SECRET: 'akitai-only-secret',
      TELEGRAM_TO_ALFACLUB_INGRESS_HOST: 'hermit.4626.fun',
      ALFACLUB_TELEGRAM_WEBHOOK_SECRET: 'hermit-only-secret',
      ALFACLUB_TELEGRAM_BOT_TOKEN: 'hermit-token',
    })

    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const req = createMockReq({
      method: 'POST',
      headers: {
        host: 'hermit.4626.fun',
        'x-telegram-bot-api-secret-token': 'hermit-only-secret',
      },
      body: {
        update_id: 99,
        message: {
          message_id: 7,
          text: '/alfa status',
          message_thread_id: 2,
          chat: { id: -1003709479662 },
          from: { id: 42, username: 'akitav' },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.alfaclubRelay?.roomId).toBe('1043')
    expect(relayTelegramMessageToAlfaClubMock).toHaveBeenCalledTimes(1)
  })

  it('rejects akitai webhook secret on hermit host', async () => {
    restoreEnv = applyEnv({
      TELEGRAM_BOT_TOKEN: 'akitai-token',
      TELEGRAM_WEBHOOK_SECRET: 'akitai-only-secret',
      TELEGRAM_TO_ALFACLUB_INGRESS_HOST: 'hermit.4626.fun',
      ALFACLUB_TELEGRAM_WEBHOOK_SECRET: 'hermit-only-secret',
      ALFACLUB_TELEGRAM_BOT_TOKEN: 'hermit-token',
    })

    const { default: handler } = await import('../_handlers/telegram/_webhook.ts')
    const req = createMockReq({
      method: 'POST',
      headers: {
        host: 'hermit.4626.fun',
        'x-telegram-bot-api-secret-token': 'akitai-only-secret',
      },
      body: {
        update_id: 1,
        message: {
          message_id: 7,
          text: '/alfa status',
          chat: { id: -1003709479662 },
          from: { id: 42 },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(relayTelegramMessageToAlfaClubMock).not.toHaveBeenCalled()
  })
})

describe('proliquid webhook ingress', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('accepts valid secret and stores assistive signal', async () => {
    ingestProliquidSignalFromTelegramMock.mockResolvedValueOnce({
      status: 'stored',
      signalKind: 'whales',
    })

    const { default: handler } = await import('../_handlers/telegram/_proliquid-webhook.ts')
    const req = createMockReq({
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'proliquid-secret',
      },
      body: {
        update_id: 999,
        message: {
          message_id: 101,
          text: 'BTC > 10M$',
          chat: { id: -100123, username: 'proliquid_whales' },
          from: { id: 42, username: 'signalbot' },
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.ingest?.status).toBe('stored')
    expect(res.body?.data?.ingest?.signalKind).toBe('whales')
    expect(ingestProliquidSignalFromTelegramMock).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid secret', async () => {
    const { default: handler } = await import('../_handlers/telegram/_proliquid-webhook.ts')
    const req = createMockReq({
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'wrong-secret',
      },
      body: {
        update_id: 1000,
        message: {
          message_id: 12,
          text: 'ETH > 350k$',
          chat: { id: -100123, username: 'proliquid_liquidations' },
          from: { id: 42, username: 'signalbot' },
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(ingestProliquidSignalFromTelegramMock).not.toHaveBeenCalled()
  })
})
