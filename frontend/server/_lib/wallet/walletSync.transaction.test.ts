import { describe, expect, it, vi } from 'vitest'

import { withDbTransaction, type Db } from './walletSync.js'

describe('wallet sync transaction binding', () => {
  it('uses the transaction callback handle instead of pool-level BEGIN/COMMIT', async () => {
    const poolSql = vi.fn()
    const txSql = vi.fn()
    const txDb = { sql: txSql } as unknown as Db
    const transaction = vi.fn(async (fn: (db: Db) => Promise<string>) => fn(txDb))
    const db = { sql: poolSql, transaction } as unknown as Db

    const result = await withDbTransaction(db, async (boundDb) => {
      expect(boundDb).toBe(txDb)
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(poolSql).not.toHaveBeenCalled()
  })
})
