import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COOKIE_SESSION, makeSessionToken } from '../../server/auth/_shared.js'
import { createSiwaReceiptToken } from '../../server/auth/_siwa.js'
import { applyEnv, createMockReq } from './helpers'

import {
  readRequestPrincipal,
  readRequestPrincipalAddress,
  resolveAuthorizedRequestPrincipal,
} from '../../server/_lib/auth/requestPrincipal.js'

describe('request principal resolver', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    restoreEnv = applyEnv({
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
      SIWA_RECEIPT_SECRET: 'test-siwa-receipt-secret-1234567',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('prefers session over SIWA when both are present', () => {
    const session = makeSessionToken({ address: '0x0000000000000000000000000000000000000abc' })
    const receipt = createSiwaReceiptToken({
      address: '0x0000000000000000000000000000000000000def',
      agentId: 1,
      agentRegistry: 'eip155:8453:0x0000000000000000000000000000000000000123',
      chainId: 8453,
      verified: 'onchain',
    })
    expect(receipt).toBeTruthy()

    const req = createMockReq({
      method: 'GET',
      headers: {
        cookie: `${COOKIE_SESSION}=${encodeURIComponent(session)}`,
        authorization: `siwa ${receipt}`,
      },
    })

    const principal = readRequestPrincipal(req as any)
    expect(principal).toEqual({
      source: 'session',
      address: '0x0000000000000000000000000000000000000abc',
    })
  })

  it('returns null when session is missing and SIWA receipt is invalid', () => {
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'siwa invalid-receipt-token' },
    })

    const principal = readRequestPrincipal(req as any)
    expect(principal).toBeNull()
    expect(readRequestPrincipalAddress(req as any)).toBe('')
  })

  it('returns empty when neither principal exists', () => {
    const req = createMockReq({ method: 'GET' })

    expect(readRequestPrincipal(req as any)).toBeNull()
    expect(readRequestPrincipalAddress(req as any)).toBe('')
  })

  it('returns null when raw principal exists but is not currently authorized', async () => {
    const session = makeSessionToken({ address: '0x0000000000000000000000000000000000000abc' })
    const req = createMockReq({
      method: 'GET',
      headers: { cookie: `${COOKIE_SESSION}=${encodeURIComponent(session)}` },
    })

    await expect(resolveAuthorizedRequestPrincipal(req as any)).resolves.toBeNull()
  })
})
