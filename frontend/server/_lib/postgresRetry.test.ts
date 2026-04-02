import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SESSION_MODE_ERROR_MSG =
  'error: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size'

let queryCallCount = 0
let queryBehavior: 'succeed' | 'session_error' | 'other_error' | 'fail_then_succeed' | 'self_signed_once' = 'succeed'
let failThenSucceedThreshold = 0
const mockPoolEnd = vi.fn(async () => {})
const mockPoolQuery = vi.fn(async () => {
  queryCallCount++
  if (queryBehavior === 'succeed') return { rows: [{ ok: 1 }] }
  if (queryBehavior === 'other_error') throw new Error('connection refused')
  if (queryBehavior === 'self_signed_once') {
    if (queryCallCount === 1) {
      const err = new Error('self-signed certificate in certificate chain') as any
      err.code = 'SELF_SIGNED_CERT_IN_CHAIN'
      throw err
    }
    return { rows: [{ ok: 1 }] }
  }
  if (queryBehavior === 'fail_then_succeed') {
    if (queryCallCount <= failThenSucceedThreshold) {
      const err = new Error(SESSION_MODE_ERROR_MSG) as any
      err.code = 'XX000'
      throw err
    }
    return { rows: [{ ok: 1 }] }
  }
  const err = new Error(SESSION_MODE_ERROR_MSG) as any
  err.code = 'XX000'
  throw err
})
const mockPoolCtor = vi.fn((..._args: any[]) => ({
  query: mockPoolQuery,
  end: mockPoolEnd,
}))

vi.mock('pg', () => ({
  Pool: mockPoolCtor,
}))

vi.mock('@vercel/postgres', () => ({}))

describe('postgres session-mode retry', () => {
  let getDb: typeof import('./postgres.ts').getDb
  let getDbInitError: typeof import('./postgres.ts').getDbInitError

  beforeEach(async () => {
    vi.resetModules()
    queryCallCount = 0
    queryBehavior = 'succeed'
    failThenSucceedThreshold = 0
    mockPoolEnd.mockClear()
    mockPoolQuery.mockClear()
    mockPoolCtor.mockClear()

    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@db.supabase.co:5432/postgres')
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('POSTGRES_QUERY_RETRY_COUNT', '2')

    delete process.env.POSTGRES_URL
    delete process.env.POSTGRES_URL_NON_POOLING
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    delete process.env.PGSSLMODE
    delete process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED
    delete process.env.POSTGRES_SSL_ALLOW_SELF_SIGNED_FALLBACK

    const mod = await import('./postgres.ts')
    getDb = mod.getDb
    getDbInitError = mod.getDbInitError
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns data on first success without retries', async () => {
    queryBehavior = 'succeed'
    const db = await getDb()
    expect(db).not.toBeNull()
    queryCallCount = 0

    const result = await db!.sql`SELECT 1;`
    expect(result.rows).toEqual([{ ok: 1 }])
    expect(queryCallCount).toBe(1)
  })

  it('retries session-mode errors and succeeds on subsequent attempt', async () => {
    queryBehavior = 'fail_then_succeed'
    failThenSucceedThreshold = 1

    const db = await getDb()
    expect(db).not.toBeNull()

    queryCallCount = 0
    queryBehavior = 'fail_then_succeed'
    failThenSucceedThreshold = 1

    const result = await db!.sql`SELECT 42;`
    expect(result.rows).toEqual([{ ok: 1 }])
    expect(queryCallCount).toBe(2)
  })

  it('does not retry non-session-mode errors', async () => {
    queryBehavior = 'succeed'
    const db = await getDb()
    expect(db).not.toBeNull()

    queryCallCount = 0
    queryBehavior = 'other_error'

    await expect(db!.sql`SELECT 1;`).rejects.toThrow('connection refused')
    expect(queryCallCount).toBe(1)
  })

  it('resets pool after exhausting all retries', async () => {
    queryBehavior = 'succeed'
    const db = await getDb()
    expect(db).not.toBeNull()

    queryCallCount = 0
    queryBehavior = 'session_error'

    await expect(db!.sql`SELECT 1;`).rejects.toThrow(/MaxClientsInSessionMode/)
    expect(queryCallCount).toBe(3)
    expect(mockPoolEnd).toHaveBeenCalled()
  })

  it('retries via query() method as well', async () => {
    queryBehavior = 'fail_then_succeed'
    failThenSucceedThreshold = 1
    const db = await getDb()
    expect(db).not.toBeNull()

    queryCallCount = 0
    queryBehavior = 'fail_then_succeed'
    failThenSucceedThreshold = 1

    const result = await db!.query!('SELECT $1', [42])
    expect(result.rows).toEqual([{ ok: 1 }])
    expect(queryCallCount).toBe(2)
  })

  it('retries init once with relaxed TLS on SELF_SIGNED_CERT_IN_CHAIN', async () => {
    vi.stubEnv('POSTGRES_SSL_ALLOW_SELF_SIGNED_FALLBACK', 'true')
    queryBehavior = 'self_signed_once'
    const db = await getDb()
    expect(db).not.toBeNull()
    // First query fails with self-signed chain, second succeeds after TLS fallback.
    expect(queryCallCount).toBe(2)
  })

  it('does not auto-fallback when self-signed fallback is explicitly disabled', async () => {
    vi.stubEnv('POSTGRES_SSL_ALLOW_SELF_SIGNED_FALLBACK', 'false')
    queryBehavior = 'self_signed_once'
    const db = await getDb()
    expect(db).toBeNull()
    expect(getDbInitError()).toMatch(/self-signed certificate in certificate chain/i)
    expect(queryCallCount).toBe(1)
  })

  it('honors PGSSLMODE=no-verify when building pg SSL options', async () => {
    vi.stubEnv('PGSSLMODE', 'no-verify')
    queryBehavior = 'succeed'
    const db = await getDb()
    expect(db).not.toBeNull()
    const firstCtorArgs = mockPoolCtor.mock.calls[0]?.[0] as { ssl?: { rejectUnauthorized?: boolean } } | undefined
    expect(firstCtorArgs?.ssl?.rejectUnauthorized).toBe(false)
  })
})
