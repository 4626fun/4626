import { getDb, isDbConfigured } from './db/postgres.js'

let keeprSchemaEnsured = false
let keeprSchemaEnsurePromise: Promise<void> | null = null

export async function ensureKeeprSchema(): Promise<void> {
  if (!isDbConfigured()) return
  const db = await getDb()
  if (!db) return
  if (keeprSchemaEnsured) return
  if (keeprSchemaEnsurePromise) return keeprSchemaEnsurePromise
  keeprSchemaEnsurePromise = (async () => {
    try {
      const preflight = await db.sql`
        SELECT
          to_regclass('public.keepr_vaults') IS NOT NULL AS has_keepr_vaults,
          to_regclass('public.keepr_vault_automation') IS NOT NULL AS has_keepr_vault_automation,
          to_regclass('public.keepr_nonces') IS NOT NULL AS has_keepr_nonces,
          to_regclass('public.keepr_actions') IS NOT NULL AS has_keepr_actions,
          to_regclass('public.keepr_logs') IS NOT NULL AS has_keepr_logs,
          to_regclass('public.keepr_join_requests') IS NOT NULL AS has_keepr_join_requests,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vaults'
              AND column_name = 'chain_id'
          ) AS has_vaults_chain_id,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vaults'
              AND column_name = 'group_id'
          ) AS has_vaults_group_id,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vaults'
              AND column_name = 'creator_coin_address'
          ) AS has_vaults_creator_coin_address,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vaults'
              AND column_name = 'canonical_owner_address'
          ) AS has_vaults_canonical_owner_address,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vaults'
              AND column_name = 'share_token_address'
          ) AS has_vaults_share_token_address,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vaults'
              AND column_name = 'config_json'
          ) AS has_vaults_config_json,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vaults'
              AND column_name = 'settled_at'
          ) AS has_vaults_settled_at,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vaults'
              AND column_name = 'settlement_stage'
          ) AS has_vaults_settlement_stage,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'profile_id'
          ) AS has_automation_profile_id,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'canonical_csw_address'
          ) AS has_automation_canonical_csw_address,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'embedded_eoa_address'
          ) AS has_automation_embedded_eoa_address,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'privy_wallet_id'
          ) AS has_automation_privy_wallet_id,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'authorization_source'
          ) AS has_automation_authorization_source,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'automation_enabled'
          ) AS has_automation_enabled,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'automation_scope'
          ) AS has_automation_scope,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'last_owner_check_at'
          ) AS has_automation_last_owner_check_at,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'revoked_at'
          ) AS has_automation_revoked_at,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_vault_automation'
              AND column_name = 'metadata'
          ) AS has_automation_metadata,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_actions'
              AND column_name = 'action_type'
          ) AS has_action_type,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_actions'
              AND column_name = 'dedupe_key'
          ) AS has_dedupe_key,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_actions'
              AND column_name = 'attempt_count'
          ) AS has_attempt_count,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_actions'
              AND column_name = 'next_attempt_at'
          ) AS has_next_attempt_at,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'keepr_join_requests'
              AND column_name = 'action_id'
          ) AS has_join_action_id;
      `
      const status = preflight.rows?.[0] ?? {}
      if (
        Boolean(status.has_keepr_vaults) &&
        Boolean(status.has_keepr_vault_automation) &&
        Boolean(status.has_keepr_nonces) &&
        Boolean(status.has_keepr_actions) &&
        Boolean(status.has_keepr_logs) &&
        Boolean(status.has_keepr_join_requests) &&
        Boolean(status.has_vaults_chain_id) &&
        Boolean(status.has_vaults_group_id) &&
        Boolean(status.has_vaults_creator_coin_address) &&
        Boolean(status.has_vaults_canonical_owner_address) &&
        Boolean(status.has_vaults_share_token_address) &&
        Boolean(status.has_vaults_config_json) &&
        Boolean(status.has_vaults_settled_at) &&
        Boolean(status.has_vaults_settlement_stage) &&
        Boolean(status.has_automation_profile_id) &&
        Boolean(status.has_automation_canonical_csw_address) &&
        Boolean(status.has_automation_embedded_eoa_address) &&
        Boolean(status.has_automation_privy_wallet_id) &&
        Boolean(status.has_automation_authorization_source) &&
        Boolean(status.has_automation_enabled) &&
        Boolean(status.has_automation_scope) &&
        Boolean(status.has_automation_last_owner_check_at) &&
        Boolean(status.has_automation_revoked_at) &&
        Boolean(status.has_automation_metadata) &&
        Boolean(status.has_action_type) &&
        Boolean(status.has_dedupe_key) &&
        Boolean(status.has_attempt_count) &&
        Boolean(status.has_next_attempt_at) &&
        Boolean(status.has_join_action_id)
      ) {
        keeprSchemaEnsured = true
        return
      }
      const missing: string[] = []
      if (!Boolean(status.has_keepr_vaults)) missing.push('public.keepr_vaults')
      if (!Boolean(status.has_keepr_vault_automation)) missing.push('public.keepr_vault_automation')
      if (!Boolean(status.has_keepr_nonces)) missing.push('public.keepr_nonces')
      if (!Boolean(status.has_keepr_actions)) missing.push('public.keepr_actions')
      if (!Boolean(status.has_keepr_logs)) missing.push('public.keepr_logs')
      if (!Boolean(status.has_keepr_join_requests)) missing.push('public.keepr_join_requests')
      if (!Boolean(status.has_vaults_chain_id)) missing.push('public.keepr_vaults.chain_id')
      if (!Boolean(status.has_vaults_group_id)) missing.push('public.keepr_vaults.group_id')
      if (!Boolean(status.has_vaults_creator_coin_address)) {
        missing.push('public.keepr_vaults.creator_coin_address')
      }
      if (!Boolean(status.has_vaults_canonical_owner_address)) {
        missing.push('public.keepr_vaults.canonical_owner_address')
      }
      if (!Boolean(status.has_vaults_share_token_address)) {
        missing.push('public.keepr_vaults.share_token_address')
      }
      if (!Boolean(status.has_vaults_config_json)) missing.push('public.keepr_vaults.config_json')
      if (!Boolean(status.has_vaults_settled_at)) missing.push('public.keepr_vaults.settled_at')
      if (!Boolean(status.has_vaults_settlement_stage)) {
        missing.push('public.keepr_vaults.settlement_stage')
      }
      if (!Boolean(status.has_automation_profile_id)) {
        missing.push('public.keepr_vault_automation.profile_id')
      }
      if (!Boolean(status.has_automation_canonical_csw_address)) {
        missing.push('public.keepr_vault_automation.canonical_csw_address')
      }
      if (!Boolean(status.has_automation_embedded_eoa_address)) {
        missing.push('public.keepr_vault_automation.embedded_eoa_address')
      }
      if (!Boolean(status.has_automation_privy_wallet_id)) {
        missing.push('public.keepr_vault_automation.privy_wallet_id')
      }
      if (!Boolean(status.has_automation_authorization_source)) {
        missing.push('public.keepr_vault_automation.authorization_source')
      }
      if (!Boolean(status.has_automation_enabled)) {
        missing.push('public.keepr_vault_automation.automation_enabled')
      }
      if (!Boolean(status.has_automation_scope)) {
        missing.push('public.keepr_vault_automation.automation_scope')
      }
      if (!Boolean(status.has_automation_last_owner_check_at)) {
        missing.push('public.keepr_vault_automation.last_owner_check_at')
      }
      if (!Boolean(status.has_automation_revoked_at)) {
        missing.push('public.keepr_vault_automation.revoked_at')
      }
      if (!Boolean(status.has_automation_metadata)) {
        missing.push('public.keepr_vault_automation.metadata')
      }
      if (!Boolean(status.has_action_type)) missing.push('public.keepr_actions.action_type')
      if (!Boolean(status.has_dedupe_key)) missing.push('public.keepr_actions.dedupe_key')
      if (!Boolean(status.has_attempt_count)) missing.push('public.keepr_actions.attempt_count')
      if (!Boolean(status.has_next_attempt_at)) missing.push('public.keepr_actions.next_attempt_at')
      if (!Boolean(status.has_join_action_id)) missing.push('public.keepr_join_requests.action_id')
      throw new Error(`keepr_schema_migration_required:${missing.join(',')}`)
    } catch (err) {
      keeprSchemaEnsured = false
      throw err
    } finally {
      keeprSchemaEnsurePromise = null
    }
  })()
  return keeprSchemaEnsurePromise
}
