import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeSessionToken } from '../../server/auth/_shared.ts'
import handler from '../_handlers/portfolio/_me.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock, resolveOnchainIdentityProfileMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  resolveOnchainIdentityProfileMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/onchainIdentityProfile.js', () => ({
  resolveOnchainIdentityProfile: resolveOnchainIdentityProfileMock,
}))

function createPortfolioDb(
  source: 'manual' | 'external',
  extraProfileFields: Record<string, { value: string | null; source: string; updated_at: string }> = {},
  profileOverrides: Record<string, unknown> = {},
) {
  const defaultProfileFields = {
    display_name: { value: 'Alice', source, updated_at: new Date().toISOString() },
    bio: { value: 'hello', source: 'manual', updated_at: new Date().toISOString() },
    avatar_lens_uri: { value: null, source: 'manual', updated_at: new Date().toISOString() },
    banner_lens_uri: { value: null, source: 'manual', updated_at: new Date().toISOString() },
    ...extraProfileFields,
  }

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
    profile_fields: defaultProfileFields,
    ...profileOverrides,
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
    resolveOnchainIdentityProfileMock.mockResolvedValue(null)
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

  it('hydrates blank profile fields from ENS profile data', async () => {
    resolveOnchainIdentityProfileMock.mockResolvedValue({
      source: 'ens',
      address: '0x00000000000000000000000000000000000000aa',
      ensName: 'brantly.eth',
      basename: null,
      displayName: 'brantly.eth',
      bio: 'building onchain identity',
      avatarUrl: 'https://example.com/brantly.png',
      website: 'https://ethid.org',
      twitter: 'brantlyeth',
      github: null,
      discord: null,
    })
    getDbMock.mockResolvedValue(
      createPortfolioDb(
        'manual',
        {},
        {
          display_name: null,
          bio: null,
          website: null,
          avatar_url: null,
          profile_fields: {},
        },
      ),
    )
    const req = createMockReq({
      method: 'GET',
      query: { address: '0x00000000000000000000000000000000000000aa' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.profile?.displayName).toBe('brantly.eth')
    expect(res.body?.data?.profile?.bio).toBe('building onchain identity')
    expect(res.body?.data?.profile?.website).toBe('https://ethid.org')
    expect(res.body?.data?.profile?.avatarUrl).toBe('https://example.com/brantly.png')
    expect(res.body?.data?.profile?.profileFields?.display_name?.source).toBe('ens')
    expect(res.body?.data?.onchainIdentity?.ensName).toBe('brantly.eth')
    expect(res.body?.data?.onchainIdentity?.source).toBe('ens')
  })

  it('keeps manual profile fields over ENS defaults', async () => {
    resolveOnchainIdentityProfileMock.mockResolvedValue({
      source: 'ens',
      address: '0x00000000000000000000000000000000000000aa',
      ensName: 'brantly.eth',
      basename: null,
      displayName: 'brantly.eth',
      bio: 'onchain bio',
      avatarUrl: 'https://example.com/new.png',
      website: 'https://ens.domains',
      twitter: null,
      github: null,
      discord: null,
    })
    getDbMock.mockResolvedValue(createPortfolioDb('manual'))
    const req = createMockReq({
      method: 'GET',
      query: { address: '0x00000000000000000000000000000000000000aa' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.profile?.displayName).toBe('Alice')
    expect(res.body?.data?.profile?.bio).toBe('hello')
    expect(res.body?.data?.profile?.profileFields?.display_name?.source).toBe('manual')
  })

  it('rejects patching externally sourced fields', async () => {
    getDbMock.mockResolvedValue(createPortfolioDb('external'))
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
    expect(res.body?.data?.profile?.profileFields?.banner_lens_uri?.value).toBe('lens://banner-456')
    expect(res.body?.data?.profile?.profileFields?.avatar_lens_uri?.source).toBe('manual')
  })

  it('rejects patching externally sourced Lens URI fields', async () => {
    getDbMock.mockResolvedValue(
      createPortfolioDb('manual', {
        avatar_lens_uri: { value: 'lens://old', source: 'external', updated_at: new Date().toISOString() },
      }),
    )
    const token = makeSessionToken({ address: '0x00000000000000000000000000000000000000bb' })
    const req = createMockReq({
      method: 'PATCH',
      headers: { cookie: `cv_auth_session=${encodeURIComponent(token)}` },
      body: { avatarLensUri: 'lens://new' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error || '')).toContain('externally managed')
  })
})
