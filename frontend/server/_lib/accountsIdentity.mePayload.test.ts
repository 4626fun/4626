import { describe, expect, it, vi } from 'vitest'

import { buildAccountsMePayload } from './accountsIdentity'

describe('buildAccountsMePayload', () => {
  it('includes approved app access status from the linked profile', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const query = strings
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()

        if (query.includes('select email') && query.includes('from accounts')) {
          return { rows: [{ email: 'test@example.com' }] }
        }

        if (query.includes('from account_linked_methods')) {
          return { rows: [] }
        }

        if (query.includes('from account_zora_signals')) {
          return {
            rows: [
              {
                zora_linked: false,
                canonical_csw_address: null,
                creator_coin_address: null,
                zora_handle: null,
                last_resolved_at: null,
              },
            ],
          }
        }

        if (query.includes('from account_points')) {
          return { rows: [{ points: 0, tier: 0 }] }
        }

        if (query.includes('select app_access_status') && query.includes('from profiles')) {
          expect(String(values[0] ?? '')).toBe('did:privy:test-user')
          return { rows: [{ app_access_status: 'approved' }] }
        }

        return { rows: [] }
      }),
    }

    const payload = await buildAccountsMePayload({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser: null,
    })

    expect(payload.appAccessStatus).toBe('approved')
    expect(payload.score.tier).toBe(0)
  })
})
