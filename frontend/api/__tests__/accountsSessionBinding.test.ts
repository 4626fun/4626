import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readSessionFromRequestMock } = vi.hoisted(() => ({
  readSessionFromRequestMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  readSessionFromRequest: readSessionFromRequestMock,
}))

import {
  assertAccountsSessionMatchesPrivyUser,
  isAccountsSessionBindingError,
} from '../../server/_lib/identity/accountsSessionBinding.ts'

describe('accounts session binding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readSessionFromRequestMock.mockReturnValue({
      address: '0x00000000000000000000000000000000000000aa',
    })
  })

  it('accepts the OTP Privy user bound to the cookie profile', async () => {
    const db = {
      sql: vi.fn(async () => ({
        rows: [{ id: 42, privy_user_id: 'did:privy:user-a' }],
      })),
    }

    await expect(
      assertAccountsSessionMatchesPrivyUser({
        db,
        req: {} as any,
        privyUserId: 'did:privy:user-a',
      }),
    ).resolves.toEqual({ profileId: 42 })
  })

  it('rejects a restored Privy identity before any account mutation', async () => {
    const db = {
      sql: vi.fn(async () => ({
        rows: [{ id: 42, privy_user_id: 'did:privy:user-a' }],
      })),
    }

    const error = await assertAccountsSessionMatchesPrivyUser({
      db,
      req: {} as any,
      privyUserId: 'did:privy:user-b',
    }).catch((caught) => caught)

    expect(isAccountsSessionBindingError(error)).toBe(true)
  })
})
