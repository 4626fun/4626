import { afterEach, describe, expect, it } from 'vitest'

import { getTrustedClientIp } from '../../debank/_shared.js'

const originalNodeEnv = process.env.NODE_ENV

function makeReq(params: {
  headers?: Record<string, string | string[] | undefined>
  remoteAddress?: string
}): any {
  return {
    headers: params.headers ?? {},
    socket: { remoteAddress: params.remoteAddress },
  }
}

afterEach(() => {
  if (typeof originalNodeEnv === 'string') {
    process.env.NODE_ENV = originalNodeEnv
  } else {
    delete process.env.NODE_ENV
  }
})

describe('getTrustedClientIp', () => {
  it('prefers x-vercel-forwarded-for over untrusted forwarded chain', () => {
    process.env.NODE_ENV = 'production'
    const req = makeReq({
      headers: {
        'x-vercel-forwarded-for': '203.0.113.10',
        'x-forwarded-for': '198.51.100.77',
      },
    })
    expect(getTrustedClientIp(req)).toBe('203.0.113.10')
  })

  it('uses x-real-ip in production when present', () => {
    process.env.NODE_ENV = 'production'
    const req = makeReq({
      headers: {
        'x-forwarded-for': '198.51.100.77',
        'x-real-ip': '203.0.113.20',
      },
    })
    expect(getTrustedClientIp(req)).toBe('203.0.113.20')
  })

  it('falls back to x-forwarded-for only outside production', () => {
    process.env.NODE_ENV = 'development'
    const req = makeReq({
      headers: {
        'x-forwarded-for': '198.51.100.77, 10.0.0.1',
      },
    })
    expect(getTrustedClientIp(req)).toBe('198.51.100.77')
  })
})
