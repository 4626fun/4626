import { describe, expect, it, vi } from 'vitest'

import {
  deriveMeteoraCustomizablePoolAddress,
  readSolanaMeteoraPoolStatusByShareMeshMint,
} from './solanaMeteoraPoolStatus.js'

const row = {
  id: 3,
  creator_token: '0x1111111111111111111111111111111111111111',
  share_oft: '0x2222222222222222222222222222222222222222',
  share_mesh_mint: 'ShareMesh111111111111111111111111111111111',
  quote_mint: 'So11111111111111111111111111111111111111112',
  pool_address: 'Pool111111111111111111111111111111111111111',
  status: 'created',
  provision_attempt_count: 1,
  last_signature: 'sig',
  last_error: null,
  source_session_id: null,
  updated_at: '2026-07-20T00:00:00.000Z',
}

describe('Solana Meteora pool status', () => {
  it('derives the same sorted-mint customizable pool PDA as the Meteora SDK', () => {
    const tokenMintX = '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY'
    const tokenMintY = 'So11111111111111111111111111111111111111112'
    const programId = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
    // Fixed output from @meteora-ag/dlmm@1.9.13
    // deriveCustomizablePermissionlessLbPair(x, y, programId).
    const expected = '5KpWu8s1oxFLavmPFVfm4SBdKchoXCXYTDGkDbL3Z7ib'
    expect(deriveMeteoraCustomizablePoolAddress({ tokenMintX, tokenMintY, programId })).toBe(expected)
    expect(deriveMeteoraCustomizablePoolAddress({ tokenMintX: tokenMintY, tokenMintY: tokenMintX, programId })).toBe(expected)
  })

  it('filters idempotent reads by the exact quote mint when supplied', async () => {
    const sql = vi.fn(async () => ({ rows: [row] }))
    const result = await readSolanaMeteoraPoolStatusByShareMeshMint({
      db: { sql } as any,
      shareMeshMint: row.share_mesh_mint,
      quoteMint: row.quote_mint,
    })
    expect(result?.quoteMint).toBe(row.quote_mint)
    const selectCall = (sql.mock.calls as unknown[][]).find((call) => String((call[0] as { join?: (separator: string) => string } | undefined)?.join?.(' ') ?? '').includes('SELECT *'))
    const values = selectCall?.slice(1) ?? []
    expect(values).toContain(row.share_mesh_mint)
    expect(values).toContain(row.quote_mint)
  })
})
