import { describe, expect, it, vi } from 'vitest'

import {
  assertNoWalletPrivyCollision,
  isIdentityRecoveryRequiredError,
} from './identityRecovery'

type FakeDb = { sql: ReturnType<typeof vi.fn> }

/** Minimal Privy user shape with a single external EVM wallet. */
function privyUserWithWallet(address: string, walletType: 'external_eoa' | 'embedded_eoa' = 'external_eoa') {
  return {
    linked_accounts: [
      {
        type: 'wallet',
        address,
        chain_type: 'ethereum',
        wallet_client_type: walletType === 'embedded_eoa' ? 'privy' : 'metamask',
      },
    ],
  }
}

describe('assertNoWalletPrivyCollision', () => {
  it('no-ops when the Privy user has no EVM wallets', async () => {
    const db: FakeDb = { sql: vi.fn(async () => ({ rows: [] })) }
    await expect(
      assertNoWalletPrivyCollision({
        db: db as any,
        privyUserId: 'did:privy:new',
        privyUser: { linked_accounts: [] },
      }),
    ).resolves.toBeUndefined()
    // Should not even hit the DB — classification early-exits on zero wallets.
    expect(db.sql).not.toHaveBeenCalled()
  })

  it('no-ops when privy_user_aliases table is missing (legacy env)', async () => {
    const missingRelation = new Error('relation "privy_user_aliases" does not exist')
    const db: FakeDb = {
      sql: vi.fn(async () => {
        throw missingRelation
      }),
    }
    await expect(
      assertNoWalletPrivyCollision({
        db: db as any,
        privyUserId: 'did:privy:new',
        privyUser: privyUserWithWallet('0x' + 'a'.repeat(40)),
      }),
    ).resolves.toBeUndefined()
  })

  it('no-ops when no matching canonical profile is found', async () => {
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const raw = strings.join(' ')
        if (/SELECT 1 FROM privy_user_aliases/i.test(raw)) return { rows: [{ '?column?': 1 }] }
        return { rows: [] } // collision SELECT — no match
      }),
    }
    await expect(
      assertNoWalletPrivyCollision({
        db: db as any,
        privyUserId: 'did:privy:new',
        privyUser: privyUserWithWallet('0x' + 'a'.repeat(40)),
      }),
    ).resolves.toBeUndefined()
  })

  it('throws a wallet-bound recovery error when wallet matches canonical email profile', async () => {
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const raw = strings.join(' ')
        // The main query also contains a `SELECT 1 FROM privy_user_aliases`
        // subquery, so match the more specific "FROM profiles p ... matched_wallet"
        // pattern FIRST and only fall through to the existence probe for
        // the standalone SELECT.
        if (/AS matched_wallet[\s\S]*FROM profiles p\b/i.test(raw)) {
          return {
            rows: [
              {
                id: 1,
                email: 'canonical@example.com',
                matched_wallet: '0x' + 'a'.repeat(40),
              },
            ],
          }
        }
        if (/SELECT 1 FROM privy_user_aliases LIMIT/i.test(raw)) {
          return { rows: [{ '?column?': 1 }] }
        }
        return { rows: [] }
      }),
    }

    let caught: any = null
    try {
      await assertNoWalletPrivyCollision({
        db: db as any,
        privyUserId: 'did:privy:new',
        privyUser: privyUserWithWallet('0x' + 'a'.repeat(40)),
      })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeTruthy()
    expect(isIdentityRecoveryRequiredError(caught)).toBe(true)
    expect(caught.reason).toBe('WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE')
    expect(caught.canonicalEmail).toBe('canonical@example.com')
    expect(caught.canonicalProfileId).toBe(1)
    expect(caught.wallet).toBe('0x' + 'a'.repeat(40))
  })

  it('ignores synthetic wallet-shell emails so real signups are not blocked', async () => {
    // Simulate: a canonical-looking profile row is returned from the DB
    // query. If the filter in the SQL is correct, the query never produces
    // that row for a synthetic-email owner — so we just assert the happy
    // path (no throw) when the DB returns nothing. The SQL itself enforces
    // the filter; this test guards against regression in the code path.
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const raw = strings.join(' ')
        if (/AS matched_wallet[\s\S]*FROM profiles p\b/i.test(raw)) {
          // A correctly-filtered query would not surface a row for a
          // synthetic-email profile. Assert the filter is present.
          expect(raw).toContain("NOT LIKE '%@wallet.4626.fun'")
          expect(raw).toContain("NOT LIKE '%@noemail.4626.fun'")
          return { rows: [] }
        }
        if (/SELECT 1 FROM privy_user_aliases LIMIT/i.test(raw)) return { rows: [{ '?column?': 1 }] }
        if (/SELECT 1 FROM profile_wallets LIMIT/i.test(raw)) return { rows: [{ '?column?': 1 }] }
        return { rows: [] }
      }),
    }
    await expect(
      assertNoWalletPrivyCollision({
        db: db as any,
        privyUserId: 'did:privy:new',
        privyUser: privyUserWithWallet('0x' + 'a'.repeat(40)),
      }),
    ).resolves.toBeUndefined()
  })
})

describe('isIdentityRecoveryRequiredError', () => {
  it('matches both the email-bound and wallet-bound variants', () => {
    const emailErr = Object.assign(new Error('x'), {
      code: 'IDENTITY_RECOVERY_REQUIRED',
      reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
    })
    const walletErr = Object.assign(new Error('x'), {
      code: 'IDENTITY_RECOVERY_REQUIRED',
      reason: 'WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE',
    })
    expect(isIdentityRecoveryRequiredError(emailErr)).toBe(true)
    expect(isIdentityRecoveryRequiredError(walletErr)).toBe(true)
  })

  it('does not match unrelated errors', () => {
    expect(isIdentityRecoveryRequiredError(new Error('plain'))).toBe(false)
    expect(isIdentityRecoveryRequiredError(null)).toBe(false)
    expect(isIdentityRecoveryRequiredError({})).toBe(false)
    expect(
      isIdentityRecoveryRequiredError(
        Object.assign(new Error('x'), { code: 'IDENTITY_RECOVERY_REQUIRED', reason: 'SOMETHING_ELSE' }),
      ),
    ).toBe(false)
  })
})
