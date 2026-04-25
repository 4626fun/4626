import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createMockReq, createMockRes } from './helpers'
import { requireAdminApiToken } from '../../packages/server-core/src/machine-auth.js'

/**
 * M-06 (audit 2026-04-25) regression coverage. The audit flagged that
 * admin-token boilerplate was duplicated across many handlers, with no
 * central enforcement point. This test pins the contract of the new shared
 * `requireAdminApiToken` helper so that any handler that migrates to it
 * gets the same gate semantics as the canonical implementation in
 * `frontend/api/_handlers/admin/arch-b/_subAccountProvision.ts`:
 *
 *   1. ADMIN_API_TOKEN unset → 500 (admin_token_missing) — fail closed
 *   2. Authorization header absent / non-Bearer → 401 (admin_token_invalid)
 *   3. Bearer token mismatched → 401 (admin_token_invalid)
 *   4. Constant-time compare under the hood (timingSafeEqual)
 *   5. Bearer token matches → returns true and writes nothing
 */

const SAVED_TOKEN = process.env.ADMIN_API_TOKEN

beforeEach(() => {
  delete process.env.ADMIN_API_TOKEN
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.ADMIN_API_TOKEN
  else process.env.ADMIN_API_TOKEN = SAVED_TOKEN
})

describe('requireAdminApiToken', () => {
  it('returns 500 admin_token_missing when ADMIN_API_TOKEN is unset', () => {
    const req = createMockReq({ headers: { authorization: 'Bearer anything' } })
    const res = createMockRes()
    const ok = requireAdminApiToken(req, res)
    expect(ok).toBe(false)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'admin_token_missing' })
  })

  it('returns 401 admin_token_invalid when the Authorization header is absent', () => {
    process.env.ADMIN_API_TOKEN = 'super-secret-admin-token'
    const req = createMockReq({})
    const res = createMockRes()
    const ok = requireAdminApiToken(req, res)
    expect(ok).toBe(false)
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'admin_token_invalid' })
  })

  it('returns 401 admin_token_invalid when the Bearer token is wrong', () => {
    process.env.ADMIN_API_TOKEN = 'super-secret-admin-token'
    const req = createMockReq({ headers: { authorization: 'Bearer not-the-token' } })
    const res = createMockRes()
    const ok = requireAdminApiToken(req, res)
    expect(ok).toBe(false)
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'admin_token_invalid' })
  })

  it('returns 401 admin_token_invalid for a token of different length than configured', () => {
    process.env.ADMIN_API_TOKEN = 'super-secret-admin-token'
    const req = createMockReq({ headers: { authorization: 'Bearer short' } })
    const res = createMockRes()
    const ok = requireAdminApiToken(req, res)
    expect(ok).toBe(false)
    expect(res.statusCode).toBe(401)
  })

  it('returns true on an exact-match Bearer token', () => {
    process.env.ADMIN_API_TOKEN = 'super-secret-admin-token'
    const req = createMockReq({ headers: { authorization: 'Bearer super-secret-admin-token' } })
    const res = createMockRes()
    const ok = requireAdminApiToken(req, res)
    expect(ok).toBe(true)
    // The helper MUST NOT touch the response on success.
    expect(res.statusCode).toBe(200)
  })

  it('honors caller-supplied error strings', () => {
    process.env.ADMIN_API_TOKEN = 'super-secret-admin-token'
    const req = createMockReq({ headers: { authorization: 'Bearer not-the-token' } })
    const res = createMockRes()
    const ok = requireAdminApiToken(req, res, {
      unauthorizedError: 'custom_unauthorized',
    })
    expect(ok).toBe(false)
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'custom_unauthorized' })
  })
})
