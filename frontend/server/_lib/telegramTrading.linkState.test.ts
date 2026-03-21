import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getTelegramLinkByUserId } from './telegramTrading'

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function createTelegramLinkDb(initial: {
  linkRow: any
  walletRow: any | null
}) {
  let linkRow = initial.linkRow
  const walletRow = initial.walletRow

  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = normalizeSql(strings)

      if (text.includes('from telegram_user_links') && text.includes('where telegram_user_id =')) {
        return { rows: linkRow ? [linkRow] : [] }
      }

      if (text.includes('from profile_wallets') && text.includes('where profile_id =')) {
        return { rows: walletRow ? [walletRow] : [] }
      }

      if (text.startsWith('update telegram_user_links')) {
        linkRow = {
          ...linkRow,
          canonical_csw_address: values[0] ?? null,
          owner_verified: values[1] ?? false,
          link_status: values[2] ?? 'unknown',
          last_verified_at: new Date('2026-03-20T12:00:00.000Z').toISOString(),
        }
        return { rows: [linkRow] }
      }

      throw new Error(`Unhandled SQL in telegramTrading.linkState test: ${text}`)
    }),
  }
}

describe('getTelegramLinkByUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('self-heals a pending Telegram link after wallet setup completes on web', async () => {
    const db = createTelegramLinkDb({
      linkRow: {
        telegram_user_id: '42',
        telegram_username: 'akita',
        profile_id: 11,
        privy_user_id: 'did:privy:test-user',
        canonical_csw_address: null,
        owner_verified: false,
        link_status: 'pending_wallet_setup',
        linked_at: '2026-03-20T10:00:00.000Z',
        last_verified_at: null,
        revoked_at: null,
        failure_count: 0,
        last_failure_reason: null,
        unlink_requested_at: null,
      },
      walletRow: {
        canonical_csw_address: '0x00000000000000000000000000000000000000aa',
        privy_is_owner: true,
        address: '0x00000000000000000000000000000000000000aa',
        is_canonical_smart_wallet: true,
      },
    })

    const link = await getTelegramLinkByUserId({
      db: db as any,
      telegramUserId: '42',
    })

    expect(link?.canonicalCswAddress).toBe('0x00000000000000000000000000000000000000aa')
    expect(link?.ownerVerified).toBe(true)
    expect(link?.linkStatus).toBe('active')
  })

  it('downgrades a stale active link back to pending wallet setup when canonical CSW disappears', async () => {
    const db = createTelegramLinkDb({
      linkRow: {
        telegram_user_id: '42',
        telegram_username: 'akita',
        profile_id: 11,
        privy_user_id: 'did:privy:test-user',
        canonical_csw_address: '0x00000000000000000000000000000000000000aa',
        owner_verified: true,
        link_status: 'active',
        linked_at: '2026-03-20T10:00:00.000Z',
        last_verified_at: null,
        revoked_at: null,
        failure_count: 0,
        last_failure_reason: null,
        unlink_requested_at: null,
      },
      walletRow: null,
    })

    const link = await getTelegramLinkByUserId({
      db: db as any,
      telegramUserId: '42',
    })

    expect(link?.canonicalCswAddress).toBeNull()
    expect(link?.ownerVerified).toBe(false)
    expect(link?.linkStatus).toBe('pending_wallet_setup')
  })
})
