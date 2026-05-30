#!/usr/bin/env tsx
/**
 * End-to-end Hermit creative probe (Pinata HTTP → gateway fallback).
 *
 *   pnpm -C frontend exec tsx scripts/ops/probe-pinata-hermit.ts
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { executeHermitCommand, isPinataAgentFailureReply } from '../../server/_lib/hermit/skillRouter.js'

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
  const endpoint = String(process.env.HERMIT_PINATA_CHAT_ENDPOINT ?? '').trim()
  const bearer = String(process.env.HERMIT_PINATA_BEARER_TOKEN ?? '').trim()

  if (!endpoint || !bearer) {
    console.error('❌ HERMIT_PINATA_CHAT_ENDPOINT and HERMIT_PINATA_BEARER_TOKEN must be set')
    process.exit(2)
  }

  try {
    const host = new URL(endpoint).hostname
    console.log(`Pinata Hermit probe → ${host}`)
  } catch {
    console.log('Pinata Hermit probe → configured endpoint')
  }

  const started = Date.now()
  const result = await executeHermitCommand({
    commandText: '/hermit copy probe ok one line only',
    senderAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
    sourceIdentity: 'alfaclub-bridge-runner',
    chatId: 'alfaclub:1659',
  })
  const elapsedMs = Date.now() - started

  const reply = result.reply?.trim() ?? ''
  if (!reply) {
    console.error(`❌ Hermit creative probe returned empty reply (${elapsedMs}ms)`)
    process.exit(1)
  }
  if (isPinataAgentFailureReply(reply)) {
    console.error(`❌ Hermit creative probe got agent failure text (${elapsedMs}ms)`)
    console.error(reply.slice(0, 280))
    process.exit(1)
  }

  console.log(`✅ Hermit creative probe ok in ${elapsedMs}ms (provider=${result.provider ?? 'unknown'})`)
  console.log(reply.slice(0, 180))
}

main().catch((err) => {
  console.error('❌ Probe failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
