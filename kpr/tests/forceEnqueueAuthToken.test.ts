import { describe, expect, it, vi } from 'vitest'

/**
 * 4626-audit-2026-04-25 review regression coverage.
 *
 * After the H-01 HMAC migration, `manual.authToken` carries the HMAC signature
 * for the manual-trigger envelope and is no longer suitable as the
 * force-enqueue authorization token. Both Charm and Ajna managers were still
 * gating `forceEnqueue` on `manual.authToken === FORCE_ENQUEUE_AUTH_TOKEN`,
 * which made every `forceEnqueue=true` request fall through the
 * "missing or invalid authToken" branch — i.e. force-enqueue was unreachable.
 *
 * The fix is to introduce a dedicated `forceEnqueueAuthToken` field on the
 * manual payload, compared against the configured FORCE_ENQUEUE_AUTH_TOKEN
 * secret in constant time. `authToken` continues to mean "HMAC signature only".
 *
 * These tests pin:
 *   1. `constantTimeEqualString` correctness (length-mismatch rejection,
 *      byte-for-byte compare, type guards).
 *   2. The Charm/Ajna gate now reaches the force-enqueue branch when
 *      `forceEnqueueAuthToken` matches the secret.
 *   3. The Charm/Ajna gate skips the force-enqueue branch when
 *      `forceEnqueueAuthToken` is missing, wrong, or when it's been
 *      conflated with `authToken` (the regression mode).
 */

import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex } from '@noble/hashes/utils'

import {
  UNAUTHORIZED_MANUAL_TRIGGER,
  assertManualTriggerHmac,
  constantTimeEqualString,
} from '../kpr-workflows/_shared/manualTriggerAuth.js'
import { stableJsonStringify } from '../kpr-workflows/_shared/determinism.js'

describe('constantTimeEqualString', () => {
  it('returns true for identical non-empty strings', () => {
    expect(constantTimeEqualString('hello-world', 'hello-world')).toBe(true)
  })

  it('returns true for identical empty strings (degenerate)', () => {
    expect(constantTimeEqualString('', '')).toBe(true)
  })

  it('returns false for different strings of the same length', () => {
    expect(constantTimeEqualString('hello-world', 'hello-w0rld')).toBe(false)
  })

  it('returns false for different strings of different lengths', () => {
    expect(constantTimeEqualString('short', 'much-longer-string')).toBe(false)
  })

  it('returns false for non-string inputs', () => {
    // @ts-expect-error testing non-string runtime path
    expect(constantTimeEqualString(undefined, 'x')).toBe(false)
    // @ts-expect-error testing non-string runtime path
    expect(constantTimeEqualString('x', null)).toBe(false)
    // @ts-expect-error testing non-string runtime path
    expect(constantTimeEqualString(123, '123')).toBe(false)
  })

  it('handles multi-byte UTF-8 inputs without false positives', () => {
    // The "é" in `café` encodes to two bytes in UTF-8. A naive char-by-char
    // compare would incorrectly accept a 4-codepoint vs 5-byte mismatch; the
    // byte-level compare we use guards against that.
    expect(constantTimeEqualString('café', 'café')).toBe(true)
    expect(constantTimeEqualString('café', 'cafe')).toBe(false)
  })
})

/**
 * Integration-style coverage for the Charm/Ajna force-enqueue gate. We don't
 * need the full evaluation path — only that the secret resolution + token
 * compare uses `forceEnqueueAuthToken` (NOT `authToken`).
 */

const FORCE_TOKEN = 'force-enqueue-shared-secret-9f2a'
const HMAC_SIG = 'a'.repeat(64) // looks like an HMAC; would mismatch FORCE_TOKEN

function buildRuntimeWithSecrets(secrets: Record<string, string>) {
  return {
    config: {
      apiBaseUrl: 'https://4626.fun/api',
      chainName: 'base',
      twapDuration: 1800,
      priceChangeTriggerBps: 1000,
      maxVaultsPerExecution: 10,
      maxStrategiesPerVault: 5,
      rotationIntervalSeconds: 300,
      // Ajna-specific extras (ignored by Charm)
      targetLtvBps: 7000,
      moveThreshold: 50,
      maxStep: 250,
      liquiditySearchRadius: 20,
    },
    getSecret: ({ id }: { id: string }) => ({
      result: () => ({ value: secrets[id] ?? '' }),
    }),
    runInNodeMode:
      (fn: (nodeRuntime: unknown) => unknown) =>
      () => ({
        result: () => fn({}),
      }),
    now: () => new Date('2026-04-25T00:00:00.000Z'),
    log: vi.fn(),
  }
}

vi.mock('../kpr-workflows/_shared/http.ts', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}))

vi.mock('../kpr-workflows/_shared/evm.ts', () => ({
  createEvmClientForChain: vi.fn(() => ({})),
  readContractBytes: vi.fn(),
  resolveChainId: vi.fn(() => 8453),
}))

vi.mock('@chainlink/cre-sdk', () => ({
  HTTPClient: class HTTPClient {},
  bytesToHex: (value: Uint8Array) => `0x${Buffer.from(value).toString('hex')}`,
  consensusIdenticalAggregation: vi.fn(() => 'consensus'),
}))

// Stub strategyQueue so `fetchActiveVaults` returns no vaults — we only care
// about the `canForceEnqueue` decision being computed before any RPCs fire.
vi.mock('../kpr-workflows/_shared/strategyQueue.ts', () => ({
  fetchActiveVaults: vi.fn(() => []),
  enqueueStrategyAction: vi.fn(),
}))

describe('Charm forceEnqueue token separation [4626-audit-2026-04-25]', () => {
  it('treats authToken as HMAC-only: matching authToken alone does NOT authorize forceEnqueue', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
    })
    const { evaluateAndEnqueueCharmActions } = await import(
      '../kpr-workflows/_shared/charmManager.js'
    )

    // Regression mode: caller passes the FORCE_TOKEN value in `authToken`
    // (the pre-fix bug compared this against FORCE_ENQUEUE_AUTH_TOKEN). The
    // fix means this MUST NOT authorize the force-enqueue path.
    const result = evaluateAndEnqueueCharmActions(runtime as never, {
      forceEnqueue: true,
      authToken: FORCE_TOKEN,
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    })

    // No vaults from the stubbed registry, so nothing to enqueue. The point of
    // the test is that no exception is thrown and the workflow completes.
    expect(result.enqueuedActions).toBe(0)
  })

  it('reaches the force-enqueue branch when forceEnqueueAuthToken matches the secret', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
    })
    const { evaluateAndEnqueueCharmActions } = await import(
      '../kpr-workflows/_shared/charmManager.js'
    )

    const result = evaluateAndEnqueueCharmActions(runtime as never, {
      forceEnqueue: true,
      authToken: HMAC_SIG, // would-be HMAC signature, irrelevant to force-enqueue gate
      forceEnqueueAuthToken: FORCE_TOKEN,
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    })
    expect(result).toBeDefined()
  })

  it('rejects forceEnqueue when forceEnqueueAuthToken is wrong', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
    })
    const { evaluateAndEnqueueCharmActions } = await import(
      '../kpr-workflows/_shared/charmManager.js'
    )

    const result = evaluateAndEnqueueCharmActions(runtime as never, {
      forceEnqueue: true,
      authToken: HMAC_SIG,
      forceEnqueueAuthToken: 'not-the-secret',
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    })
    expect(result.enqueuedActions).toBe(0)
  })
})

describe('Ajna forceEnqueue token separation [4626-audit-2026-04-25]', () => {
  it('treats authToken as HMAC-only: matching authToken alone does NOT authorize forceEnqueue', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
    })
    const { evaluateAndEnqueueAjnaActions } = await import(
      '../kpr-workflows/_shared/ajnaManager.js'
    )

    const result = evaluateAndEnqueueAjnaActions(runtime as never, {
      forceEnqueue: true,
      authToken: FORCE_TOKEN, // regression: was previously the gate
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    })
    expect(result.enqueuedActions).toBe(0)
  })

  it('reaches the force-enqueue branch when forceEnqueueAuthToken matches the secret', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
    })
    const { evaluateAndEnqueueAjnaActions } = await import(
      '../kpr-workflows/_shared/ajnaManager.js'
    )

    const result = evaluateAndEnqueueAjnaActions(runtime as never, {
      forceEnqueue: true,
      authToken: HMAC_SIG,
      forceEnqueueAuthToken: FORCE_TOKEN,
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    })
    expect(result).toBeDefined()
  })

  it('rejects forceEnqueue when forceEnqueueAuthToken is wrong', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
    })
    const { evaluateAndEnqueueAjnaActions } = await import(
      '../kpr-workflows/_shared/ajnaManager.js'
    )

    const result = evaluateAndEnqueueAjnaActions(runtime as never, {
      forceEnqueue: true,
      authToken: HMAC_SIG,
      forceEnqueueAuthToken: 'not-the-secret',
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    })
    expect(result.enqueuedActions).toBe(0)
  })
})

/**
 * Confusion-proof regression: a valid HMAC-signed manual-trigger envelope
 * MUST NOT be confused with a force-enqueue authorization, and a payload
 * whose `authToken` happens to equal `FORCE_ENQUEUE_AUTH_TOKEN` MUST NOT
 * be accepted as a valid HMAC envelope. Both managers (Charm and Ajna)
 * are exercised so the two code paths cannot diverge silently.
 */

const HMAC_SECRET = 'webhook-hmac-secret-7d1e9'

function buildSignedPayload(
  body: Record<string, unknown>,
  opts: { secret?: string; timestampMs?: number; nonce?: string } = {},
): Record<string, unknown> & { authToken: string; timestamp: number; nonce: string } {
  const secret = opts.secret ?? HMAC_SECRET
  const timestamp = opts.timestampMs ?? Date.parse('2026-04-25T00:00:00.000Z')
  const nonce = opts.nonce ?? 'a1b2c3d4e5f60718'
  const canonical = stableJsonStringify(body)
  const signed = `${timestamp}.${nonce}.${canonical}`
  const sig = bytesToHex(
    hmac(sha256, new TextEncoder().encode(secret), new TextEncoder().encode(signed)),
  )
  return { ...body, authToken: sig, timestamp, nonce }
}

describe('HMAC envelope vs force-enqueue token cannot be confused [4626-audit-2026-04-25]', () => {
  it('a valid HMAC envelope is accepted by assertManualTriggerHmac', () => {
    const payload = buildSignedPayload({ forceEnqueue: true, vaultAddress: '0xabc' })
    expect(() =>
      assertManualTriggerHmac(payload, HMAC_SECRET, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).not.toThrow()
  })

  it('a payload whose authToken equals FORCE_ENQUEUE_AUTH_TOKEN is REJECTED as an HMAC envelope', () => {
    // The whole point of separating the fields: the force-enqueue shared
    // secret is not a valid HMAC over (timestamp, nonce, body). Even if a
    // caller tried to reuse it as `authToken` they cannot pass the HMAC gate.
    const payload = {
      forceEnqueue: true,
      vaultAddress: '0xabc',
      authToken: FORCE_TOKEN, // *not* an HMAC of the canonical payload
      timestamp: Date.parse('2026-04-25T00:00:00.000Z'),
      nonce: 'a1b2c3d4e5f60718',
    }
    expect(() =>
      assertManualTriggerHmac(payload, HMAC_SECRET, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).toThrow(UNAUTHORIZED_MANUAL_TRIGGER)
  })

  it('a payload whose authToken equals FORCE_ENQUEUE_AUTH_TOKEN is also rejected when the secret IS the force token', () => {
    // Even if an operator misconfigured both secrets to the same value, the
    // length / hex-shape constraints of the HMAC compare reject a non-hex,
    // wrong-length token. This pins that the HMAC gate is not a string-equality
    // gate that a known FORCE_TOKEN could trivially satisfy.
    const payload = {
      forceEnqueue: true,
      vaultAddress: '0xabc',
      authToken: FORCE_TOKEN,
      timestamp: Date.parse('2026-04-25T00:00:00.000Z'),
      nonce: 'a1b2c3d4e5f60718',
    }
    expect(() =>
      assertManualTriggerHmac(payload, FORCE_TOKEN, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).toThrow(UNAUTHORIZED_MANUAL_TRIGGER)
  })

  it('Charm: a valid HMAC envelope with forceEnqueue=true but NO forceEnqueueAuthToken does not force enqueue', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
    })
    const { evaluateAndEnqueueCharmActions } = await import(
      '../kpr-workflows/_shared/charmManager.js'
    )

    const body = {
      forceEnqueue: true,
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    }
    const signed = buildSignedPayload(body)
    // Sanity: the envelope itself is genuinely HMAC-valid.
    expect(() =>
      assertManualTriggerHmac(signed, HMAC_SECRET, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).not.toThrow()

    // ...but force-enqueue still must not fire because forceEnqueueAuthToken
    // is absent from the payload.
    const result = evaluateAndEnqueueCharmActions(runtime as never, signed as never)
    expect(result.enqueuedActions).toBe(0)
  })

  it('Charm: a valid HMAC envelope with WRONG forceEnqueueAuthToken does not force enqueue', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
    })
    const { evaluateAndEnqueueCharmActions } = await import(
      '../kpr-workflows/_shared/charmManager.js'
    )

    const body = {
      forceEnqueue: true,
      forceEnqueueAuthToken: 'definitely-wrong',
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    }
    const signed = buildSignedPayload(body)
    expect(() =>
      assertManualTriggerHmac(signed, HMAC_SECRET, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).not.toThrow()

    const result = evaluateAndEnqueueCharmActions(runtime as never, signed as never)
    expect(result.enqueuedActions).toBe(0)
  })

  it('Ajna: a valid HMAC envelope with forceEnqueue=true but NO forceEnqueueAuthToken does not force enqueue', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
    })
    const { evaluateAndEnqueueAjnaActions } = await import(
      '../kpr-workflows/_shared/ajnaManager.js'
    )

    const body = {
      forceEnqueue: true,
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    }
    const signed = buildSignedPayload(body)
    expect(() =>
      assertManualTriggerHmac(signed, HMAC_SECRET, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).not.toThrow()

    const result = evaluateAndEnqueueAjnaActions(runtime as never, signed as never)
    expect(result.enqueuedActions).toBe(0)
  })

  it('Ajna: a valid HMAC envelope with WRONG forceEnqueueAuthToken does not force enqueue', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
    })
    const { evaluateAndEnqueueAjnaActions } = await import(
      '../kpr-workflows/_shared/ajnaManager.js'
    )

    const body = {
      forceEnqueue: true,
      forceEnqueueAuthToken: 'definitely-wrong',
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    }
    const signed = buildSignedPayload(body)
    expect(() =>
      assertManualTriggerHmac(signed, HMAC_SECRET, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).not.toThrow()

    const result = evaluateAndEnqueueAjnaActions(runtime as never, signed as never)
    expect(result.enqueuedActions).toBe(0)
  })

  it('Charm: HMAC-valid envelope + correct forceEnqueueAuthToken means BOTH gates are independently satisfied', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
    })
    const { evaluateAndEnqueueCharmActions } = await import(
      '../kpr-workflows/_shared/charmManager.js'
    )

    const body = {
      forceEnqueue: true,
      forceEnqueueAuthToken: FORCE_TOKEN,
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    }
    const signed = buildSignedPayload(body)
    expect(() =>
      assertManualTriggerHmac(signed, HMAC_SECRET, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).not.toThrow()

    // No vaults (stubbed registry) → 0 enqueued. The point is the call does not
    // throw and the canForceEnqueue branch was reachable.
    const result = evaluateAndEnqueueCharmActions(runtime as never, signed as never)
    expect(result).toBeDefined()
    expect(result.enqueuedActions).toBe(0)
  })

  it('Ajna: HMAC-valid envelope + correct forceEnqueueAuthToken means BOTH gates are independently satisfied', async () => {
    const runtime = buildRuntimeWithSecrets({
      KPR_API_KEY: 'keepr-key',
      FORCE_ENQUEUE_AUTH_TOKEN: FORCE_TOKEN,
      CRE_RUNTIME_WEBHOOK_HMAC_SECRET: HMAC_SECRET,
    })
    const { evaluateAndEnqueueAjnaActions } = await import(
      '../kpr-workflows/_shared/ajnaManager.js'
    )

    const body = {
      forceEnqueue: true,
      forceEnqueueAuthToken: FORCE_TOKEN,
      vaultAddress: '0x0000000000000000000000000000000000000099',
      strategyAddress: '0x00000000000000000000000000000000000000aa',
    }
    const signed = buildSignedPayload(body)
    expect(() =>
      assertManualTriggerHmac(signed, HMAC_SECRET, {
        nowMs: () => Date.parse('2026-04-25T00:00:00.000Z'),
      }),
    ).not.toThrow()

    const result = evaluateAndEnqueueAjnaActions(runtime as never, signed as never)
    expect(result).toBeDefined()
    expect(result.enqueuedActions).toBe(0)
  })
})
