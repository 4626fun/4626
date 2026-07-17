import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}))

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureSolanaLotteryEntryInboxSchema: vi.fn(async () => {}),
}))

import {
  resolveSolanaLotteryBeneficiary,
  SOLANA_LOTTERY_FORCED_COVERAGE_BALANCE,
} from './solanaLotteryIdentity.js'

describe('solanaLotteryIdentity', () => {
  beforeEach(() => {
    getDbMock.mockReset()
  })

  it('resolves unique parent CSW for canonical Solana wallet', async () => {
    const db = {
      sql: vi.fn(async () => ({
        rows: [{ profile_id: 'prof-1', csw_address: '0xAbCDef0000000000000000000000000000000001' }],
      })),
    }
    const result = await resolveSolanaLotteryBeneficiary({
      db,
      buyerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
    })
    expect(result).toEqual({
      ok: true,
      buyerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
      profileId: 'prof-1',
      beneficiaryCsw: '0xabcdef0000000000000000000000000000000001',
      identityKind: 'parent_csw',
    })
    expect(SOLANA_LOTTERY_FORCED_COVERAGE_BALANCE).toBe(0n)
  })

  it('fail-closes on missing mapping', async () => {
    const db = { sql: vi.fn(async () => ({ rows: [] })) }
    const result = await resolveSolanaLotteryBeneficiary({
      db,
      buyerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
    })
    expect(result).toMatchObject({ ok: false, reason: 'missing_mapping' })
  })

  it('fail-closes on cross-account conflict (ambiguous mapping)', async () => {
    const db = {
      sql: vi.fn(async () => ({
        rows: [
          { profile_id: 'a', csw_address: '0x1111111111111111111111111111111111111111' },
          { profile_id: 'b', csw_address: '0x2222222222222222222222222222222222222222' },
        ],
      })),
    }
    const result = await resolveSolanaLotteryBeneficiary({
      db,
      buyerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
    })
    expect(result).toMatchObject({ ok: false, reason: 'ambiguous_mapping' })
  })

  it('never treats Solana pubkey as EVM address', async () => {
    const db = { sql: vi.fn(async () => ({ rows: [] })) }
    const solanaAsHexAttempt = 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'
    const result = await resolveSolanaLotteryBeneficiary({ db, buyerSolana: solanaAsHexAttempt })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('missing_mapping')
    }
  })

  it('rejects invalid solana pubkey', async () => {
    const db = { sql: vi.fn(async () => ({ rows: [] })) }
    const result = await resolveSolanaLotteryBeneficiary({ db, buyerSolana: '0xabc' })
    expect(result).toMatchObject({ ok: false, reason: 'invalid_solana_pubkey' })
    expect(db.sql).not.toHaveBeenCalled()
  })

  it('requires pw.chain = solana in the lookup predicate', async () => {
    const db = { sql: vi.fn(async () => ({ rows: [] })) }
    await resolveSolanaLotteryBeneficiary({
      db,
      buyerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
    })
    const fragments = db.sql.mock.calls[0]?.[0] as TemplateStringsArray
    expect(fragments.join('?')).toContain("LOWER(COALESCE(pw.chain, '')) = 'solana'")
  })
})
