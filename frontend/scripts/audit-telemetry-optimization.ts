#!/usr/bin/env tsx
/**
 * Telemetry / Audit / Event table optimization analyzer.
 *
 * Scores tables that look like high-volume, low-business-value telemetry
 * (based on name patterns + code references + known sizes from DB snapshot).
 *
 * Suggests actions: aggressive TTL, sampling, move to analytics schema, etc.
 */

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

// Tables from live snapshot that are clearly telemetry/audit/event/snapshot
const TELEMETRY_CANDIDATES = [
  'control_plane_events',
  'control_plane_stages',
  'agent_api_logs',
  'agent_control_audit_events',
  'chat_command_center_events',
  'chat_presence_sessions',
  'keepr_logs',
  'keepr_workflow_checkpoints',
  'workspace_audit_logs',
  'workspace_activity_events',
  'workspace_monitoring_snapshots',
  'workspace_alert_events',
  'telegram_action_audit',
  'telegram_funnel_events',
  'telegram_link_telemetry_events',
  'telegram_action_tokens',
  'index_usage_snapshots',
  'query_temp_io_snapshots',
  'ethos_score_sync_state',
  'zora_profiles_refresh_state',
  'creator_metrics_daily_snapshots',
  'alfaclub_metrics_snapshot',
  'memory_snapshots',
  'episodic_summaries',
  'fact_cards',
]

const TELEMETRY_PATTERNS = /_(events?|logs?|audit|telemetry|snapshots?|funnel|presence)/i

function countCodeReferences(table: string): number {
  try {
    const args = [
      '-c',
      '--glob', '!supabase/migrations/**',
      '--glob', '!docs/_generated/**',
      '--glob', '!frontend/scripts/audit-*.ts',
      `\\b${table}\\b`,
      REPO,
    ]
    const out = execFileSync('rg', args, { encoding: 'utf8' })
    return out.split('\n').filter(Boolean).reduce((sum, line) => {
      const c = Number(line.split(':').pop()) || 0
      return sum + c
    }, 0)
  } catch {
    return 0
  }
}

function isTelemetryByName(name: string): boolean {
  return TELEMETRY_PATTERNS.test(name) || TELEMETRY_CANDIDATES.includes(name)
}

function suggestRetentionDays(table: string, references: number): number {
  const lower = table.toLowerCase()

  if (lower.includes('snapshot') || lower.includes('temp')) return 7
  if (lower.includes('funnel') || lower.includes('presence')) return 14
  if (lower.includes('metrics') || lower.includes('episodic')) return 30
  if (lower.includes('audit') || lower.includes('action_audit')) return 90
  if (lower.includes('logs') || lower.includes('events')) {
    return references < 15 ? 30 : 60
  }
  return 30 // default for telemetry
}

async function main() {
  console.log('── TELEMETRY / AUDIT OPTIMIZATION ANALYSIS ──\n')

  const results = TELEMETRY_CANDIDATES.map(table => {
    const refs = countCodeReferences(table)
    const optimizationPotential = Math.max(0, 100 - Math.min(refs * 5, 90))
    const suggestedTTL = suggestRetentionDays(table, refs)
    return { table, references: refs, optimizationPotential, suggestedTTL }
  }).sort((a, b) => b.optimizationPotential - a.optimizationPotential)

  console.log('High optimization potential (low code surface, high maintenance cost):')
  results.slice(0, 15).forEach(r => {
    console.log(
      `  ${r.table.padEnd(35)} refs=${r.references.toString().padStart(4)}  potential=${r.optimizationPotential}%  suggested_ttl=${r.suggestedTTL}d`
    )
  })

  console.log('\nRecommendations:')
  console.log('  1. Add pg_cron or application-level TTL using the suggested values above.')
  console.log('  2. Consider moving pure telemetry to a separate "analytics" schema or external store.')
  console.log('  3. Sample high-frequency events (see recommended rates below).')
  console.log('  4. Review Looker-specific views (v_looker_*) for consolidation or less frequent refresh.')

  console.log('\nRecommended sampling (apply via TELEMETRY_SAMPLE_RATE or per-table logic):')
  console.log('  telegram_funnel_events          → 0.10 – 0.20 (very high volume)')
  console.log('  chat_command_center_events      → 0.15 – 0.30')
  console.log('  chat_presence_sessions          → 0.10 – 0.20')
  console.log('  agent_api_logs                  → 0.20 – 0.50 (lower volume)')
  console.log('  keepr_logs                      → 0.30 – 0.70')
}

main().catch(console.error)