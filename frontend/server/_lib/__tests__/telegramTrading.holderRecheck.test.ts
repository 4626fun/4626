import { describe, expect, it } from 'vitest'

import { listHolderRoomMembersNeedingRecheck } from '../telegramTrading.js'

type FakeDb = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

describe('telegramTrading holder-room recheck mapping', () => {
  it('uses share_token_address when present', async () => {
    const db: FakeDb = {
      sql: async () => ({
        rows: [
          {
            chat_id: '-1003595003982',
            vault_address: '0x82c06eaae27b1ca31fa29f22341a162a670a4471',
            room_chat_id: '-1003999999999',
            min_shares_raw: '1',
            grace_hours: 24,
            enabled: true,
            telegram_user_id: '123456',
            canonical_csw_address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
            owner_verified: true,
            link_status: 'active',
            status: 'active',
            last_eligible_at: null,
            grace_until: null,
            last_checked_at: null,
            share_token_address: '0x9d2b5eb0f4649f598f7f25c6b0f7f598f7f25c6b',
          },
        ],
      }),
    }

    const rows = await listHolderRoomMembersNeedingRecheck({ db, limit: 10 })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.shareTokenAddress).toBe('0x9d2b5eb0f4649f598f7f25c6b0f7f598f7f25c6b')
    expect(rows[0]?.ownerVerified).toBe(true)
    expect(rows[0]?.linkStatus).toBe('active')
  })

  it('does not fall back to vault address when share_token_address is missing', async () => {
    const db: FakeDb = {
      sql: async () => ({
        rows: [
          {
            chat_id: '-1003595003982',
            vault_address: '0x82c06eaae27b1ca31fa29f22341a162a670a4471',
            room_chat_id: '-1003999999999',
            min_shares_raw: '1',
            grace_hours: 24,
            enabled: true,
            telegram_user_id: '123456',
            canonical_csw_address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
            status: 'active',
            last_eligible_at: null,
            grace_until: null,
            last_checked_at: null,
            share_token_address: null,
          },
        ],
      }),
    }

    const rows = await listHolderRoomMembersNeedingRecheck({ db, limit: 10 })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.vaultAddress).toBe('0x82c06eaae27b1ca31fa29f22341a162a670a4471')
    expect(rows[0]?.shareTokenAddress).toBe('')
    expect(rows[0]?.ownerVerified).toBe(false)
    expect(rows[0]?.linkStatus).toBe(null)
  })
})
