#!/usr/bin/env tsx
/**
 * Diagnose and plan hermit.4626.fun → Vercel (4626 project) DNS cutover.
 *
 * Telegram ingress rewrites in vercel.json expect this host on the main 4626
 * Vercel deployment. While DNS still targets Railway, keep:
 *   HERMIT_TELEGRAM_WEBHOOK_URL=https://app.4626.fun/api/telegram/hermit-webhook
 *
 *   pnpm -C frontend exec tsx scripts/ops/setup-hermit-dns-vercel.ts
 */

declare const process: { env: Record<string, string | undefined>; exit: (code: number) => void }

const TARGET_HOST = 'hermit.4626.fun'
const VERCEL_PROJECT = 'akita-llc/4626'
const FALLBACK_WEBHOOK = 'https://app.4626.fun/api/telegram/hermit-webhook'

async function probeHost(url: string): Promise<{ status: number; server: string; body: string }> {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' })
    const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 120)
    return {
      status: response.status,
      server: response.headers.get('server') ?? '',
      body,
    }
  } catch (error) {
    return {
      status: 0,
      server: '',
      body: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main(): Promise<void> {
  console.log('Hermit DNS → Vercel cutover checklist')
  console.log('')
  console.log(`  Host            : ${TARGET_HOST}`)
  console.log(`  Vercel project  : ${VERCEL_PROJECT}`)
  console.log(`  Webhook fallback: ${FALLBACK_WEBHOOK}`)
  console.log('')

  const webhookProbe = await probeHost(`${FALLBACK_WEBHOOK}`)
  const hostProbe = await probeHost(`https://${TARGET_HOST}/api/telegram/hermit-webhook`)

  console.log('Live probes:')
  console.log(
    `  app webhook     : HTTP ${webhookProbe.status} server=${webhookProbe.server || '(none)'} ${webhookProbe.body}`,
  )
  console.log(
    `  hermit webhook  : HTTP ${hostProbe.status} server=${hostProbe.server || '(none)'} ${hostProbe.body}`,
  )
  console.log('')

  const onRailway =
    hostProbe.server.toLowerCase().includes('cloudflare') &&
    (hostProbe.body.includes('Not Found') || hostProbe.status === 404)
  const onVercel =
    hostProbe.status === 200 &&
    (hostProbe.body.includes('"lane":"hermit"') || hostProbe.body.includes('hermit-webhook'))

  if (onVercel) {
    console.log('OK: hermit.4626.fun already serves the Vercel Hermit webhook.')
    console.log('You can set Telegram webhook to https://hermit.4626.fun/api/telegram/webhook')
    process.exit(0)
  }

  console.log('Cutover steps (Cloudflare DNS for 4626.fun):')
  console.log('')
  console.log('  1. Vercel dashboard → remove hermit.4626.fun from any OTHER project')
  console.log(`     then: cd frontend && vercel domains add ${TARGET_HOST}`)
  console.log('     (alias_conflict means another Vercel project still owns the hostname)')
  console.log('')
  console.log('  2. Cloudflare → DNS → hermit.4626.fun')
  if (onRailway) {
    console.log('     Current traffic still hits Railway (404 on webhook). Replace with:')
  } else {
    console.log('     Point the record at Vercel:')
  }
  console.log('       Type: CNAME')
  console.log('       Name: hermit')
  console.log('       Target: cname.vercel-dns.com')
  console.log('       Proxy: DNS only (grey cloud) until Vercel shows Valid')
  console.log('')
  console.log('  3. Wait for Vercel domain validation, then re-run:')
  console.log('       pnpm -C frontend exec tsx --env-file=.env scripts/ops/setup-hermit-telegram-webhook.ts --apply')
  console.log('')
  console.log('Until step 3 succeeds, keep HERMIT_TELEGRAM_WEBHOOK_URL on app.4626.fun (already works).')
  process.exit(onRailway ? 1 : 2)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
