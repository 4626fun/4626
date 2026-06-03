#!/usr/bin/env tsx
/**
 * Read-only AlfaClub / Hermit production env checklist (presence only — never prints secrets).
 *
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-env-preflight.ts
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-env-preflight.ts --strict
 */

declare const process: { env: Record<string, string | undefined>; exit: (code: number) => void }

type Check = {
  id: string
  required: boolean
  present: boolean
  note?: string
}

function envPresent(key: string): boolean {
  return String(process.env[key] ?? '').trim().length > 0
}

function envUnsetOrOff(key: string): boolean {
  const raw = String(process.env[key] ?? '').trim().toLowerCase()
  return !raw || raw === '0' || raw === 'false' || raw === 'no' || raw === 'off'
}

function runChecks(): Check[] {
  const checks: Check[] = []

  const requiredControl: Array<[string, string]> = [
    ['CRON_SECRET', 'Cron auth for bridge + token refresh + daily brief'],
    ['DATABASE_URL', 'Supabase pooler for chat_jwt + ingest + policies'],
    ['ALFACLUB_API_KEY', 'Bot-token sends (preferred over WS-only)'],
  ]
  for (const [key, note] of requiredControl) {
    checks.push({ id: key, required: true, present: envPresent(key), note })
  }

  const bridgeRecommended: Array<[string, string]> = [
    ['ALFACLUB_CHAT_BRIDGE_ENABLED', 'Must be on for Vercel cron bridge (value=1)'],
    ['ALFACLUB_CHAT_ROOM_ID', 'Ops/command room (e.g. 1043)'],
  ]
  for (const [key, note] of bridgeRecommended) {
    checks.push({
      id: key,
      required: false,
      present: envPresent(key),
      note,
    })
  }

  checks.push({
    id: 'ALFACLUB_CHAT_JWT (inline)',
    required: false,
    present: envPresent('ALFACLUB_CHAT_JWT'),
    note: 'Optional bootstrap; production should use DB alfaclub_runtime_secret only',
  })

  const hermitAgent: Array<[string, string]> = [
    ['HERMIT_AGENT_CHAT_ENDPOINT', 'Hermit creative endpoint URL'],
    ['HERMIT_AGENT_BEARER_TOKEN', 'Hermit bearer token'],
  ]
  for (const [key, note] of hermitAgent) {
    checks.push({ id: key, required: false, present: envPresent(key), note })
  }

  checks.push({
    id: 'HERMIT_NON_ALFACLUB_POST_X_FIRST (must be off)',
    required: true,
    present: envUnsetOrOff('HERMIT_NON_ALFACLUB_POST_X_FIRST'),
    note: 'Keep off unless you explicitly want non-AlfaClub /gmeow to return tweet URLs.',
  })

  const gmeowPinataMode = String(process.env.HERMIT_GMEOW_HERMIT_CAPTION ?? '').trim().toLowerCase()
  checks.push({
    id: 'HERMIT_GMEOW_HERMIT_CAPTION',
    required: false,
    present: !gmeowPinataMode || gmeowPinataMode === 'prompt' || gmeowPinataMode === 'args',
    note:
      'Unset or prompt = bare /gmeow is local-only (fast). Use always only if you want Hermit agent on every /gmeow.',
  })

  const bridgeRoom = String(process.env.ALFACLUB_CHAT_ROOM_ID ?? '1043').trim()
  const briefRoom = String(process.env.ALFACLUB_DAILY_BRIEF_ROOM_ID ?? '').trim()
  const separateBrief = parseBool(process.env.ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE ?? '0')
  checks.push({
    id: 'ALFACLUB_DAILY_BRIEF_ROOM_ID (digest split)',
    required: separateBrief,
    present: briefRoom.length > 0 && briefRoom !== bridgeRoom,
    note: 'Required when ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE=1 — digest must not land in command room',
  })
  checks.push({
    id: 'ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE',
    required: false,
    present: separateBrief,
    note: 'Set 1 on production to stop auto-digest in the bridge/ops room',
  })
  checks.push({
    id: 'ALFACLUB_BRIDGE_CRON_SKIP_WS (recommended)',
    required: false,
    present: parseBool(process.env.ALFACLUB_BRIDGE_CRON_SKIP_WS ?? '1'),
    note: 'Default on — Vercel cron should not open live WS each minute',
  })

  const proxyRecommended: Array<[string, string]> = [
    ['ALFACLUB_CHAT_API_PROXY_URL', 'Cloudflare Worker egress for api.alfaclub.app'],
    ['ALFACLUB_CHAT_API_PROXY_SECRET', 'Must match Worker PROXY_SHARED_SECRET'],
  ]
  for (const [key, note] of proxyRecommended) {
    checks.push({ id: key, required: false, present: envPresent(key), note })
  }

  return checks
}

function parseBool(raw: string | undefined): boolean {
  const value = String(raw ?? '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

const MANUAL_REMINDERS = [
  'Railway XMTP primary: leave ALFACLUB_CHAT_BRIDGE_ENABLED and ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED unset.',
  'Vercel production: ALFACLUB_CHAT_BRIDGE_ENABLED=1; token refresh via cron only.',
  'After Privy/Telegram rotation: sync alfaclub_runtime_secret + Vercel env, then redeploy.',
  'GitHub ALFACLUB_HEALTH_CRON_SECRET must match Vercel CRON_SECRET (see docs/operations/alfaclub-token-rotation.md).',
  'Prod smoke: CRON_SECRET=… pnpm -C frontend exec tsx scripts/ops/alfaclub-prod-cron-smoke.ts',
]

function main(): void {
  const strict = process.argv.includes('--strict')
  const checks = runChecks()

  const lines: string[] = ['AlfaClub / Hermit env preflight (presence only)', '']
  let failures = 0

  for (const check of checks) {
    const ok = check.present
    const mark = ok ? 'ok' : check.required ? 'MISSING' : '—'
    if (!ok && check.required) failures += 1
    lines.push(`[${mark}] ${check.id}${check.note ? ` — ${check.note}` : ''}`)
  }

  lines.push('', 'Manual (not env-file verifiable):')
  for (const reminder of MANUAL_REMINDERS) {
    lines.push(`  • ${reminder}`)
  }
  lines.push('')
  if (failures > 0) {
    lines.push(`Result: ${failures} required check(s) failed.`)
  } else {
    lines.push('Result: all required checks passed (recommended items may still be unset).')
  }

  console.log(lines.join('\n'))
  if (strict && failures > 0) process.exit(1)
}

main()
