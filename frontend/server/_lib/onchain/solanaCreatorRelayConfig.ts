import { PublicKey } from '@solana/web3.js'

import { ensureSolanaCreatorRelayConfigSchema } from '../db/schemaBootstrap.js'
import { parseSolanaLotterySourceEventId } from './solanaLotterySourceEventId.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SolanaCreatorRelayReadinessStatus = 'pending' | 'verified' | 'failed'

export type SolanaCreatorRelayConfigRow = {
  id: number
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  relayEnabled: boolean
  readinessStatus: SolanaCreatorRelayReadinessStatus
  readinessChecksJson: unknown
  b2VerifiedAt: string | null
  relayEnabledAt: string | null
  lastError: string | null
  sourceSessionId: string | null
  updatedAt: string
}

function mapRow(row: any): SolanaCreatorRelayConfigRow {
  return {
    id: Number(row.id),
    creatorToken: String(row.creator_token ?? ''),
    shareOft: String(row.share_oft ?? ''),
    shareMeshMint: String(row.share_mesh_mint ?? ''),
    relayEnabled: Boolean(row.relay_enabled),
    readinessStatus: String(row.readiness_status ?? 'pending') as SolanaCreatorRelayReadinessStatus,
    readinessChecksJson: row.readiness_checks_json ?? null,
    b2VerifiedAt: row.b2_verified_at ? new Date(row.b2_verified_at).toISOString() : null,
    relayEnabledAt: row.relay_enabled_at ? new Date(row.relay_enabled_at).toISOString() : null,
    lastError: row.last_error ? String(row.last_error) : null,
    sourceSessionId: row.source_session_id ? String(row.source_session_id) : null,
    updatedAt: new Date(row.updated_at ?? Date.now()).toISOString(),
  }
}

export async function readSolanaCreatorRelayConfigByShareMeshMint(params: {
  db: Db
  shareMeshMint: string
}): Promise<SolanaCreatorRelayConfigRow | null> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const shareMeshMint = String(params.shareMeshMint ?? '').trim()
  if (!shareMeshMint) return null
  const result = await params.db.sql`
    SELECT *
    FROM solana_creator_relay_config
    WHERE share_mesh_mint = ${shareMeshMint}
    LIMIT 1;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}

export async function readSolanaCreatorRelayConfigByCreatorToken(params: {
  db: Db
  creatorToken: string
}): Promise<SolanaCreatorRelayConfigRow | null> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const creatorToken = String(params.creatorToken ?? '').trim().toLowerCase()
  if (!creatorToken) return null
  const result = await params.db.sql`
    SELECT *
    FROM solana_creator_relay_config
    WHERE creator_token = ${creatorToken}
    ORDER BY updated_at DESC
    LIMIT 1;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}

export async function listRelayEnabledShareMeshMints(params: { db: Db }): Promise<string[]> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const result = await params.db.sql`
    SELECT share_mesh_mint
    FROM solana_creator_relay_config
    WHERE relay_enabled = TRUE
    ORDER BY share_mesh_mint ASC;
  `
  return (result.rows ?? [])
    .map((row) => String(row.share_mesh_mint ?? '').trim())
    .filter((mint) => mint.length > 0)
}

export async function upsertSolanaCreatorRelayReadiness(params: {
  db: Db
  creatorToken: string
  shareOft: string
  shareMeshMint: string
  readinessStatus: SolanaCreatorRelayReadinessStatus
  readinessChecksJson: unknown
  lastError?: string | null
  sourceSessionId?: string | null
}): Promise<SolanaCreatorRelayConfigRow> {
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const creatorToken = params.creatorToken.trim().toLowerCase()
  const shareOft = params.shareOft.trim().toLowerCase()
  const shareMeshMint = params.shareMeshMint.trim()
  const b2VerifiedAt = params.readinessStatus === 'verified' ? new Date().toISOString() : null
  const result = await params.db.sql`
    INSERT INTO solana_creator_relay_config (
      creator_token,
      share_oft,
      share_mesh_mint,
      relay_enabled,
      readiness_status,
      readiness_checks_json,
      b2_verified_at,
      last_error,
      source_session_id,
      updated_at
    ) VALUES (
      ${creatorToken},
      ${shareOft},
      ${shareMeshMint},
      FALSE,
      ${params.readinessStatus},
      ${JSON.stringify(params.readinessChecksJson ?? null)}::jsonb,
      ${b2VerifiedAt},
      ${params.lastError ?? null},
      ${params.sourceSessionId ?? null},
      NOW()
    )
    ON CONFLICT (share_mesh_mint)
    DO UPDATE SET
      creator_token = EXCLUDED.creator_token,
      share_oft = EXCLUDED.share_oft,
      relay_enabled = CASE
        WHEN EXCLUDED.readiness_status = 'verified' THEN solana_creator_relay_config.relay_enabled
        ELSE FALSE
      END,
      relay_enabled_at = CASE
        WHEN EXCLUDED.readiness_status = 'verified' THEN solana_creator_relay_config.relay_enabled_at
        ELSE NULL
      END,
      readiness_status = EXCLUDED.readiness_status,
      readiness_checks_json = EXCLUDED.readiness_checks_json,
      b2_verified_at = COALESCE(EXCLUDED.b2_verified_at, solana_creator_relay_config.b2_verified_at),
      last_error = EXCLUDED.last_error,
      source_session_id = COALESCE(EXCLUDED.source_session_id, solana_creator_relay_config.source_session_id),
      updated_at = NOW()
    RETURNING *;
  `
  return mapRow((result.rows ?? [])[0])
}

export type SolanaB2ActivationEvidence = {
  canonicalHookSchemaConfirmed: boolean
  provisionerHealthConfirmed: boolean
  provisionerBearerSecretConfirmed: boolean
  meteoraTokenBadgeVerified: boolean
  sameHookMintUsedByMeteoraPool: boolean
  fundedLiveBuyCanarySucceeded: boolean
  pendingEntryObserved: boolean
  relayReachedBaseExactlyOnce: boolean
  relayReplayProtectionPassed: boolean
  winnerSettlementReadbackPassed: boolean
  oappPeersAuthorized: boolean
  oappDvnPolicyConfirmed: boolean
  failureRetryVerified: boolean
  rollbackDocumented: boolean
  transportReviewApproved: boolean
  dryRunCanaryPassed: boolean
  devnetRehearsalPassed: boolean
  fundedMainnetCanaryPassed: boolean
  explicitProductionApproval: boolean
  approvalRef: string
  offlineValidationRef: string
  devnetRehearsalRef: string
  dvnVerificationRef: string
  failureRetryRef: string
  mainnetCanaryApprovalRef: string
  sourceEventId: string
  layerZeroGuid: string
  baseTxHash: string
  winnerSettlementSolanaSignature: string
}

const MAINNET_SOLANA_GENESIS_HASH = '5eykt4UsFv8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
const CANONICAL_CREATOR_SHARE_HOOK_PROGRAM_ID = 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'

const REQUIRED_B2_ACTIVATION_GATES = [
  'canonicalHookSchemaConfirmed',
  'provisionerHealthConfirmed',
  'provisionerBearerSecretConfirmed',
  'meteoraTokenBadgeVerified',
  'sameHookMintUsedByMeteoraPool',
  'fundedLiveBuyCanarySucceeded',
  'pendingEntryObserved',
  'relayReachedBaseExactlyOnce',
  'relayReplayProtectionPassed',
  'winnerSettlementReadbackPassed',
  'oappPeersAuthorized',
  'oappDvnPolicyConfirmed',
  'failureRetryVerified',
  'rollbackDocumented',
  'transportReviewApproved',
  'dryRunCanaryPassed',
  'devnetRehearsalPassed',
  'fundedMainnetCanaryPassed',
  'explicitProductionApproval',
] as const satisfies ReadonlyArray<Exclude<keyof SolanaB2ActivationEvidence, 'approvalRef'>>

export function assertSolanaB2ActivationEvidence(evidence: SolanaB2ActivationEvidence): void {
  const approvalRef = String(evidence.approvalRef ?? '').trim()
  if (approvalRef.length < 8 || approvalRef.length > 200) throw new Error('b2_activation_approval_ref_required')
  for (const [key, value] of [
    ['offlineValidationRef', evidence.offlineValidationRef],
    ['devnetRehearsalRef', evidence.devnetRehearsalRef],
    ['dvnVerificationRef', evidence.dvnVerificationRef],
    ['failureRetryRef', evidence.failureRetryRef],
    ['mainnetCanaryApprovalRef', evidence.mainnetCanaryApprovalRef],
  ] as const) {
    const ref = String(value ?? '').trim()
    if (ref.length < 8 || ref.length > 200) throw new Error(`b2_activation_${key}_required`)
  }
  let sourceParts: ReturnType<typeof parseSolanaLotterySourceEventId>
  try {
    sourceParts = parseSolanaLotterySourceEventId(String(evidence.sourceEventId ?? ''))
    new PublicKey(sourceParts.programId)
  } catch {
    throw new Error('b2_activation_source_event_id_invalid')
  }
  if (
    sourceParts.signature.length < 64 ||
    sourceParts.signature.length > 88 ||
    !/^[1-9A-HJ-NP-Za-km-z]+$/.test(sourceParts.signature)
  ) {
    throw new Error('b2_activation_source_event_id_invalid')
  }
  if (
    sourceParts.clusterGenesisHash !== MAINNET_SOLANA_GENESIS_HASH ||
    sourceParts.programId !== CANONICAL_CREATOR_SHARE_HOOK_PROGRAM_ID
  ) {
    throw new Error('b2_activation_source_event_not_canonical_mainnet_hook')
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(evidence.layerZeroGuid ?? ''))) {
    throw new Error('b2_activation_layerzero_guid_invalid')
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(evidence.baseTxHash ?? ''))) {
    throw new Error('b2_activation_base_tx_hash_invalid')
  }
  const winnerSignature = String(evidence.winnerSettlementSolanaSignature ?? '').trim()
  if (winnerSignature.length < 64 || winnerSignature.length > 88 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(winnerSignature)) {
    throw new Error('b2_activation_winner_settlement_signature_invalid')
  }
  const missing = REQUIRED_B2_ACTIVATION_GATES.filter((key) => evidence?.[key] !== true)
  if (missing.length > 0) throw new Error(`b2_activation_gates_incomplete:${missing.join(',')}`)
}

export async function markSolanaCreatorRelayEnabled(params: {
  db: Db
  shareMeshMint: string
  evidence: SolanaB2ActivationEvidence
}): Promise<SolanaCreatorRelayConfigRow | null> {
  assertSolanaB2ActivationEvidence(params.evidence)
  await ensureSolanaCreatorRelayConfigSchema(params.db)
  const shareMeshMint = params.shareMeshMint.trim()
  if (!shareMeshMint) return null
  try {
    if (new PublicKey(shareMeshMint).toBase58() !== shareMeshMint) return null
  } catch {
    return null
  }
  const sourceEventId = params.evidence.sourceEventId.trim()
  const layerZeroGuid = params.evidence.layerZeroGuid.trim().toLowerCase()
  const baseTxHash = params.evidence.baseTxHash.trim().toLowerCase()
  const winnerSettlementSolanaSignature = params.evidence.winnerSettlementSolanaSignature.trim()
  const mainnetCanaryApprovalRef = params.evidence.mainnetCanaryApprovalRef.trim()
  const requiredReadinessChecks = [
    { id: 'share_mesh_mapping', passed: true },
    { id: 'share_mesh_mint_matches_mapping', passed: true },
    { id: 'registry_share_oft_matches', passed: true },
    { id: 'meteora_pool_created', passed: true },
    { id: 'pool_account_onchain', passed: true },
    { id: 'hook_lane_created', passed: true },
    { id: 'hook_mint_matches_share_mesh', passed: true },
    { id: 'hook_share_oft_matches_mapping', passed: true },
    { id: 'hook_pdas_onchain', passed: true },
    { id: 'creator_config_onchain', passed: true },
    { id: 'creator_config_mint_matches', passed: true },
    { id: 'creator_config_hub_mapping_matches', passed: true },
    { id: 'creator_config_fee_zero', passed: true },
    { id: 'creator_config_lottery_enabled', passed: true },
    { id: 'creator_config_amm_allowlist', passed: true },
    { id: 'pending_entries_onchain', passed: true },
    { id: 'pending_entries_pda_matches_derived', passed: true },
    { id: 'pending_entries_buffer_reconciled', passed: true },
    { id: 'winner_record_onchain', passed: true },
    { id: 'extra_account_meta_onchain', passed: true },
    { id: 'meteora_pool_program_owner', passed: true },
    { id: 'meteora_token_badge', passed: true },
    { id: 'meteora_pool_mint_alignment', passed: true },
    { id: 'hook_mint_program_owner', passed: true },
    { id: 'transfer_hook_program', passed: true },
    { id: 'transfer_fee_zero', passed: true },
    { id: 'oft_store_mint_authority', passed: true },
    { id: 'oapp_solana_peer_authorized', passed: true },
    { id: 'oapp_operator_authorized', passed: true },
    { id: 'oapp_endpoint_program_authorized', passed: true },
    { id: 'oapp_base_peer_authorized', passed: true },
  ] as Array<{ id: string; passed: true }>
  if (String(process.env.SOLANA_KEEPER_PUBKEY ?? '').trim()) {
    requiredReadinessChecks.push({ id: 'creator_config_keeper_authorized', passed: true })
  }
  const result = await params.db.sql`
    UPDATE solana_creator_relay_config
    SET
      relay_enabled = TRUE,
      relay_enabled_at = NOW(),
      readiness_checks_json = COALESCE(readiness_checks_json, '{}'::jsonb) ||
        jsonb_build_object('activationEvidence', ${JSON.stringify(params.evidence)}::jsonb),
      updated_at = NOW()
    WHERE share_mesh_mint = ${shareMeshMint}
      AND readiness_status = 'verified'
      AND readiness_checks_json @> ${JSON.stringify(requiredReadinessChecks)}::jsonb
      AND EXISTS (
        SELECT 1
        FROM solana_b2_canary_authorizations authorization
        WHERE authorization.source_event_id = ${sourceEventId}
          AND authorization.share_mesh_mint = ${shareMeshMint}
          AND authorization.approval_ref = ${mainnetCanaryApprovalRef}
          AND authorization.status = 'consumed'
          AND authorization.consumed_at IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM solana_lottery_entry_inbox inbox
        WHERE inbox.source_event_id = ${sourceEventId}
          AND inbox.cluster_genesis_hash = ${MAINNET_SOLANA_GENESIS_HASH}
          AND inbox.program_id = ${CANONICAL_CREATOR_SHARE_HOOK_PROGRAM_ID}
          AND inbox.creator_mint = ${shareMeshMint}
          AND inbox.instruction_kind = 'buy_path'
          AND inbox.status = 'confirmed'
          AND inbox.coverage_share_balance = 0
          AND LOWER(inbox.lz_guid) = ${layerZeroGuid}
          AND LOWER(inbox.base_tx_hash) = ${baseTxHash}
          AND inbox.transport_source_tx_hash IS NOT NULL
          AND inbox.confirmed_at IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM solana_lottery_entry_inbox duplicate
            WHERE duplicate.id <> inbox.id
              AND (
                LOWER(duplicate.lz_guid) = ${layerZeroGuid}
                OR LOWER(duplicate.base_tx_hash) = ${baseTxHash}
              )
          )
      )
      AND EXISTS (
        SELECT 1
        FROM solana_lottery_winner_settlement winner
        JOIN solana_lottery_entry_inbox inbox ON inbox.id = winner.entry_inbox_id
        WHERE inbox.source_event_id = ${sourceEventId}
          AND winner.creator_mint = ${shareMeshMint}
          AND LOWER(winner.base_tx_hash) = ${baseTxHash}
          AND inbox.base_request_id IS NOT NULL
          AND winner.base_request_id = inbox.base_request_id
          AND winner.status = 'confirmed'
          AND winner.solana_signature = ${winnerSettlementSolanaSignature}
          AND winner.confirmed_at IS NOT NULL
          AND NULLIF(winner.win_id_record, '') IS NOT NULL
          AND NULLIF(winner.winner_record, '') IS NOT NULL
      )
    RETURNING *;
  `
  const row = (result.rows ?? [])[0]
  return row ? mapRow(row) : null
}
