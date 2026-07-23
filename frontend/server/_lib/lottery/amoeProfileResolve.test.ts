import { describe, expect, it, vi } from 'vitest'

import { normalizeAmoeWallet, resolveAmoePointsProfile } from './amoeProfileResolve.js'

describe('normalizeAmoeWallet', () => {
  it('lowercases valid addresses', () => {
    expect(normalizeAmoeWallet('0xAb6d5C10b03300326cd7fab7267ae192842967b5')).toBe(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
  })
})

describe('resolveAmoePointsProfile', () => {
  it('returns verified privy profile when policy requires it', async () => {
    const queries: string[] = []
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase()
        queries.push(text)
        if (text.includes('p.email_verified = true')) {
          return { rows: [{ profile_id: 42 }] }
        }
        return { rows: [] }
      }),
    }

    const result = await resolveAmoePointsProfile(db, '0x00000000000000000000000000000000000000aa', 'verified_privy_only')
    expect(result).toEqual({ signupId: 42, kind: 'verified_privy' })
    expect(queries[0]).toContain('from account_linked_methods alm')
    expect(queries[0]).toContain('alm.verified = true')
    expect(queries[0]).toContain('lower(alm.value) = lower(p.email)')
  })

  it('creates synthetic profile for lottery ledger when unlinked', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase()
        if (text.includes('with matched as')) {
          return { rows: [] }
        }
        if (text.includes('insert into profiles')) {
          return { rows: [] }
        }
        if (text.includes('from profiles') && text.includes('where email')) {
          return { rows: [{ id: 9001 }] }
        }
        return { rows: [] }
      }),
    }

    const result = await resolveAmoePointsProfile(db, '0x00000000000000000000000000000000000000bb', 'lottery_ledger')
    expect(result).toEqual({ signupId: 9001, kind: 'synthetic' })
  })

  it('returns null for privy_linked when wallet has no Privy profile', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [] })),
    }

    const result = await resolveAmoePointsProfile(db, '0x00000000000000000000000000000000000000cc', 'privy_linked')
    expect(result).toBeNull()
  })
})
