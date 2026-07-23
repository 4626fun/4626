import { describe, expect, it, vi } from 'vitest'

import { reconcileSolanaHookStatus } from './solanaHookStatus.js'

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureSolanaHookStatusSchema: vi.fn(async () => {}),
}))

const row = {
  id: '9',
  creator_token: '0xcreator',
  share_oft: '0xshare',
  hook_mint: 'HookMint111111111111111111111111111111111',
  creator_config: 'CreatorConfig111111111111111111111111111111',
  pending_entries: 'PendingEntries111111111111111111111111111',
  winner_record: 'WinnerRecord11111111111111111111111111111',
  status: 'failed',
  provision_attempt_count: 2,
  last_error: 'pending_entries_missing',
  source_session_id: 'session-1',
  updated_at: '2026-07-20T00:00:00.000Z',
}

describe('reconcileSolanaHookStatus', () => {
  it('upserts finalized addresses when readiness evidence has no prior row', async () => {
    const sql = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => ({ rows: [row] }))

    const result = await reconcileSolanaHookStatus({
      db: { sql },
      creatorToken: '0xCREATOR',
      shareOft: '0xSHARE',
      hookMint: row.hook_mint,
      creatorConfig: row.creator_config,
      pendingEntries: row.pending_entries,
      winnerRecord: row.winner_record,
      status: 'failed',
      lastError: row.last_error,
      sourceSessionId: row.source_session_id,
    })

    expect(result).toMatchObject({
      creatorToken: '0xcreator',
      hookMint: row.hook_mint,
      pendingEntries: row.pending_entries,
      status: 'failed',
    })
    const query = String(sql.mock.calls[0]?.[0]?.join?.('') ?? '')
    expect(query).toContain('INSERT INTO solana_hook_status')
    expect(query).toContain('ON CONFLICT (creator_token)')
    expect(sql.mock.calls[0]).toContain('0xcreator')
    expect(sql.mock.calls[0]).toContain('pending_entries_missing')
  })
})
