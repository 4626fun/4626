import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./identityRecovery.js', () => ({
  assertNoEmailPrivyCollision: vi.fn(async () => {}),
}))

import { deriveLinkedMethodsFromPrivyUser, recordProviderLink, syncEmailIdentity } from './accountsIdentity'

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function createRecordingDb() {
  const calls: Array<{ text: string; values: any[] }> = []
  return {
    calls,
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      calls.push({ text: normalizeSql(strings), values })
      return { rows: [] }
    }),
  }
}

describe('accountsIdentity verified email handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('only derives email linked methods from verified Privy email accounts', () => {
    expect(
      deriveLinkedMethodsFromPrivyUser({
        id: 'did:privy:test-user',
        email: { address: 'verified@example.com', verified: true },
        linkedAccounts: [
          { type: 'email', address: 'verified@example.com', verified: true },
          { type: 'email', address: 'pending@example.com', verified: false },
        ],
      } as any),
    ).toEqual(
      expect.objectContaining({
        email: ['verified@example.com'],
      }),
    )

    expect(
      deriveLinkedMethodsFromPrivyUser({
        id: 'did:privy:test-user',
        email: { address: 'pending@example.com', verified: false },
        linkedAccounts: [{ type: 'email', address: 'pending@example.com', verified: false }],
      } as any),
    ).not.toHaveProperty('email')
  })

  it('does not promote an unverified Privy email during syncEmailIdentity', async () => {
    const db = createRecordingDb()

    await syncEmailIdentity({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser: {
        id: 'did:privy:test-user',
        email: { address: 'pending@example.com', verified: false },
        linkedAccounts: [{ type: 'email', address: 'pending@example.com', verified: false }],
      } as any,
    })

    const accountUpsert = db.calls.find((call) => call.text.includes('insert into accounts'))
    expect(accountUpsert?.values[1] ?? null).toBeNull()
    expect(accountUpsert?.values[2]).toBe(false)
    expect(db.calls.some((call) => call.text.includes('insert into account_linked_methods'))).toBe(false)
  })

  it('promotes server-auth email accounts that use snake_case numeric verification timestamps', async () => {
    const db = createRecordingDb()

    await syncEmailIdentity({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser: {
        id: 'did:privy:test-user',
        linked_accounts: [{ type: 'email', address: 'verified@example.com', verified_at: 1674788927 }],
      } as any,
    })

    const accountUpsert = db.calls.find((call) => call.text.includes('insert into accounts'))
    expect(accountUpsert?.values[1]).toBe('verified@example.com')
    expect(accountUpsert?.values[2]).toBe(true)
    expect(db.calls.some((call) => call.text.includes('insert into account_linked_methods'))).toBe(true)
  })

  it('rejects explicit email linking until Privy marks the email verified', async () => {
    const db = createRecordingDb()

    await expect(
      recordProviderLink({
        db: db as any,
        privyUserId: 'did:privy:test-user',
        provider: 'email',
        value: 'pending@example.com',
        privyUser: {
          id: 'did:privy:test-user',
          email: { address: 'pending@example.com', verified: false },
          linkedAccounts: [{ type: 'email', address: 'pending@example.com', verified: false }],
        } as any,
      }),
    ).rejects.toThrow('Email is not verified in Privy yet.')

    expect(db.calls).toHaveLength(0)
  })
})
