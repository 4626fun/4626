import { createHmac } from 'node:crypto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq } from './helpers'

/**
 * Regression test for ex-SEV-002 (4626-415).
 *
 * Audit context: the CRE runtime HMAC signature check previously had a
 * config-level bypass. PR #318 (commit 847fee0) removed both the env-var
 * bypass (`CRE_RUNTIME_ALLOW_UNSIGNED_WHEN_HMAC_CONFIGURED`) and the
 * per-handler `allowUnsignedWhenHmacConfigured` flag from
 * `frontend/server/_lib/cre/runtimeBridge.ts`.
 *
 * These tests exercise the *real* `authenticateRuntimeRequest` (not mocked),
 * covering:
 *   1. positive path \u2014 valid bearer + valid HMAC signature passes
 *   2. negative path \u2014 missing sig headers rejected when HMAC secret configured
 *   3. negative path \u2014 invalid/tampered signature rejected
 *   4. bypass-removal guard (env) \u2014 setting the removed env flag has no effect
 *   5. bypass-removal guard (per-call) \u2014 the removed per-handler flag option
 *      is not part of the function's surface
 *
 * Assertions 4 and 5 are the core regression guards against SEV-002 reintroduction.
 *
 * Note: The existing `creRuntimeBridge.test.ts` file *mocks*
 * `authenticateRuntimeRequest`, so a reintroduction of either bypass would
 * not be caught by that suite. This file closes that gap.
 */

// Stub the DB surface used by `registerReplayNonce`. We always accept the nonce
// so the test focuses on signature behavior, not replay-store semantics.
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

// Imported after mocks so the SUT picks them up.
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

function signedHeadersFor({
  hmacSecret,
  apiKey,
  body,
  timestampMs = Date.now(),
  nonce = `nonce-${Math.random().toString(16).slice(2)}`,
  signatureOverride,
}: {
  hmacSecret: string
  apiKey: string
  body: unknown
  timestampMs?: number
  nonce?: string
  signatureOverride?: string
}) {
  const tsRaw = String(timestampMs)
  const canonical = stableJsonStringify(body)
  const signature =
    signatureOverride ??
    createHmac('sha256', hmacSecret).update(`${tsRaw}.${nonce}.${canonical}`).digest('hex')
  return {
    authorization: `Bearer ${apiKey}`,
    'x-cre-timestamp': tsRaw,
    'x-cre-nonce': nonce,
    'x-cre-signature': `sha256=${signature}`,
  }
}

describe('authenticateRuntimeRequest \u2014 HMAC-mandatory regression guard [ex-SEV-002]', () => {
  const KEEPR_API_KEY = 'unit-test-keepr-api-key'
  const HMAC_SECRET = 'unit-test-webhook-hmac-secret'
  let restoreEnv: () => void = () => {}

  beforeEach(() => {
    insertedRows.length = 0
    sqlMock.mockClear()
    restoreEnv = applyEnv({
      KEEPR_API_KEY,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
      // Explicitly unset on entry; individual tests set it to exercise the guard.
      CRE_RUNTIME_ALLOW_UNSIGNED_WHEN_HMAC_CONFIGURED: undefined,
    })
  })

  afterEach(() => {
    restoreEnv()
  })

  it('accepts a request with a valid bearer token and valid HMAC signature', async () => {
    const body = { workflow: 'runtime-indexer-block', nonce: 'abc', payload: { n: 1 } }
    const headers = signedHeadersFor({ hmacSecret: HMAC_SECRET, apiKey: KEEPR_API_KEY, body })
    const req = createMockReq({ method: 'POST', headers, body })

    const result = await authenticateRuntimeRequest(req, body)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.correlationId).toMatch(/^cre-runtime-|-/)
    }
  })

  it('rejects when the signature header is missing while HMAC secret is configured', async () => {
    const body = { workflow: 'runtime-indexer-block' }
    // Valid bearer, but no x-cre-* headers at all.
    const headers = { authorization: `Bearer ${KEEPR_API_KEY}` }
    const req = createMockReq({ method: 'POST', headers, body })

    const result = await authenticateRuntimeRequest(req, body)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toMatch(/Missing runtime request signature headers/)
    }
  })

  it('rejects when the signature is present but tampered/invalid', async () => {
    const body = { workflow: 'runtime-indexer-block' }
    const headers = signedHeadersFor({
      hmacSecret: HMAC_SECRET,
      apiKey: KEEPR_API_KEY,
      body,
      signatureOverride: 'deadbeef'.repeat(8), // 64 hex chars but wrong digest
    })
    const req = createMockReq({ method: 'POST', headers, body })

    const result = await authenticateRuntimeRequest(req, body)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toMatch(/Invalid runtime request signature/)
    }
  })

  it('rejects when bearer token is missing even if HMAC signature is valid', async () => {
    const body = { workflow: 'runtime-indexer-block' }
    const headers = signedHeadersFor({ hmacSecret: HMAC_SECRET, apiKey: KEEPR_API_KEY, body })
    // Blank out the authorization header to isolate the bearer path.
    delete (headers as Record<string, string | undefined>).authorization
    const req = createMockReq({ method: 'POST', headers, body })

    const result = await authenticateRuntimeRequest(req, body)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  // === REGRESSION GUARDS FOR THE REMOVED BYPASSES (SEV-002) ===

  it('ignores the removed CRE_RUNTIME_ALLOW_UNSIGNED_WHEN_HMAC_CONFIGURED env var', async () => {
    const bypassRestore = applyEnv({
      CRE_RUNTIME_ALLOW_UNSIGNED_WHEN_HMAC_CONFIGURED: 'true',
    })

    try {
      const body = { workflow: 'runtime-indexer-block' }
      // Unsigned: only bearer header, no x-cre-* headers.
      const headers = { authorization: `Bearer ${KEEPR_API_KEY}` }
      const req = createMockReq({ method: 'POST', headers, body })

      const result = await authenticateRuntimeRequest(req, body)

      // Must still be rejected. If this test ever flips to `ok: true`, the
      // env-var bypass has been reintroduced and SEV-002 is back.
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(401)
        expect(result.error).toMatch(/Missing runtime request signature headers/)
      }
    } finally {
      bypassRestore()
    }
  })

  it('exposes authenticateRuntimeRequest with a 2-arg surface only (no options/flag parameter)', () => {
    // The removed per-handler bypass used to arrive via a third options bag
    // (`RuntimeAuthOptions`). Pin the surface here so reintroducing the
    // parameter \u2014 even silently \u2014 trips this test at type/arity level.
    expect(typeof authenticateRuntimeRequest).toBe('function')
    expect(authenticateRuntimeRequest.length).toBe(2)
  })

  it('does not export a RuntimeAuthOptions type or allowUnsigned* member from the module', () => {
    // The following symbols were part of the legacy bypass API. The module
    // must not expose them anymore.
    const exported = Object.keys(runtimeBridgeModule)
    expect(exported).not.toContain('RuntimeAuthOptions')
    for (const name of exported) {
      expect(name.toLowerCase()).not.toContain('allowunsigned')
    }
  })
})
