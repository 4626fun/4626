#!/usr/bin/env tsx
/**
 * Classify zero-row public tables by runtime usage.
 *
 * Verdicts:
 *   - dropped              : already removed from prod (20260714 cleanup pass)
 *   - protected            : explicit keep (Telegram surface)
 *   - active-consolidated  : post-20260714 identity tables (always audited, never dropped here)
 *   - indexer-only         : live in indexer/, not frontend/kpr runtime
 *   - truly-dead           : zero code refs outside migrations
 *   - schema-only          : migration DDL only
 *   - feature-scaffold     : live runtime SQL despite zero rows
 *
 * Denormalization backlog (manual review — do not auto-drop):
 *   Solana roles → profile_wallets.is_canonical_solana_wallet / is_operational_solana_wallet
 *   wallet_directory       ↔ profiles display cache (chat-wide vs account-scoped)
 */

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Tables dropped in supabase/migrations/20260714*.sql — skip re-audit. */
const DROPPED_TABLES = new Set([
  'accounts',
  'creator_wallets',
  'creator_agent_wallets',
  'creator_xmtp_agents',
  'csw_owner_link_status',
  'referral_clicks',
  'index_usage_snapshots',
  'sankey_lookerstudio_full_dataset',
  'workspace_alert_events',
  'workspace_approvals',
  'workspace_audit_logs',
  'workspace_monitoring_snapshots',
  'workspace_notification_preferences',
  'workspace_strategy_targets',
  'workspace_activity_events',
  'workspace_task_state',
  'vault_chat_policies',
  'vault_chat_memberships',
  'wallets',
  'message_threads',
  'thread_messages',
  'thread_participants',
  'thread_summaries',
  'payment_rail_attempts',
  'base_address_activity_30d',
  'farcaster_rollout_events',
  'alfaclub_chat_ingest',
  'v_zora_profiles_refresh_freshness',
])

/** Post-consolidation identity tables — active, never classify as dead. */
const ACTIVE_CONSOLIDATED = new Set([
  'wallet_directory',
  'v_wallet_directory',
  'creator_infrastructure',
  'profile_wallets',
  'profiles',
  'allowlist',
  'privy_user_aliases',
  'account_linked_methods',
  'account_zora_signals',
])

/** Used by indexer/ scripts only (not frontend/kpr). */
const INDEXER_ONLY = new Set(['zora_coin_holders'])

/** Product decision: keep Telegram tables even when zero-row. */
const PROTECTED_TABLES = new Set([
  'telegram_chat_vault_scope',
  'telegram_holder_room_members',
  'telegram_holder_room_policies',
  'telegram_inline_signal_feeds',
  'telegram_link_start_token_claims',
  'telegram_miniapp_replay_nonces',
  'telegram_miniapp_sessions',
  'telegram_private_dm_welcome_sent',
  'telegram_trade_percent_prompts',
  'telegram_action_audit',
  'telegram_action_tokens',
  'telegram_active_messages',
  'telegram_funnel_events',
  'telegram_link_telemetry_events',
  'telegram_onboarding_sessions',
  'telegram_user_links',
])

const CANDIDATES = [
  'feedback_index',
  'grove_chat_manifests',
  'task_loops',
  'keepr_join_requests',
  'keepr_nonces',
  'keepr_vault_automation',
  'lottery_amoe_nonces',
  'lottery_amoe_entries',
  'auth_nonces',
  'auth_agent_nonces',
  'wallet_intelligence_cache',
  'deploys',
  'referral_conversions',
  'lottery_amoe_daily_twitter_checkins',
  'keepr_logs',
  'keepr_workflow_checkpoints',
  'ajna_vaults',
  'amoe_points_burn_ledger',
  'payment_events',
  'payment_orders',
  'waitlist_leads',
  'amoe_burn_credits_intents',
  'auth_handoffs',
  'chat_friend_requests',
  'chat_presence_sessions',
  'command_issuer_daily_spend',
  'ethos_score_sync_state',
  'image_generation_assets',
  'image_generation_attempts',
  'image_generation_jobs',
  'image_generation_projects',
  'lottery_amoe_daily_xmtp_checkins',
  'memory_snapshots',
  'solana_creator_relay_config',
  'solana_hook_status',
  'solana_meteora_pool_status',
  'solana_share_mesh_mappings',
  'solana_sweep_jobs',
  'entity_labels_cache',
  'agent_background_tasks',
  'agent_registration_state',
  'website_events',
]

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)), '..')

function countMatches(pattern: string): Array<{ file: string; count: number }> {
  try {
    const args = [
      '-c',
      '-g',
      '!supabase/migrations/**',
      '-g',
      '!docs/_generated/**',
      '-g',
      '!frontend/scripts/audit-dead-tables.ts',
      '-g',
      '!frontend/db/migrations-legacy/**',
      `\\b${pattern}\\b`,
      REPO,
    ]
    const out = execFileSync('rg', args, { encoding: 'utf8' })
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [file, c] = line.split(':')
        return { file: file?.replace(REPO + '/', '') ?? '', count: Number(c) || 0 }
      })
  } catch {
    return []
  }
}

function countMigrationRefs(pattern: string): number {
  try {
    const out = execFileSync(
      'rg',
      ['-c', '-g', 'supabase/migrations/**', `\\b${pattern}\\b`, REPO],
      { encoding: 'utf8' },
    )
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => Number(line.split(':').pop()) || 0)
      .reduce((a, b) => a + b, 0)
  } catch {
    return 0
  }
}

async function main() {
  const dropped = [...DROPPED_TABLES].sort()
  console.log(`\n── DROPPED (${dropped.length}) ──`)
  for (const table of dropped) console.log(`  ${table}`)

  const protectedTables = [...PROTECTED_TABLES].sort()
  console.log(`\n── PROTECTED / TELEGRAM (${protectedTables.length}) ──`)
  for (const table of protectedTables) console.log(`  ${table}`)

  const consolidated = [...ACTIVE_CONSOLIDATED].sort()
  console.log(`\n── ACTIVE / CONSOLIDATED (${consolidated.length}) ──`)
  for (const table of consolidated) {
    const hits = countMatches(table).reduce((sum, r) => sum + r.count, 0)
    console.log(`  ${table.padEnd(40)} refs=${hits}`)
  }

  const indexerOnly = [...INDEXER_ONLY].sort()
  console.log(`\n── INDEXER-ONLY (${indexerOnly.length}) ──`)
  for (const table of indexerOnly) {
    const hits = countMatches(table).reduce((sum, r) => sum + r.count, 0)
    console.log(`  ${table.padEnd(40)} refs=${hits}`)
  }

  const verdicts: Array<{
    table: string
    migrationRefs: number
    codeRefs: number
    verdict: 'truly-dead' | 'schema-only' | 'feature-scaffold'
    topFiles: string[]
  }> = []

  for (const table of CANDIDATES) {
    if (DROPPED_TABLES.has(table) || PROTECTED_TABLES.has(table)) continue
    const codeHits = countMatches(table)
    const migrationRefs = countMigrationRefs(table)
    const codeRefs = codeHits.reduce((sum, r) => sum + r.count, 0)
    const topFiles = codeHits
      .filter((h) => !h.file.includes('__tests__') && !h.file.includes('.test.'))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((h) => `${h.file}:${h.count}`)

    let verdict: 'truly-dead' | 'schema-only' | 'feature-scaffold'
    if (codeRefs === 0 && migrationRefs === 0) verdict = 'truly-dead'
    else if (codeRefs === 0) verdict = 'schema-only'
    else verdict = 'feature-scaffold'

    verdicts.push({ table, migrationRefs, codeRefs, verdict, topFiles })
  }

  for (const v of ['truly-dead', 'schema-only', 'feature-scaffold'] as const) {
    const group = verdicts.filter((x) => x.verdict === v)
    console.log(`\n── ${v.toUpperCase()} (${group.length}) ──`)
    if (group.length === 0) console.log('  (none)')
    else
      for (const item of group) {
        const detail =
          v === 'feature-scaffold'
            ? `  refs=${item.codeRefs}  migrationRefs=${item.migrationRefs}  top=${item.topFiles.join(', ') || '(none outside tests)'}`
            : `  migrationRefs=${item.migrationRefs}`
        console.log(`  ${item.table.padEnd(40)}${detail}`)
      }
  }

  console.log(`\n── Summary ──`)
  const c = (v: string) => verdicts.filter((x) => x.verdict === v).length
  console.log(
    [
      `  dropped (skipped)     : ${DROPPED_TABLES.size}`,
      `  protected (telegram)  : ${PROTECTED_TABLES.size}`,
      `  active (consolidated) : ${ACTIVE_CONSOLIDATED.size}`,
      `  indexer-only          : ${INDEXER_ONLY.size}`,
      `  truly-dead            : ${c('truly-dead')}`,
      `  schema-only           : ${c('schema-only')}`,
      `  feature-scaffold      : ${c('feature-scaffold')}`,
    ].join('\n'),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
