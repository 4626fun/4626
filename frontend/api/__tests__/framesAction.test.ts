import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readNeynarApiKeyMock } = vi.hoisted(() => ({
  readNeynarApiKeyMock: vi.fn(),
}))

vi.mock('../../server/_lib/neynarConfig.js', () => ({
  readNeynarApiKey: readNeynarApiKeyMock,
}))

vi.mock('../../server/_lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function mockRes(): any {
  const headers: Record<string, string> = {}
  return {
    statusCode: 200,
    body: null as any,
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value
      return this
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: any) {
      this.body = payload
      return this
    },
    send(payload: any) {
      this.body = payload
      return this
    },
    end(payload?: any) {
      this.body = payload
      return this
    },
  }
}

describe('frames/action validation modes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readNeynarApiKeyMock.mockReturnValue(null)
    delete process.env.FRAMES_VALIDATION_MODE
    delete process.env.APP_ENV
    delete process.env.VERCEL_ENV
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 } as any)))
  })

  it('rejects unverified actions in strict mode', async () => {
    process.env.FRAMES_VALIDATION_MODE = 'strict'
    const { default: handler } = await import('../_handlers/frames/_action.ts')
    const req: any = {
      method: 'POST',
      body: { untrustedData: { buttonIndex: 1, fid: 123 } },
      headers: {},
    }
    const res = mockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body.error).toContain('strict mode')
  })


  it('defaults to strict validation in preview/staging envs', async () => {
    process.env.VERCEL_ENV = 'preview'
    const { default: handler } = await import('../_handlers/frames/_action.ts')
    const req: any = {
      method: 'POST',
      body: { untrustedData: { buttonIndex: 1, fid: 123 } },
      headers: {},
    }
    const res = mockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
  })

  it('allows unverified actions in best-effort mode', async () => {
    process.env.FRAMES_VALIDATION_MODE = 'best-effort'
    const { default: handler } = await import('../_handlers/frames/_action.ts')
    const req: any = {
      method: 'POST',
      body: { untrustedData: { buttonIndex: 1, fid: 123 } },
      headers: {},
    }
    const res = mockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(String(res.body)).toContain('CreatorVault')
    expect(res.headers['x-frames-validation-mode']).toBe('best-effort')
    expect(res.headers['x-frames-validation-source']).toBe('untrusted')
    expect(String(res.body)).toContain('Join Waitlist')
  })

  it('embeds waitlist deep-link with fid and email when present', async () => {
    process.env.FRAMES_VALIDATION_MODE = 'best-effort'
    const { default: handler } = await import('../_handlers/frames/_action.ts')
    const req: any = {
      method: 'POST',
      body: {
        untrustedData: {
          buttonIndex: 1,
          fid: 777,
          inputText: 'Creator@Example.com',
          url: 'https://warpcast.com/~/frames/launch',
        },
      },
      headers: {},
    }
    const res = mockRes()

    await handler(req, res)

    const html = String(res.body)
    expect(res.statusCode).toBe(200)
    expect(html).toContain('fc:frame:button:1:target')
    expect(html).toContain('from=farcaster-frame')
    expect(html).toContain('fid=777')
    expect(html).toContain('email=creator%40example.com')
    expect(html).toContain('frame=https%3A%2F%2Fwarpcast.com%2F%7E%2Fframes%2Flaunch')
    expect(html).toContain('✅ Waitlist Joined')
    expect(html).toContain('You are on the waitlist')
    expect((globalThis.fetch as any)).toHaveBeenCalledWith(
      'https://4626.fun/api/waitlist',
      expect.objectContaining({ method: 'POST' }),
    )
  })


  it('dedupes repeated waitlist auto-submit requests within idempotency window', async () => {
    process.env.FRAMES_VALIDATION_MODE = 'best-effort'
    const { default: handler } = await import('../_handlers/frames/_action.ts')
    const req: any = {
      method: 'POST',
      body: {
        untrustedData: {
          buttonIndex: 1,
          fid: 777,
          inputText: 'creator+dedupe@example.com',
          url: 'https://warpcast.com/~/frames/launch',
        },
      },
      headers: {},
    }

    const res1 = mockRes()
    const res2 = mockRes()
    await handler(req, res1)
    await handler(req, res2)

    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(200)
    expect((globalThis.fetch as any)).toHaveBeenCalledTimes(1)
  })

  it('sets join error header when auto-submit fails', async () => {
    ;(globalThis.fetch as any).mockResolvedValueOnce({ ok: false, status: 503 })
    process.env.FRAMES_VALIDATION_MODE = 'best-effort'
    const { default: handler } = await import('../_handlers/frames/_action.ts')
    const req: any = {
      method: 'POST',
      body: {
        untrustedData: {
          buttonIndex: 1,
          fid: 777,
          inputText: 'creator@example.com',
        },
      },
      headers: {},
    }
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-frames-waitlist-join-error']).toBe('waitlist_503')
  })
})
