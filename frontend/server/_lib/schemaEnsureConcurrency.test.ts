import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureReferralsSchemaMock = vi.fn(async () => {})
const ensureWaitlistPointsSchemaMock = vi.fn(async () => {})
const ensureCanonicalWalletsSchemaMock = vi.fn(async () => {})

vi.mock('./referrals.js', () => ({
  ensureReferralsSchema: ensureReferralsSchemaMock,
}))

vi.mock('./waitlistPoints.js', () => ({
  ensureWaitlistPointsSchema: ensureWaitlistPointsSchemaMock,
}))

vi.mock('./canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: ensureCanonicalWalletsSchemaMock,
}))

function createDb() {
  return {
    sql: vi.fn(async () => ({ rows: [], rowCount: 0 })),
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
    const { ensureWaitlistSchema: ensureWaitlistSchemaSingle } = await import('./waitlistSchema.ts')
    await ensureWaitlistSchemaSingle(singleDb as any)
    const expectedSqlCalls = singleDb.sql.mock.calls.length

    vi.resetModules()
    vi.clearAllMocks()
    ensureReferralsSchemaMock.mockResolvedValue(undefined)
    ensureWaitlistPointsSchemaMock.mockResolvedValue(undefined)
    ensureCanonicalWalletsSchemaMock.mockResolvedValue(undefined)

    const concurrentDb = createDb()
    const { ensureWaitlistSchema } = await import('./waitlistSchema.ts')
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
    const { ensureAccountsIdentitySchema: ensureAccountsIdentitySchemaSingle } = await import('./accountsIdentity.ts')
    await ensureAccountsIdentitySchemaSingle(singleDb as any)
    const expectedSqlCalls = singleDb.sql.mock.calls.length

    vi.resetModules()
    vi.clearAllMocks()

    const concurrentDb = createDb()
    const { ensureAccountsIdentitySchema } = await import('./accountsIdentity.ts')
    await Promise.all([
      ensureAccountsIdentitySchema(concurrentDb as any),
      ensureAccountsIdentitySchema(concurrentDb as any),
      ensureAccountsIdentitySchema(concurrentDb as any),
    ])

    expect(concurrentDb.sql).toHaveBeenCalledTimes(expectedSqlCalls)
  })

  it('dedupes concurrent telegram trading schema bootstrap work', async () => {
    const singleDb = createDb()
    const { ensureTelegramTradingSchema: ensureTelegramTradingSchemaSingle } = await import('./telegramTrading.ts')
    await ensureTelegramTradingSchemaSingle(singleDb as any)
    const expectedSqlCalls = singleDb.sql.mock.calls.length

    vi.resetModules()
    vi.clearAllMocks()

    const concurrentDb = createDb()
    const { ensureTelegramTradingSchema } = await import('./telegramTrading.ts')
    await Promise.all([
      ensureTelegramTradingSchema(concurrentDb as any),
      ensureTelegramTradingSchema(concurrentDb as any),
      ensureTelegramTradingSchema(concurrentDb as any),
    ])

    expect(concurrentDb.sql).toHaveBeenCalledTimes(expectedSqlCalls)
  })
})
