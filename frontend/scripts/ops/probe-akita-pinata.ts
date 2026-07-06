#!/usr/bin/env tsx
/**
 * Probe Akitai Pinata HTTP chat lane.
 *
 *   pnpm -C frontend exec tsx scripts/ops/probe-akita-pinata.ts
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

async function main(): Promise<void> {
  const endpoint = String(process.env.AKITAI_PINATA_CHAT_ENDPOINT ?? '').trim()
  const bearer = String(process.env.AKITAI_PINATA_BEARER_TOKEN ?? '').trim()

  if (!endpoint || !bearer) {
    console.error('❌ AKITAI_PINATA_CHAT_ENDPOINT and AKITAI_PINATA_BEARER_TOKEN must be set')
    process.exit(2)
  }

  const started = Date.now()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt:
        '[system]\nYou are Akitai (Keepr), the 4626 assistant.\n[/system]\n\n' +
        '[user]\nReply with one short hello sentence.\n[/user]\n\n' +
        'Respond as Akitai in concise plain text.',
    }),
  })

  const elapsedMs = Date.now() - started
  const bodyText = await res.text()
  if (!res.ok) {
    console.error(`❌ HTTP ${res.status} in ${elapsedMs}ms`)
    console.error(bodyText.slice(0, 280))
    process.exit(1)
  }

  let text = bodyText.trim()
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>
    text =
      String(parsed.text ?? '').trim() ||
      String(parsed.response ?? '').trim() ||
      String(parsed.message ?? '').trim() ||
      text
  } catch {
    // plain text body
  }

  if (!text) {
    console.error(`❌ Empty reply (${elapsedMs}ms)`)
    process.exit(1)
  }

  console.log(`✅ Akitai Pinata probe ok in ${elapsedMs}ms`)
  console.log(text.slice(0, 240))
}

main().catch((err) => {
  console.error('❌ Probe failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
