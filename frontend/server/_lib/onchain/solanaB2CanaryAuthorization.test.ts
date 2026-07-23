import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeSolanaB2CanaryAuthorization } from './solanaB2CanaryAuthorization.js'

describe('single-use B2 canary authorization', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('consumes exactly one matching unexpired source event', async () => {
    vi.stubEnv('SOLANA_B2_CANARY_AUTHORIZATION_ENABLED', '1')
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ')
      expect(query).toContain("status = 'authorized'")
      expect(query).toContain('expires_at > NOW()')
      return { rows: [{ id: 1 }] }
    })
    await expect(consumeSolanaB2CanaryAuthorization({ db: { sql }, sourceEventId: 'g:p:s:0:0', shareMeshMint: 'mint' })).resolves.toBe(true)
  })

  it('fails closed after the authorization is absent or consumed', async () => {
    vi.stubEnv('SOLANA_B2_CANARY_AUTHORIZATION_ENABLED', '1')
    const sql = vi.fn(async () => ({ rows: [] }))
    await expect(consumeSolanaB2CanaryAuthorization({ db: { sql }, sourceEventId: 'g:p:s:0:0', shareMeshMint: 'mint' })).resolves.toBe(false)
  })

  it('does not consume an authorization when the runtime gate is disabled', async () => {
    const sql = vi.fn(async () => ({ rows: [{ id: 1 }] }))
    await expect(consumeSolanaB2CanaryAuthorization({ db: { sql }, sourceEventId: 'g:p:s:0:0', shareMeshMint: 'mint' })).resolves.toBe(false)
    expect(sql).not.toHaveBeenCalled()
  })
})
