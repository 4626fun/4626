import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_leaderboard.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock, resolveAuthorizedRequestPrincipalMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  resolveAuthorizedRequestPrincipalMock: vi.fn(async () => null),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/auth/requestPrincipal.js', () => ({
  resolveAuthorizedRequestPrincipal: resolveAuthorizedRequestPrincipalMock,
}))

describe('waitlist/leaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not expose email-derived identities in public leaderboard display names', async () => {
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('select count(*)::int as c')) {
          return { rows: [{ c: 2 }] }
        }
        if (text.includes('select rank, signup_id, canonical_csw, eoa_address, label_hint')) {
          return {
            rows: [
              {
                rank: 1,
                signup_id: 42,
                canonical_csw: '0x00000000000000000000000000000000000000cc',
                eoa_address: null,
                label_hint: 'akita',
                avatar_url: 'https://cdn.example/akita.png',
                show_zora_badge: true,
                show_base_app_badge: false,
                wallet_provider: null,
                referral_code: 'C2',
                border_tier: 0,
                total_points: 150,
                invite_points: 40,
                agent_points: 10,
              },
              {
                rank: 2,
                signup_id: 43,
                canonical_csw: null,
                eoa_address: null,
                label_hint: null,
                avatar_url: null,
                show_zora_badge: false,
                show_base_app_badge: false,
                wallet_provider: 'rabby',
                referral_code: 'AKITA',
                border_tier: 1,
                total_points: 90,
                invite_points: 20,
                agent_points: 5,
              },
              {
                rank: 3,
                signup_id: 44,
                canonical_csw: null,
                eoa_address: '0x00000000000000000000000000000000000000ee',
                label_hint: null,
                avatar_url: null,
                show_zora_badge: false,
                show_base_app_badge: false,
                wallet_provider: 'metamask',
                referral_code: 'EOA1',
                border_tier: 0,
                total_points: 50,
                invite_points: 10,
                agent_points: 2,
              },
            ],
          }
        }
        return { rows: [] }
      }),
    } as any)

    const req = createMockReq({
      method: 'GET',
      query: { pointsType: 'total', page: '1', limit: '5' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.leaderboard?.[0]?.display).toContain('0x0000')
    expect(res.body?.data?.leaderboard?.[1]?.display).toBe('user#43')
    expect(res.body?.data?.leaderboard?.[0]?.referralCode).toBeNull()
    // Row 1 has a CSW → `cswAddress` is the full address.
    expect(res.body?.data?.leaderboard?.[0]?.cswAddress).toBe(
      '0x00000000000000000000000000000000000000cc',
    )
    // And the `display` short label points at the CSW (last 4: 00cc), not
    // the rolled-up primary_wallet (last 4: 00aa).
    expect(res.body?.data?.leaderboard?.[0]?.display).toContain('00cc')
    expect(res.body?.data?.leaderboard?.[0]?.display).not.toContain('00aa')
    // Row 1 has a CSW → external EOA is never surfaced alongside it.
    expect(res.body?.data?.leaderboard?.[0]?.eoaAddress).toBeNull()
    // Row 2 has no CSW and no external EOA → stays an anonymous member, never
    // a persona label like "creator".
    expect(res.body?.data?.leaderboard?.[1]?.cswAddress).toBeNull()
    expect(res.body?.data?.leaderboard?.[1]?.eoaAddress).toBeNull()
    expect(res.body?.data?.leaderboard?.[1]?.display).toBe('user#43')
    expect(res.body?.data?.leaderboard?.[1]?.display).not.toMatch(/creator/i)
    // Row 3 has no CSW but a connected external EOA → display the EOA short
    // address (last 4: 00ee) and surface it as `eoaAddress`, not "user#44".
    expect(res.body?.data?.leaderboard?.[2]?.cswAddress).toBeNull()
    expect(res.body?.data?.leaderboard?.[2]?.eoaAddress).toBe(
      '0x00000000000000000000000000000000000000ee',
    )
    expect(res.body?.data?.leaderboard?.[2]?.display).toContain('00ee')
    expect(res.body?.data?.leaderboard?.[2]?.display).not.toContain('user#')
    expect(res.body?.data?.leaderboard?.[0]?.labelHint).toBe('akita')
    expect(res.body?.data?.leaderboard?.[0]?.avatarUrl).toBe('https://cdn.example/akita.png')
    expect(res.body?.data?.leaderboard?.[0]?.showZoraBadge).toBe(true)
    expect(res.body?.data?.leaderboard?.[0]?.showBaseAppBadge).toBe(false)
    expect(res.body?.data?.leaderboard?.[1]?.walletProvider).toBe('rabby')
  })
})
