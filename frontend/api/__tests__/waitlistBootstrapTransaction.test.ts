import { describe, expect, it, vi } from 'vitest'

import { runBootstrapTransaction } from '../_handlers/waitlist/_bootstrap.js'

describe('waitlist bootstrap transaction binding', () => {
  it('takes the advisory lock and mutation on one checked-out transaction handle', async () => {
    const poolSql = vi.fn()
    const txSql = vi.fn(async () => ({ rows: [] }))
    const txDb = { sql: txSql }
    const transaction = vi.fn(async (fn: (db: typeof txDb) => Promise<string>) => fn(txDb))
    const db = { sql: poolSql, transaction }

    const result = await runBootstrapTransaction(
      db as any,
      async (boundDb) => {
        expect(boundDb).toBe(txDb)
        await boundDb.sql`SELECT 1`
        return 'ok'
      },
      'privy:user',
    )
    expect(result).toBe('ok')
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(txSql).toHaveBeenCalledTimes(2)
    expect(poolSql).not.toHaveBeenCalled()
  })
})
