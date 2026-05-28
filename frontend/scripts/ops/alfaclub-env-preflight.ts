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

  const hermitPinata: Array<[string, string]> = [
    ['HERMIT_PINATA_CHAT_ENDPOINT', 'Pinata OpenClaw agent HTTP base URL'],
    ['HERMIT_PINATA_BEARER_TOKEN', 'Pinata agent bearer (rotate in Pinata UI)'],
  ]
  for (const [key, note] of hermitPinata) {
    checks.push({ id: key, required: false, present: envPresent(key), note })
  }

  checks.push({
    id: 'HERMIT_GMEOW_POST_TO_X_FIRST (must be off)',
    required: true,
    present: envUnsetOrOff('HERMIT_GMEOW_POST_TO_X_FIRST'),
    note: 'AlfaClub uses media-first + optional X link; legacy X-first breaks room UX',
  })

  checks.push({
    id: 'ALFACLUB_DAILY_BRIEF_ROOM_ID (optional split)',
    required: false,
    present: envPresent('ALFACLUB_DAILY_BRIEF_ROOM_ID'),
    note: 'When set, digest posts outside bridge room; unset = same as bridge room',
  })

  return checks
}

const MANUAL_REMINDERS = [
  'Railway XMTP primary: leave ALFACLUB_CHAT_BRIDGE_ENABLED and ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED unset.',
  'Vercel production: ALFACLUB_CHAT_BRIDGE_ENABLED=1; token refresh via cron only.',
  'After Privy/Telegram rotation: sync alfaclub_runtime_secret + Vercel env, then redeploy.',
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
