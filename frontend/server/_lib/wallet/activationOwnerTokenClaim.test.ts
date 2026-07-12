import { describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import {
  assertActivationOwnerTokenClaimActive,
  consumeActivationOwnerTokenClaim,
  registerActivationOwnerTokenClaim,
} from './activationOwnerTokenClaim'

const CSW = getAddress('0x2222222222222222222222222222222222222222')
const SERVER = getAddress('0x3333333333333333333333333333333333333333')

describe('activationOwnerTokenClaim', () => {
  it('registers, asserts active, then consumes exactly once', async () => {
    const rowsByPhase: Array<{ rows: unknown[] }> = []
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join(' ')
      if (text.includes('INSERT INTO activation_owner_token_claims')) {
        rowsByPhase.push({ rows: [] })
        return { rows: [] }
      }
      if (text.includes('SELECT jti')) {
        return {
          rows: [{
            jti: values[0],
            consumed_at: null,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            profile_id: 42,
            privy_user_id: 'did:privy:user-1',
            parent_csw_address: CSW.toLowerCase(),
            server_owner_address: SERVER.toLowerCase(),
          }],
        }
      }
      if (text.includes('UPDATE activation_owner_token_claims')) {
        return { rows: [{ jti: values[0] }] }
      }
      return { rows: [] }
    })

    await registerActivationOwnerTokenClaim({ sql }, {
      jti: 'claim-jti-01',
      profileId: 42,
      privyUserId: 'did:privy:user-1',
      parentCswAddress: CSW,
      serverOwnerAddress: SERVER,
      expiresAtMs: Date.now() + 60_000,
    })

    await assertActivationOwnerTokenClaimActive({ sql }, {
      jti: 'claim-jti-01',
      profileId: 42,
      privyUserId: 'did:privy:user-1',
      parentCswAddress: CSW,
      serverOwnerAddress: SERVER,
    })

    await consumeActivationOwnerTokenClaim({ sql }, {
      jti: 'claim-jti-01',
      profileId: 42,
      privyUserId: 'did:privy:user-1',
    })

    expect(sql).toHaveBeenCalled()
  })

  it('rejects consumed and missing claims', async () => {
    await expect(
      assertActivationOwnerTokenClaimActive(
        {
          sql: vi.fn(async () => ({
            rows: [{
              jti: 'claim-jti-02',
              consumed_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 60_000).toISOString(),
              profile_id: 42,
              privy_user_id: 'did:privy:user-1',
              parent_csw_address: CSW.toLowerCase(),
              server_owner_address: SERVER.toLowerCase(),
            }],
          })),
        },
        {
          jti: 'claim-jti-02',
          profileId: 42,
          privyUserId: 'did:privy:user-1',
          parentCswAddress: CSW,
          serverOwnerAddress: SERVER,
        },
      ),
    ).rejects.toThrow('activation_token_already_consumed')

    await expect(
      assertActivationOwnerTokenClaimActive(
        { sql: vi.fn(async () => ({ rows: [] })) },
        {
          jti: 'claim-jti-missing',
          profileId: 42,
          privyUserId: 'did:privy:user-1',
          parentCswAddress: CSW,
          serverOwnerAddress: SERVER,
        },
      ),
    ).rejects.toThrow('activation_token_claim_missing')

    await expect(
      consumeActivationOwnerTokenClaim(
        { sql: vi.fn(async () => ({ rows: [] })) },
        {
          jti: 'claim-jti-03',
          profileId: 42,
          privyUserId: 'did:privy:user-1',
        },
      ),
    ).rejects.toThrow('activation_token_consume_failed')
  })
})
