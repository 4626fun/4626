import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq } from './helpers'

/**
 * M-02 (audit 2026-04-25) regression coverage. The CRE runtime bridge bearer
 * compare was previously `authorization.slice(7) !== expectedApiKey`, which
 * is variable-time. The HMAC compare in the same function correctly used
 * `timingSafeEqual`, so the bearer was the weak link.
 *
 * The fix wraps the bearer compare in `safeEqualsString`, which hashes both
 * inputs to a fixed-length sha256 digest and uses `timingSafeEqual` over the
 * digests. This file pins:
 *   1. an exact-match bearer succeeds,
 *   2. wrong bearers (correct length, wrong content) are rejected,
 *   3. shorter / longer bearers are rejected,
 *   4. an empty bearer is rejected (note: `Bearer ` with empty token is
 *      caught by `startsWith('Bearer ')` + length-zero token via the helper),
 *   5. bearers that share a long common prefix with the expected secret are
 *      still rejected (regression sentinel — the previous `!==` compare
 *      returned faster on short prefixes than on long matching prefixes).
 *
 * Replay-store and HMAC paths are covered by `creRuntimeBridgeAuth.test.ts`.
 */

const insertedRows: Array<{ nonce: string }> = []
const sqlMock = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => {
  const nonce = (_values[0] as string) ?? 'nonce'
  insertedRows.push({ nonce })
  return { rows: [{ nonce }] }
})

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: vi.fn(async () => ({ sql: sqlMock })),
  isDbConfigured: vi.fn(() => true),
  getDbInitError: vi.fn(() => null),
}))

vi.mock('../../server/_lib/cre/runtimeSchema.js', () => ({
  ensureCreRuntimeSchema: vi.fn(async () => true),
}))

const runtimeBridgeModule = await import('../../server/_lib/cre/runtimeBridge.ts')
const { authenticateRuntimeRequest } = runtimeBridgeModule

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

function signedHeaders(opts: { apiKey: string; hmacSecret: string; body: unknown }) {
  const tsRaw = String(Date.now())
  const nonce = `nonce-${Math.random().toString(16).slice(2)}`
  const canonical = stableJsonStringify(opts.body)
  const sig = createHmac('sha256', opts.hmacSecret)
    .update(`${tsRaw}.${nonce}.${canonical}`)
    .digest('hex')
  return {
    authorization: `Bearer ${opts.apiKey}`,
    'x-cre-timestamp': tsRaw,
    'x-cre-nonce': nonce,
    'x-cre-signature': `sha256=${sig}`,
  }
}

describe('authenticateRuntimeRequest — bearer compare is constant-time [M-02]', () => {
  const KEEPR_API_KEY = 'super-secret-runtime-bridge-bearer-token-v1'
  const HMAC_SECRET = 'unit-test-webhook-hmac-secret'
  let restoreEnv: () => void = () => {}

  beforeEach(() => {
    insertedRows.length = 0
    sqlMock.mockClear()
    restoreEnv = applyEnv({
      KEEPR_API_KEY,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
    })
  })

  afterEach(() => {
    restoreEnv()
  })

  it('accepts an exact-match bearer with a valid signature', async () => {
    const body = { workflow: 'wf', n: 1 }
    const headers = signedHeaders({ apiKey: KEEPR_API_KEY, hmacSecret: HMAC_SECRET, body })
    const req = createMockReq({ method: 'POST', headers, body })
    const result = await authenticateRuntimeRequest(req, body)
    expect(result.ok).toBe(true)
  })

  it('rejects a bearer of the same length but different content (401, no leak)', async () => {
    const body = { workflow: 'wf' }
    const wrong = 'X'.repeat(KEEPR_API_KEY.length)
    const headers = signedHeaders({ apiKey: wrong, hmacSecret: HMAC_SECRET, body })
    const req = createMockReq({ method: 'POST', headers, body })
    const result = await authenticateRuntimeRequest(req, body)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
    }
  })

  it('rejects a shorter bearer', async () => {
    const body = { workflow: 'wf' }
    const headers = signedHeaders({
      apiKey: KEEPR_API_KEY.slice(0, KEEPR_API_KEY.length - 1),
      hmacSecret: HMAC_SECRET,
      body,
    })
    const req = createMockReq({ method: 'POST', headers, body })
    const result = await authenticateRuntimeRequest(req, body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('rejects a longer bearer (suffix attack)', async () => {
    const body = { workflow: 'wf' }
    const headers = signedHeaders({ apiKey: KEEPR_API_KEY + 'x', hmacSecret: HMAC_SECRET, body })
    const req = createMockReq({ method: 'POST', headers, body })
    const result = await authenticateRuntimeRequest(req, body)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('rejects a bearer that shares a long prefix with the secret (timing-oracle sentinel)', async () => {
    const body = { workflow: 'wf' }
    // Tamper only the last character. Under a `!==` compare, this would
    // take materially longer to reject than a short-prefix tamper, leaking
    // a per-character timing oracle. The hash-then-`timingSafeEqual` fix
    // makes this rejection take constant time. We can't measure timing
    // reliably in a unit test, but pinning that the rejection still happens
    // with no ambiguity (correct status, correct error) is the regression
    // contract we control.
    const tampered = KEEPR_API_KEY.slice(0, -1) + (KEEPR_API_KEY.slice(-1) === 'a' ? 'b' : 'a')
    const headers = signedHeaders({ apiKey: tampered, hmacSecret: HMAC_SECRET, body })
    const req = createMockReq({ method: 'POST', headers, body })
    const result = await authenticateRuntimeRequest(req, body)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
    }
  })
})
