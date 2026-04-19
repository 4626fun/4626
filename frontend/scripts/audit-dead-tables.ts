#!/usr/bin/env tsx
/**
 * For each zero-row, zero-activity public table, classify its usage:
 *
 *   - truly-dead       : zero code references outside supabase/migrations.
 *                        The only mention is its own CREATE TABLE. Safe to
 *                        drop after user confirmation.
 *   - schema-only      : referenced only by migration DDL (e.g. a later
 *                        migration ADDs a column but no handler reads it).
 *                        Safe to drop.
 *   - feature-scaffold : referenced in source code (server/client) but
 *                        never exercised (zero rows, zero activity). Do
 *                        NOT drop — active development or feature on ice.
 *
 * Output is pure JSON so it pipes cleanly into follow-up actions.
 */

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CANDIDATES = [
  'feedback_index',
  'grove_chat_manifests',
  'task_loops',
  'telegram_chat_vault_scope',
  'telegram_holder_room_members',
  'telegram_holder_room_policies',
  'telegram_inline_signal_feeds',
  'csw_owner_link_status',
  'keepr_join_requests',
  'keepr_nonces',
  'keepr_vault_automation',
  'lottery_amoe_nonces',
  'lottery_amoe_entries',
  'workspace_alert_events',
  'workspace_approvals',
  'workspace_audit_logs',
  'workspace_monitoring_snapshots',
  'workspace_notification_preferences',
  'workspace_strategy_targets',
  'workspace_task_state',
  'workspace_activity_events',
  'auth_nonces',
  'auth_agent_nonces',
  'telegram_miniapp_replay_nonces',
  'telegram_miniapp_sessions',
  'wallet_intelligence_cache',
  'deploys',
  'referral_conversions',
  'referral_clicks',
  'lottery_amoe_daily_twitter_checkins',
  'keepr_logs',
  'keepr_workflow_checkpoints',
]

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)), '..')

function countMatches(pattern: string, globExclude: string[]): Array<{ file: string; count: number }> {
  try {
    const args = [
      '-c',
      '-g',
      `!supabase/migrations/**`,
      '-g',
      `!docs/_generated/**`,
      '-g',
      `!frontend/scripts/audit-dead-tables.ts`,
      '-g',
      `!frontend/scripts/audit-unused-tables.ts`,
      '-g',
      `!frontend/scripts/diagnose-*.ts`,
      ...globExclude.flatMap((g) => ['-g', g]),
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
  const verdicts: Array<{
    table: string
    migrationRefs: number
    codeRefs: number
    verdict: 'truly-dead' | 'schema-only' | 'feature-scaffold'
    topFiles: string[]
  }> = []

  for (const table of CANDIDATES) {
    const codeHits = countMatches(table, [])
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

  // Group by verdict for the report.
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
    `  truly-dead       : ${c('truly-dead')}\n  schema-only      : ${c('schema-only')}\n  feature-scaffold : ${c('feature-scaffold')}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
