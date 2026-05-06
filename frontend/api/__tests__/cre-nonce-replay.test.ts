import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq } from './helpers'

let inserted = false
const sqlMock = vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
  if (inserted) return { rows: [] }
  inserted = true
  return { rows: [{ nonce: values[0] }] }
})

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

function signedHeaders(apiKey: string, hmacSecret: string, body: unknown, nonce: string) {
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

describe('CRE explicit intent: durable nonce replay guard', () => {
  const KEEPR_API_KEY = 'test-keepr-key'
  const HMAC_SECRET = 'test-cre-hmac-secret'
  let restoreEnv: () => void

  beforeEach(() => {
    inserted = false
    sqlMock.mockClear()
    restoreEnv = applyEnv({
      KEEPR_API_KEY,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
    })
  })

  afterEach(() => restoreEnv())

  it('rejects the second signed request with the same nonce', async () => {
    const body = { workflow: 'nonce-replay', payload: { n: 1 } }
    const nonce = 'shared-cross-instance-nonce'
    const first = createMockReq({
      method: 'POST',
      headers: signedHeaders(KEEPR_API_KEY, HMAC_SECRET, body, nonce),
      body,
    })
    const second = createMockReq({
      method: 'POST',
      headers: signedHeaders(KEEPR_API_KEY, HMAC_SECRET, body, nonce),
      body,
    })

    await expect(authenticateRuntimeRequest(first, body)).resolves.toMatchObject({ ok: true })
    const replay = await authenticateRuntimeRequest(second, body)

    expect(replay.ok).toBe(false)
    if (!replay.ok) {
      expect(replay.status).toBe(409)
      expect(replay.error).toBe('Replay nonce already used')
    }
    expect(sqlMock).toHaveBeenCalledTimes(2)
  })
})
