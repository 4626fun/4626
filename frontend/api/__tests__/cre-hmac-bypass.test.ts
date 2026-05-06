import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq } from './helpers'

const sqlMock = vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => ({
  rows: [{ nonce: values[0] }],
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: vi.fn(async () => ({ sql: sqlMock })),
  isDbConfigured: vi.fn(() => true),
  getDbInitError: vi.fn(() => null),
}))

vi.mock('../../server/_lib/cre/runtimeSchema.js', () => ({
  ensureCreRuntimeSchema: vi.fn(async () => true),
}))

const { authenticateRuntimeRequest } = await import('../../server/_lib/cre/runtimeBridge.ts')

function stableJsonStringify(value: unknown): string {
  const clone = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(clone)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        out[key] = clone((v as Record<string, unknown>)[key])
      }
      return out
    }
    return v
  }
  return JSON.stringify(clone(value))
}

function signedHeaders(apiKey: string, hmacSecret: string, body: unknown, nonce = 'nonce-hmac-bypass') {
  const tsRaw = String(Date.now())
  const signature = createHmac('sha256', hmacSecret)
    .update(`${tsRaw}.${nonce}.${stableJsonStringify(body)}`)
    .digest('hex')
  return {
    authorization: `Bearer ${apiKey}`,
    'x-cre-timestamp': tsRaw,
    'x-cre-nonce': nonce,
    'x-cre-signature': `sha256=${signature}`,
  }
}

describe('CRE explicit intent: HMAC bypass is not available', () => {
  const KEEPR_API_KEY = 'test-keepr-key'
  const HMAC_SECRET = 'test-cre-hmac-secret'
  let restoreEnv: () => void

  beforeEach(() => {
    sqlMock.mockClear()
    restoreEnv = applyEnv({
      KEEPR_API_KEY,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
      CRE_RUNTIME_ALLOW_UNSIGNED_WHEN_HMAC_CONFIGURED: undefined,
    })
  })

  afterEach(() => restoreEnv())

  it('accepts bearer plus valid HMAC as the positive control', async () => {
    const body = { workflow: 'cre-positive', payload: { ok: true } }
    const req = createMockReq({
      method: 'POST',
      headers: signedHeaders(KEEPR_API_KEY, HMAC_SECRET, body),
      body,
    })

    await expect(authenticateRuntimeRequest(req, body)).resolves.toMatchObject({ ok: true })
  })

  it('rejects unsigned bearer requests when HMAC secret is configured', async () => {
    const body = { workflow: 'cre-unsigned' }
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: `Bearer ${KEEPR_API_KEY}` },
      body,
    })

    const result = await authenticateRuntimeRequest(req, body)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toMatch(/Missing runtime request signature headers/)
    }
  })

  it('ignores the removed env bypass flag', async () => {
    const restoreBypass = applyEnv({ CRE_RUNTIME_ALLOW_UNSIGNED_WHEN_HMAC_CONFIGURED: 'true' })
    try {
      const body = { workflow: 'cre-env-bypass' }
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: `Bearer ${KEEPR_API_KEY}` },
        body,
      })

      const result = await authenticateRuntimeRequest(req, body)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(401)
    } finally {
      restoreBypass()
    }
  })
})
