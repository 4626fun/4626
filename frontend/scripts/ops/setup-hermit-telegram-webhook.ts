#!/usr/bin/env tsx
/**
 * Register or verify hermit4626bot Telegram webhook on the Vercel Hermit ingress URL.
 *
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/setup-hermit-telegram-webhook.ts
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/setup-hermit-telegram-webhook.ts --apply
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/setup-hermit-telegram-webhook.ts --apply --origin https://app.4626.fun
 *
 * While hermit.4626.fun still points at Railway, set in Vercel Production:
 *   HERMIT_TELEGRAM_WEBHOOK_URL=https://app.4626.fun/api/telegram/hermit-webhook
 */

declare const process: { env: Record<string, string | undefined>; argv: string[]; exit: (code: number) => void }

import { resolveHermitTelegramWebhookPublicUrl } from '../../api/_handlers/telegram/webhook/hermitWebhookUrl.js'
import {
  readHermitTelegramBotToken,
  readHermitTelegramWebhookSecret,
} from '../../api/_handlers/telegram/webhook/ingress.js'
import { getTelegramWebhookInfo, setTelegramWebhook } from '../../server/_lib/messaging/telegramBotApi.js'

function readArg(name: string): string | null {
  const prefix = `--${name}=`
  for (const raw of process.argv.slice(2)) {
    if (raw === `--${name}`) return ''
    if (raw.startsWith(prefix)) return raw.slice(prefix.length).trim() || null
  }
  return null
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

async function probeWebhookUrl(url: string): Promise<{ ok: boolean; status: number; detail: string }> {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' })
    const text = await response.text().catch(() => '')
    const laneOk = text.includes('"lane":"hermit"') || text.includes('"ok":true')
    return {
      ok: response.ok && laneOk,
      status: response.status,
      detail: text.slice(0, 160).replace(/\s+/g, ' '),
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main(): Promise<void> {
  const apply = hasFlag('apply')
  const originOverride = readArg('origin')
  const env = {
    ...process.env,
    ...(originOverride ? { HERMIT_TELEGRAM_WEBHOOK_URL: `${originOverride.replace(/\/$/, '')}/api/telegram/hermit-webhook` } : {}),
  }

  const botToken = readHermitTelegramBotToken(env)
  const secret = readHermitTelegramWebhookSecret(env)
  const targetUrl = resolveHermitTelegramWebhookPublicUrl(env)

  if (!botToken) {
    console.error('ALFACLUB_TELEGRAM_BOT_TOKEN is required')
    process.exit(2)
  }
  if (!secret) {
    console.error('ALFACLUB_TELEGRAM_WEBHOOK_SECRET is required')
    process.exit(2)
  }

  console.log('Hermit Telegram webhook setup')
  console.log(`  target URL : ${targetUrl}`)
  console.log(`  ingress host env: ${env.TELEGRAM_TO_ALFACLUB_INGRESS_HOST ?? '(unset)'}`)
  console.log(`  override env     : ${env.HERMIT_TELEGRAM_WEBHOOK_URL ?? '(unset)'}`)

  const probe = await probeWebhookUrl(targetUrl)
  console.log(`  HTTP GET probe : ${probe.ok ? 'ok' : 'FAIL'} (${probe.status}) ${probe.detail}`)

  const info = await getTelegramWebhookInfo(botToken)
  const currentUrl = String(info.url ?? '').trim()
  console.log(`  Telegram current URL: ${currentUrl || '(none)'}`)
  if (info.last_error_message) {
    console.log(`  Telegram last error  : ${info.last_error_message}`)
  }

  const aligned = currentUrl.replace(/\/$/, '') === targetUrl.replace(/\/$/, '')
  if (aligned && probe.ok) {
    console.log('\nWebhook already aligned and endpoint reachable.')
    process.exit(0)
  }

  if (!apply) {
    console.log('\nDry run — re-run with --apply to call setWebhook.')
    process.exit(probe.ok ? 0 : 1)
  }

  await setTelegramWebhook({
    botToken,
    url: targetUrl,
    secretToken: secret,
    allowedUpdates: ['message', 'edited_message', 'callback_query'],
  })

  const after = await getTelegramWebhookInfo(botToken)
  console.log(`\nsetWebhook ok → ${after.url ?? targetUrl}`)
  const probeAfter = await probeWebhookUrl(targetUrl)
  console.log(`GET probe after apply: ${probeAfter.ok ? 'ok' : 'FAIL'} (${probeAfter.status})`)
  process.exit(probeAfter.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
