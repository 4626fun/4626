import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'
import { getApiHandler } from '../_handlers/_routes.js'

const { readNeynarApiKeyMock, resolveMentionThroughElizaToolchainMock } = vi.hoisted(() => ({
  readNeynarApiKeyMock: vi.fn(),
  resolveMentionThroughElizaToolchainMock: vi.fn(),
}))

vi.mock('../../server/_lib/neynarConfig.js', () => ({
  readNeynarApiKey: readNeynarApiKeyMock,
}))

vi.mock('../../server/agent/eliza/mentionToolchain.js', () => ({
  resolveMentionThroughElizaToolchain: resolveMentionThroughElizaToolchainMock,
}))


function signPayload(payload: unknown, secret: string): string {
  const rawBody = JSON.stringify(payload)
  return createHmac('sha512', secret).update(rawBody).digest('hex')
}

describe('farcaster mention webhook', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('registers farcaster/mention in static route map', async () => {
    const handler = await getApiHandler('farcaster/mention')
    expect(typeof handler).toBe('function')
  })


  it('rejects requests when webhook secret is not configured', async () => {
    restoreEnv = applyEnv({ FC_MENTION_WEBHOOK_SECRET: undefined })
    const mod = await import('../_handlers/farcaster/_mention.ts')
    const req = createMockReq({
      method: 'POST',
      headers: {
        'x-neynar-signature': 'any-signature',
      },
      body: {
        type: 'cast.created',
        data: {
          hash: '0xcast',
          text: '@keepr status',
          author: { username: 'alice', fid: 123 },
        },
      },
    })
    const res = createMockRes()

    await mod.default(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Invalid signature' })
  })

  it('rejects invalid webhook signatures when secret is configured', async () => {
    restoreEnv = applyEnv({
      FC_MENTION_WEBHOOK_SECRET: 'secret-1',
    })
    const mod = await import('../_handlers/farcaster/_mention.ts')
    const req = createMockReq({
      method: 'POST',
      headers: {
        'x-neynar-signature': 'invalid-signature',
      },
      body: {
        type: 'cast.created',
        data: {
          hash: '0xcast',
          text: '@keepr status',
          author: { username: 'alice', fid: 123 },
        },
      },
    })
    const res = createMockRes()

    await mod.default(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Invalid signature' })
  })

  it('skips non cast.created events', async () => {
    restoreEnv = applyEnv({ FC_MENTION_WEBHOOK_SECRET: 'secret-1' })
    const mod = await import('../_handlers/farcaster/_mention.ts')
    const body = {
      type: 'cast.deleted',
    }
    const req = createMockReq({
      method: 'POST',
      headers: {
        'x-neynar-signature': signPayload(body, 'secret-1'),
      },
      body,
    })
    const res = createMockRes()

    await mod.default(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.skipped).toBe(true)
  })

  it('returns skipped when Neynar credentials are unavailable', async () => {
    readNeynarApiKeyMock.mockReturnValue(null)
    restoreEnv = applyEnv({
      FC_MENTION_WEBHOOK_SECRET: 'secret-1',
      NEYNAR_SIGNER_UUID: undefined,
    })
    const mod = await import('../_handlers/farcaster/_mention.ts')
    const body = {
      type: 'cast.created',
      data: {
        hash: '0xcast',
        text: '@keepr hello',
        author: { username: 'alice', fid: 123 },
      },
    }
    const req = createMockReq({
      method: 'POST',
      headers: {
        'x-neynar-signature': signPayload(body, 'secret-1'),
      },
      body,
    })
    const res = createMockRes()

    await mod.default(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      skipped: true,
      reason: 'neynar not configured',
    })
  })

  it('posts a threaded reply for valid mentions', async () => {
    readNeynarApiKeyMock.mockReturnValue('neynar-key')
    resolveMentionThroughElizaToolchainMock.mockResolvedValue('Toolchain response')
    restoreEnv = applyEnv({
      FC_MENTION_WEBHOOK_SECRET: 'secret-1',
      NEYNAR_SIGNER_UUID: 'signer-uuid-1',
    })
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          cast: { hash: '0xreply' },
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const mod = await import('../_handlers/farcaster/_mention.ts')
    const body = {
      type: 'cast.created',
      data: {
        hash: '0xparent',
        text: '@keepr status',
        author: { username: 'alice', fid: 123 },
      },
    }
    const req = createMockReq({
      method: 'POST',
      headers: {
        'x-neynar-signature': signPayload(body, 'secret-1'),
      },
      body,
    })
    const res = createMockRes()

    await mod.default(req, res)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resolveMentionThroughElizaToolchainMock).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      replyHash: '0xreply',
    })
  })
})

