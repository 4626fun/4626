import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureReferralsSchemaMock = vi.fn(async () => {})
const ensureWaitlistPointsSchemaMock = vi.fn(async () => {})
const ensureCanonicalWalletsSchemaMock = vi.fn(async () => {})

vi.mock('../onboarding/referrals.js', () => ({
  ensureReferralsSchema: ensureReferralsSchemaMock,
}))

vi.mock('../onboarding/waitlistPoints.js', () => ({
  ensureWaitlistPointsSchema: ensureWaitlistPointsSchemaMock,
}))

vi.mock('../wallet/canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: ensureCanonicalWalletsSchemaMock,
}))

function createDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join('')

      if (text.includes("to_regclass('public.profiles') IS NOT NULL AS has_profiles")) {
        return {
          rows: [
            {
              has_profiles: true,
              has_referral_clicks: true,
              has_referral_conversions: true,
              has_points: true,
              has_wallets: true,
              has_profile_wallets: true,
              has_app_access_status: true,
              has_verifications: true,
              has_profile_completed_at: true,
              has_primary_smart_wallet: true,
              has_primary_embedded_eoa: true,
            },
          ],
          rowCount: 1,
        }
      }

      if (text.includes("to_regclass('public.accounts') IS NOT NULL AS has_accounts")) {
        return {
          rows: [
            {
              has_accounts: true,
              has_account_linked_methods: true,
              has_account_zora_signals: true,
              has_canonical_csw_address: true,
            },
          ],
          rowCount: 1,
        }
      }

      return { rows: [], rowCount: 0 }
    }),
  }
}

describe('schema ensure concurrency guards', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureReferralsSchemaMock.mockResolvedValue(undefined)
    ensureWaitlistPointsSchemaMock.mockResolvedValue(undefined)
    ensureCanonicalWalletsSchemaMock.mockResolvedValue(undefined)
  })

  it('dedupes concurrent waitlist schema bootstrap work', async () => {
    const singleDb = createDb()
    const { ensureWaitlistSchema: ensureWaitlistSchemaSingle } = await import('../onboarding/waitlistSchema.ts')
    await ensureWaitlistSchemaSingle(singleDb as any)
    const expectedSqlCalls = singleDb.sql.mock.calls.length

    vi.resetModules()
    vi.clearAllMocks()
    ensureReferralsSchemaMock.mockResolvedValue(undefined)
    ensureWaitlistPointsSchemaMock.mockResolvedValue(undefined)
    ensureCanonicalWalletsSchemaMock.mockResolvedValue(undefined)

    const concurrentDb = createDb()
    const { ensureWaitlistSchema } = await import('../onboarding/waitlistSchema.ts')
    await Promise.all([
      ensureWaitlistSchema(concurrentDb as any),
      ensureWaitlistSchema(concurrentDb as any),
      ensureWaitlistSchema(concurrentDb as any),
    ])

    expect(concurrentDb.sql).toHaveBeenCalledTimes(expectedSqlCalls)
    expect(ensureReferralsSchemaMock).toHaveBeenCalledTimes(1)
    expect(ensureWaitlistPointsSchemaMock).toHaveBeenCalledTimes(1)
    expect(ensureCanonicalWalletsSchemaMock).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent accounts identity schema bootstrap work', async () => {
    const singleDb = createDb()
    const { ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaSingle } = await import('../identity/accountsIdentity.ts')
    await ensureAccountsIdentitySchemaSingle(singleDb as any)
    const expectedSqlCalls = singleDb.sql.mock.calls.length

    vi.resetModules()
    vi.clearAllMocks()

    const concurrentDb = createDb()
    const { ensureAccountsIdentitySchema } = await import('../identity/accountsIdentity.ts')
    await Promise.all([
      ensureAccountsIdentitySchema(concurrentDb as any),
      ensureAccountsIdentitySchema(concurrentDb as any),
      ensureAccountsIdentitySchema(concurrentDb as any),
    ])

    expect(concurrentDb.sql).toHaveBeenCalledTimes(expectedSqlCalls)
  })

  it('dedupes concurrent telegram trading schema bootstrap work (canonical)', async () => {
    const singleDb = createDb()
    const { ensureTelegramTradingSchema: ensureTelegramTradingSchemaSingle } = await import('../db/schemaBootstrap.ts')
    await ensureTelegramTradingSchemaSingle(singleDb as any)
    const expectedSqlCalls = singleDb.sql.mock.calls.length

    vi.resetModules()
    vi.clearAllMocks()

    const concurrentDb = createDb()
    const { ensureTelegramTradingSchema } = await import('../db/schemaBootstrap.ts')
    await Promise.all([
      ensureTelegramTradingSchema(concurrentDb as any),
      ensureTelegramTradingSchema(concurrentDb as any),
      ensureTelegramTradingSchema(concurrentDb as any),
    ])

    expect(concurrentDb.sql).toHaveBeenCalledTimes(expectedSqlCalls)
  })

  it('dedupes concurrent telegram trading schema bootstrap work via legacy wrapper', async () => {
    // Retained to ensure the thin adapter in telegramTrading.ts still works
    const singleDb = createDb()
    const { ensureTelegramTradingSchema: ensureTelegramTradingSchemaSingle } = await import('../messaging/telegramTrading.ts')
    await ensureTelegramTradingSchemaSingle(singleDb as any)
    const expectedSqlCalls = singleDb.sql.mock.calls.length

    vi.resetModules()
    vi.clearAllMocks()

    const concurrentDb = createDb()
    const { ensureTelegramTradingSchema } = await import('../messaging/telegramTrading.ts')
    await Promise.all([
      ensureTelegramTradingSchema(concurrentDb as any),
      ensureTelegramTradingSchema(concurrentDb as any),
      ensureTelegramTradingSchema(concurrentDb as any),
    ])

    expect(concurrentDb.sql).toHaveBeenCalledTimes(expectedSqlCalls)
  })
})

describe('withEnsureOnce (centralized helper)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('runs the wrapped function only once for repeated calls', async () => {
    const { withEnsureOnce } = await import('../db/schemaBootstrap.js')
    const fn = vi.fn(async () => {})

    await withEnsureOnce('test-once-1', fn)
    await withEnsureOnce('test-once-1', fn)
    await withEnsureOnce('test-once-1', fn)

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('coalesces concurrent calls to a single execution', async () => {
    const { withEnsureOnce } = await import('../db/schemaBootstrap.js')
    let resolveFn: () => void
    const fnPromise = new Promise<void>((r) => { resolveFn = r })
    const fn = vi.fn(async () => { await fnPromise })

    const p1 = withEnsureOnce('test-concurrent-1', fn)
    const p2 = withEnsureOnce('test-concurrent-1', fn)
    const p3 = withEnsureOnce('test-concurrent-1', fn)

    resolveFn!()
    await Promise.all([p1, p2, p3])

    // Core guarantee: the wrapped fn executed exactly once despite concurrent callers
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('resets state after error so subsequent calls can retry', async () => {
    const { withEnsureOnce } = await import('../db/schemaBootstrap.js')
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)

    await expect(withEnsureOnce('test-error-1', fn)).rejects.toThrow('boom')
    await withEnsureOnce('test-error-1', fn) // should succeed on retry

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('different names are independent', async () => {
    const { withEnsureOnce } = await import('../db/schemaBootstrap.js')
    const fnA = vi.fn(async () => {})
    const fnB = vi.fn(async () => {})

    await withEnsureOnce('name-a', fnA)
    await withEnsureOnce('name-b', fnB)
    await withEnsureOnce('name-a', fnA)
    await withEnsureOnce('name-b', fnB)

    expect(fnA).toHaveBeenCalledTimes(1)
    expect(fnB).toHaveBeenCalledTimes(1)
  })
})
