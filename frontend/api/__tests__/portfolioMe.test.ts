import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSessionToken } from '../../server/auth/_shared.ts'
import handler from '../_handlers/portfolio/_me.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

function createPortfolioDb(source: 'manual' | 'farcaster') {
  const profile: any = {
    id: 1,
    primary_smart_wallet: '0x00000000000000000000000000000000000000aa',
    primary_embedded_eoa: '0x00000000000000000000000000000000000000bb',
    display_name: 'Alice',
    bio: 'hello',
    website: 'https://alice.test',
    avatar_url: null,
    banner_url: null,
    app_access_status: 'approved',
    updated_at: new Date().toISOString(),
    profile_fields: {
      display_name: { value: 'Alice', source, updated_at: new Date().toISOString() },
      bio: { value: 'hello', source: 'manual', updated_at: new Date().toISOString() },
      avatar_lens_uri: { value: null, source: 'manual', updated_at: new Date().toISOString() },
    },
  }

  const walletRows = [
    {
      address: '0x00000000000000000000000000000000000000aa',
      is_primary: true,
      is_canonical_smart_wallet: true,
      is_embedded_eoa: false,
      verified_at: new Date().toISOString(),
      wallet_type: 'smart_wallet',
      provider: 'coinbase_wallet',
      chain: 'evm',
    },
    {
      address: '0x00000000000000000000000000000000000000bb',
      is_primary: false,
      is_canonical_smart_wallet: false,
      is_embedded_eoa: true,
      verified_at: new Date().toISOString(),
      wallet_type: 'embedded_eoa',
      provider: 'privy',
      chain: 'evm',
    },
  ]

  return {
    sql: async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')

      if (text.includes('from profiles') && text.includes('where lower(primary_smart_wallet)')) return { rows: [profile] }
      if (text.includes('from profiles') && text.includes('where id in')) return { rows: [profile] }
      if (text.includes('from profile_wallets pw') && text.includes('left join wallets')) return { rows: walletRows }
      if (text.includes('update profiles') && text.includes('set')) {
        const [
          hasDisplayName,
          displayName,
          hasBio,
          bio,
          hasWebsite,
          website,
          hasAvatarUrl,
          avatarUrl,
          hasBannerUrl,
          bannerUrl,
          mergedFields,
        ] = values
        if (hasDisplayName) profile.display_name = displayName
        if (hasBio) profile.bio = bio
        if (hasWebsite) profile.website = website
        if (hasAvatarUrl) profile.avatar_url = avatarUrl
        if (hasBannerUrl) profile.banner_url = bannerUrl
        profile.profile_fields = mergedFields
        profile.updated_at = new Date().toISOString()
        return { rows: [] }
      }
      if (text.includes('select * from profiles where id =')) return { rows: [profile] }

      return { rows: [] }
    },
  }
}

describe('portfolio /api/portfolio/me', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
      DEBANK_ACCESS_KEY: undefined,
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns public profile by address', async () => {
    getDbMock.mockResolvedValue(createPortfolioDb('manual'))
    const req = createMockReq({
      method: 'GET',
      query: { address: '0x00000000000000000000000000000000000000aa' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.mode).toBe('public')
    expect(res.body?.data?.profile?.primarySmartWallet).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('rejects patching externally sourced fields', async () => {
    getDbMock.mockResolvedValue(createPortfolioDb('farcaster'))
    const token = makeSessionToken({ address: '0x00000000000000000000000000000000000000bb' })
    const req = createMockReq({
      method: 'PATCH',
      headers: { cookie: `cv_auth_session=${encodeURIComponent(token)}` },
      body: { displayName: 'Mallory' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error || '')).toContain('externally managed')
  })

  it('updates manual fields via PATCH', async () => {
    getDbMock.mockResolvedValue(createPortfolioDb('manual'))
    const token = makeSessionToken({ address: '0x00000000000000000000000000000000000000bb' })
    const req = createMockReq({
      method: 'PATCH',
      headers: { cookie: `cv_auth_session=${encodeURIComponent(token)}` },
      body: { displayName: 'Alice Updated', bio: 'updated bio' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.profile?.displayName).toBe('Alice Updated')
    expect(res.body?.data?.profile?.bio).toBe('updated bio')
    expect(res.body?.data?.profile?.profileFields?.display_name?.source).toBe('manual')
  })

  it('stores lens URIs in profile fields', async () => {
    getDbMock.mockResolvedValue(createPortfolioDb('manual'))
    const token = makeSessionToken({ address: '0x00000000000000000000000000000000000000bb' })
    const req = createMockReq({
      method: 'PATCH',
      headers: { cookie: `cv_auth_session=${encodeURIComponent(token)}` },
      body: { avatarLensUri: 'lens://avatar-123', bannerLensUri: 'lens://banner-456' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.profile?.avatarLensUri).toBe('lens://avatar-123')
    expect(res.body?.data?.profile?.bannerLensUri).toBe('lens://banner-456')
    expect(res.body?.data?.profile?.profileFields?.avatar_lens_uri?.value).toBe('lens://avatar-123')
  })
})
