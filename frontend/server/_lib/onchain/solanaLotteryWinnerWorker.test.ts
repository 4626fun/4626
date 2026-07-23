import { describe, expect, it, vi } from 'vitest'
import { processSolanaLotteryWinnerBatch, resolveSolanaProvisionerBaseUrl, resolveSolanaProvisionerSecret } from './solanaLotteryWinnerWorker.js'

const row = { id: 9, base_tx_hash: `0x${'11'.repeat(32)}`, base_log_index: 4,
  base_request_id: '77', creator_token: `0x${'22'.repeat(20)}`,
  beneficiary_csw: `0x${'33'.repeat(20)}`, creator_mint: 'So11111111111111111111111111111111111111112',
  winner_solana: '11111111111111111111111111111111', shares_paid: '42', status: 'pending' }

function dbWithClaim() {
  return { sql: vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(' ')
    if (query.includes('INSERT INTO solana_lottery_winner_settlement')) return { rows: [row] }
    if (query.includes('stale_submitting_recovered')) return { rows: [] }
    if (query.includes("win_id LIKE 'pending:%'")) return { rows: [] }
    if (query.includes('WITH candidates AS (') && query.includes("status = 'submitting'")) {
      return { rows: [{ ...row, win_id: `0x${'44'.repeat(32)}` }] }
    }
    if (query.includes("SET status = 'confirmed'")) return { rows: [{ id: 9 }] }
    return { rows: [] }
  }) }
}

describe('Solana lottery winner worker', () => {
  it('resolves the shared provisioner bearer fallback without logging secrets', () => {
    expect(resolveSolanaProvisionerSecret({
      SOLANA_HOOK_PROVISIONER_SECRET: '',
      SOLANA_METEORA_POOL_PROVISIONER_SECRET: 'pool-secret',
      METEORA_IX_PROVISIONER_SECRET: 'legacy-secret',
    })).toBe('pool-secret')
  })

  it('strips the setup endpoint before posting a winner settlement', async () => {
    expect(resolveSolanaProvisionerBaseUrl(' https://provisioner.4626.fun/setup-creator/ '))
      .toBe('https://provisioner.4626.fun')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://provisioner.4626.fun/record-lottery-winner')
      return new Response(JSON.stringify({ success: true, status: 'recorded',
        winId: `0x${'44'.repeat(32)}`, signature: null,
        winIdRecord: 'win-pda', winnerRecord: 'winner-pda' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('SOLANA_HOOK_PROVISIONER_URL', 'https://provisioner.4626.fun/setup-creator')
    vi.stubEnv('SOLANA_HOOK_PROVISIONER_SECRET', 'hook-secret')
    try {
      const result = await processSolanaLotteryWinnerBatch({ db: dbWithClaim() as any })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.confirmed).toBe(1)
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })

  it('confirms an idempotent already-recorded readback exactly once', async () => {
    const db = dbWithClaim()
    const settle = vi.fn(async (request: any) => ({ status: 'already_recorded' as const,
      winId: request.winId, signature: null, winIdRecord: 'win-pda', winnerRecord: 'winner-pda' }))
    const result = await processSolanaLotteryWinnerBatch({ db: db as any, settle })
    expect(settle).toHaveBeenCalledTimes(1)
    expect(result.confirmed).toBe(1)
  })

  it('returns transient provisioner failures to pending for retry', async () => {
    const result = await processSolanaLotteryWinnerBatch({ db: dbWithClaim() as any,
      settle: vi.fn().mockRejectedValue(new Error('winner_settlement_provisioner_502')) })
    expect(result.retried).toBe(1)
    expect(result.quarantined).toBe(0)
  })

  it('quarantines mismatched replay/readback acknowledgements', async () => {
    const result = await processSolanaLotteryWinnerBatch({ db: dbWithClaim() as any,
      settle: vi.fn(async () => ({ status: 'recorded' as const, winId: `0x${'55'.repeat(32)}`,
        signature: 'sig', winIdRecord: 'win-pda', winnerRecord: 'winner-pda' })) })
    expect(result.quarantined).toBe(1)
    expect(result.retried).toBe(0)
  })
})
