import { describe, expect, it, vi } from 'vitest'

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureSolanaCreatorRelayConfigSchema: vi.fn(async () => {}),
}))
import {
  assertSolanaB2ActivationEvidence,
  markSolanaCreatorRelayEnabled,
  type SolanaB2ActivationEvidence,
  upsertSolanaCreatorRelayReadiness,
} from './solanaCreatorRelayConfig.js'

const SHARE_MESH_MINT = 'So11111111111111111111111111111111111111112'
const SOURCE_EVENT_ID =
  `5eykt4UsFv8NJdTREpY1vzqKqZKvdpKuc147dw2N9d:` +
  `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU:${'2'.repeat(64)}:0:0`

const complete: SolanaB2ActivationEvidence = {
  canonicalHookSchemaConfirmed: true,
  provisionerHealthConfirmed: true,
  provisionerBearerSecretConfirmed: true,
  meteoraTokenBadgeVerified: true,
  sameHookMintUsedByMeteoraPool: true,
  fundedLiveBuyCanarySucceeded: true,
  pendingEntryObserved: true,
  relayReachedBaseExactlyOnce: true,
  relayReplayProtectionPassed: true,
  winnerSettlementReadbackPassed: true,
  oappPeersAuthorized: true,
  oappDvnPolicyConfirmed: true,
  failureRetryVerified: true,
  rollbackDocumented: true,
  transportReviewApproved: true,
  dryRunCanaryPassed: true,
  devnetRehearsalPassed: true,
  fundedMainnetCanaryPassed: true,
  explicitProductionApproval: true,
  approvalRef: 'ops-approval-2026-07-20',
  offlineValidationRef: 'ci-validation-2026-07-20',
  devnetRehearsalRef: 'devnet-rehearsal-2026-07-20',
  dvnVerificationRef: 'dvn-3of5-verification-2026-07-20',
  failureRetryRef: 'retry-rehearsal-2026-07-20',
  mainnetCanaryApprovalRef: 'mainnet-canary-approval-2026-07-20',
  sourceEventId: SOURCE_EVENT_ID,
  layerZeroGuid: `0x${'3'.repeat(64)}`,
  baseTxHash: `0x${'4'.repeat(64)}`,
  winnerSettlementSolanaSignature: '5'.repeat(64),
}

describe('assertSolanaB2ActivationEvidence', () => {
  it('accepts only a complete gate record with a durable approval ref', () => {
    expect(() => assertSolanaB2ActivationEvidence(complete)).not.toThrow()
    expect(() => assertSolanaB2ActivationEvidence({ ...complete, fundedMainnetCanaryPassed: false }))
      .toThrow('b2_activation_gates_incomplete:fundedMainnetCanaryPassed')
    expect(() => assertSolanaB2ActivationEvidence({ ...complete, approvalRef: '' }))
      .toThrow('b2_activation_approval_ref_required')
    expect(() => assertSolanaB2ActivationEvidence({ ...complete, devnetRehearsalRef: '' }))
      .toThrow('b2_activation_devnetRehearsalRef_required')
    expect(() => assertSolanaB2ActivationEvidence({ ...complete, sourceEventId: 'devnet:hook:sig:0:0' }))
      .toThrow('b2_activation_source_event_id_invalid')
    expect(() => assertSolanaB2ActivationEvidence({
      ...complete,
      sourceEventId: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1:EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU:${'2'.repeat(64)}:0:0`,
    })).toThrow('b2_activation_source_event_not_canonical_mainnet_hook')
    const omitted = { ...complete } as Partial<SolanaB2ActivationEvidence>
    delete omitted.relayReachedBaseExactlyOnce
    expect(() => assertSolanaB2ActivationEvidence(omitted as SolanaB2ActivationEvidence))
      .toThrow('b2_activation_gates_incomplete:relayReachedBaseExactlyOnce')
  })

  it('fail-closes an already-enabled creator when reconciliation fails', async () => {
    const sql = async (strings: TemplateStringsArray) => {
      const query = strings.join(' ')
      if (query.includes('CREATE TABLE') || query.includes('ALTER TABLE') || query.includes('CREATE INDEX')) return { rows: [] }
      expect(query).toContain("WHEN EXCLUDED.readiness_status = 'verified'")
      expect(query).toContain('ELSE FALSE')
      return { rows: [{
        id: 1, creator_token: `0x${'11'.repeat(20)}`, share_oft: `0x${'22'.repeat(20)}`,
        share_mesh_mint: SHARE_MESH_MINT, relay_enabled: false, readiness_status: 'failed',
        readiness_checks_json: [], b2_verified_at: null, relay_enabled_at: null,
        last_error: 'pool_mismatch', source_session_id: null, updated_at: new Date().toISOString(),
      }] }
    }
    const row = await upsertSolanaCreatorRelayReadiness({
      db: { sql } as any, creatorToken: `0x${'11'.repeat(20)}`, shareOft: `0x${'22'.repeat(20)}`,
      shareMeshMint: SHARE_MESH_MINT, readinessStatus: 'failed', readinessChecksJson: [], lastError: 'pool_mismatch',
    })
    expect(row.relayEnabled).toBe(false)
  })

  it('requires finalized hook PDA evidence before relay activation', async () => {
    let requiredChecksJson = ''
    let activationSql = ''
    const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join(' ').includes('UPDATE solana_creator_relay_config')) {
        activationSql = strings.join(' ')
        requiredChecksJson = String(
          values.find((value) => typeof value === 'string' && value.startsWith('[{')) ?? '',
        )
        return {
          rows: [{
            id: 1,
            creator_token: `0x${'11'.repeat(20)}`,
            share_oft: `0x${'22'.repeat(20)}`,
            share_mesh_mint: SHARE_MESH_MINT,
            relay_enabled: true,
            readiness_status: 'verified',
            readiness_checks_json: [],
            b2_verified_at: new Date().toISOString(),
            relay_enabled_at: new Date().toISOString(),
            last_error: null,
            source_session_id: null,
            updated_at: new Date().toISOString(),
          }],
        }
      }
      return { rows: [] }
    }
    const row = await markSolanaCreatorRelayEnabled({
      db: { sql } as any,
      shareMeshMint: SHARE_MESH_MINT,
      evidence: complete,
    })
    expect(row?.relayEnabled).toBe(true)
    expect(activationSql).toContain('FROM solana_b2_canary_authorizations')
    expect(activationSql).toContain('FROM solana_lottery_entry_inbox inbox')
    expect(activationSql).toContain('inbox.cluster_genesis_hash =')
    expect(activationSql).toContain('inbox.program_id =')
    expect(activationSql).toContain('FROM solana_lottery_winner_settlement winner')
    expect(activationSql).toContain('LOWER(winner.base_tx_hash) =')
    expect(activationSql).toContain('winner.base_request_id = inbox.base_request_id')
    expect(activationSql).toContain("NULLIF(winner.win_id_record, '') IS NOT NULL")
    expect(JSON.parse(requiredChecksJson)).toEqual(expect.arrayContaining([
      { id: 'hook_pdas_onchain', passed: true },
      { id: 'creator_config_onchain', passed: true },
      { id: 'pending_entries_onchain', passed: true },
      { id: 'winner_record_onchain', passed: true },
      { id: 'extra_account_meta_onchain', passed: true },
      { id: 'pool_account_onchain', passed: true },
      { id: 'meteora_token_badge', passed: true },
      { id: 'hook_mint_program_owner', passed: true },
    ]))
  })

  it('requires the current 3-of-5 DVN policy evidence', () => {
    expect(() => assertSolanaB2ActivationEvidence({ ...complete, oappDvnPolicyConfirmed: false }))
      .toThrow('b2_activation_gates_incomplete:oappDvnPolicyConfirmed')
  })
})
