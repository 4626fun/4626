import { afterEach, describe, expect, it } from 'vitest'

import { getClientIp } from './rateLimit.js'

const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  if (typeof originalNodeEnv === 'string') {
    process.env.NODE_ENV = originalNodeEnv
  } else {
    delete process.env.NODE_ENV
  }
})

describe('getClientIp', () => {
  it('prefers trusted vercel header in production', () => {
    process.env.NODE_ENV = 'production'
    const req = {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.10',
        'x-real-ip': '203.0.113.20',
        'x-forwarded-for': '198.51.100.77',
      },
    }
    expect(getClientIp(req)).toBe('203.0.113.10')
  })

  it('uses x-real-ip in production when vercel header missing', () => {
    process.env.NODE_ENV = 'production'
    const req = {
      headers: {
        'x-real-ip': '203.0.113.20',
        'x-forwarded-for': '198.51.100.77',
      },
    }
    expect(getClientIp(req)).toBe('203.0.113.20')
  })

  it('ignores cf-connecting-ip and uses x-real-ip in production when vercel header is missing', () => {
    process.env.NODE_ENV = 'production'
    const req = {
      headers: {
        'cf-connecting-ip': '198.51.100.22',
        'x-real-ip': '203.0.113.20',
        'x-forwarded-for': '198.51.100.77',
      },
    }
    expect(getClientIp(req)).toBe('203.0.113.20')
  })

  it('falls back to x-forwarded-for when stronger edge headers are absent', () => {
    process.env.NODE_ENV = 'production'
    const req = {
      headers: {
        'x-forwarded-for': '198.51.100.77, 10.0.0.1',
      },
    }
    expect(getClientIp(req)).toBe('198.51.100.77')
  })
})
