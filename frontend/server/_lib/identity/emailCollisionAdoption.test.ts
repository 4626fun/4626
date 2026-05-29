import { beforeEach, describe, expect, it, vi } from 'vitest'

import { assertNoEmailPrivyCollision } from './identityRecovery'
import { runWithWaitlistEmailCollisionAdoption } from './emailCollisionAdoption'

const upsertLinkedMethodMock = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('./accountsIdentity.js', () => ({
  upsertLinkedMethod: upsertLinkedMethodMock,
}))

type FakeDb = { sql: ReturnType<typeof vi.fn> }

function recoveryError(email: string) {
  return Object.assign(new Error('collision'), {
    code: 'IDENTITY_RECOVERY_REQUIRED',
    reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
    email,
    requestedPrivyUserId: 'did:privy:new-user',
    existingPrivyUserId: 'did:privy:old-user',
  })
}

function createRebindDb(): FakeDb {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('from profiles') && text.includes('where lower(email) = lower(')) {
        return {
          rows: [{ id: 42, privy_user_id: 'did:privy:old-user' }],
        }
      }
      if (text.includes('update profiles') && text.includes('returning id')) {
        return { rows: [{ id: 42 }] }
      }
      if (text.includes('where privy_user_id =')) {
        return { rows: [] }
      }
      return { rows: [] }
    }),
  }
}

describe('runWithWaitlistEmailCollisionAdoption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rebinds when Privy verifies the same email on a new session', async () => {
    const db = createRebindDb()
    const action = vi
      .fn()
      .mockRejectedValueOnce(recoveryError('user@example.com'))
      .mockResolvedValueOnce('ok')

    const privyUser = {
      id: 'did:privy:new-user',
      email: { address: 'user@example.com', verified: true },
    }

    const result = await runWithWaitlistEmailCollisionAdoption({
      db: db as any,
      email: 'user@example.com',
      privyUserId: 'did:privy:new-user',
      privyUser,
      action,
    })

    expect(result).toBe('ok')
    expect(action).toHaveBeenCalledTimes(2)
    expect(upsertLinkedMethodMock).toHaveBeenCalledWith(
      expect.objectContaining({
        privyUserId: 'did:privy:new-user',
        type: 'email',
        value: 'user@example.com',
        verified: true,
      }),
    )
  })

  it('uses the collision email when the caller email is still hydrating', async () => {
    const db = createRebindDb()
    const action = vi
      .fn()
      .mockRejectedValueOnce(recoveryError('user@example.com'))
      .mockResolvedValueOnce('ok')

    const privyUser = {
      id: 'did:privy:new-user',
      linkedAccounts: [{ type: 'email', address: 'user@example.com', verified: true }],
    }

    const result = await runWithWaitlistEmailCollisionAdoption({
      db: db as any,
      email: null,
      privyUserId: 'did:privy:new-user',
      privyUser,
      action,
    })

    expect(result).toBe('ok')
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('does not rebind when Privy has not verified the email yet', async () => {
    const db = createRebindDb()
    const action = vi.fn().mockRejectedValueOnce(recoveryError('user@example.com'))

    await expect(
      runWithWaitlistEmailCollisionAdoption({
        db: db as any,
        email: 'user@example.com',
        privyUserId: 'did:privy:new-user',
        privyUser: {
          id: 'did:privy:new-user',
          email: { address: 'user@example.com', verified: false },
        },
        action,
      }),
    ).rejects.toMatchObject({ code: 'IDENTITY_RECOVERY_REQUIRED' })

    expect(action).toHaveBeenCalledTimes(1)
    expect(upsertLinkedMethodMock).not.toHaveBeenCalled()
  })

  it('delegates to assertNoEmailPrivyCollision without throwing when no collision exists', async () => {
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase()
        if (text.includes('from accounts') || text.includes('from profiles')) {
          return { rows: [] }
        }
        return { rows: [] }
      }),
    }

    await expect(
      runWithWaitlistEmailCollisionAdoption({
        db: db as any,
        email: 'user@example.com',
        privyUserId: 'did:privy:new-user',
        privyUser: {
          id: 'did:privy:new-user',
          email: { address: 'user@example.com', verified: true },
        },
        action: () => assertNoEmailPrivyCollision({ db: db as any, email: 'user@example.com', privyUserId: 'did:privy:new-user' }),
      }),
    ).resolves.toBeUndefined()
  })
})
