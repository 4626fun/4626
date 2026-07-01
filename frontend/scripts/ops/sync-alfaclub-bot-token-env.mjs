#!/usr/bin/env node
/**
 * Ensure counter-trade defense flags exist in frontend/.env and optionally
 * push ALFACLUB_API_KEY + defense flags to Vercel production.
 *
 * Canonical bot token env: ALFACLUB_API_KEY (aliases: alfaclub_api_key, ALFACLUB_BOT_TOKEN).
 *
 *   node frontend/scripts/ops/sync-alfaclub-bot-token-env.mjs
 *   node frontend/scripts/ops/sync-alfaclub-bot-token-env.mjs --vercel-production
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_PATH = resolve(process.cwd(), 'frontend/.env')

function parseEnv(text) {
  const lines = text.split('\n')
  const map = new Map()
  for (const line of lines) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
    if (m) map.set(m[1], m[2])
  }
  return { lines, map }
}

function upsertLine(lines, key, value) {
  const prefix = `${key}=`
  let found = false
  const next = lines.map((line) => {
    if (line.startsWith(prefix)) {
      found = true
      return `${key}=${value}`
    }
    return line
  })
  if (!found) next.push(`${key}=${value}`)
  return next
}

function readBotToken(map) {
  return (
    (map.get('ALFACLUB_API_KEY') ?? '').trim() ||
    (map.get('alfaclub_api_key') ?? '').trim() ||
    (map.get('ALFACLUB_BOT_TOKEN') ?? '').trim()
  )
}

function main() {
  const vercelProduction = process.argv.includes('--vercel-production')
  const raw = readFileSync(ENV_PATH, 'utf8')
  const { lines, map } = parseEnv(raw)

  const token = readBotToken(map)
  if (!token) {
    console.error(
      'No bot token found. Set ALFACLUB_API_KEY (preferred) or alfaclub_api_key in frontend/.env',
    )
    process.exit(1)
  }

  let nextLines = [...lines]

  // Promote to canonical name if only a legacy alias is set.
  if (!(map.get('ALFACLUB_API_KEY') ?? '').trim()) {
    nextLines = upsertLine(nextLines, 'ALFACLUB_API_KEY', token)
    console.log('Set ALFACLUB_API_KEY from legacy alias.')
  }

  const defenseDefaults = [
    ['ALFACLUB_COUNTER_TRADE_DEFENSE_ENABLED', '1'],
    ['ALFACLUB_COUNTER_TRADE_USER_DEFENSE_ENABLED', '1'],
    ['ALFACLUB_COUNTER_TRADE_USER_DEFENSE_MASTER', '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2'],
    ['ALFACLUB_COUNTER_TRADE_ROOM_ID', '1659'],
    ['ARENA_ASSET_ALLOWLIST', 'HYPE'],
  ]
  for (const [key, value] of defenseDefaults) {
    if (!(map.get(key) ?? '').trim()) {
      nextLines = upsertLine(nextLines, key, value)
      console.log(`Added ${key}=${value}`)
    }
  }

  writeFileSync(ENV_PATH, `${nextLines.join('\n').replace(/\n*$/, '')}\n`, 'utf8')

  if (vercelProduction) {
    execFileSync(
      'vercel',
      ['env', 'add', 'ALFACLUB_API_KEY', 'production', '--force', '--sensitive'],
      {
        cwd: resolve(process.cwd(), 'frontend'),
        input: token,
        stdio: ['pipe', 'inherit', 'inherit'],
      },
    )
    for (const [key, value] of defenseDefaults) {
      execFileSync(
        'vercel',
        ['env', 'add', key, 'production', '--force', '--sensitive'],
        {
          cwd: resolve(process.cwd(), 'frontend'),
          input: value,
          stdio: ['pipe', 'inherit', 'inherit'],
        },
      )
    }
    console.log('Vercel production env updated (ALFACLUB_API_KEY + defense flags).')
  }

  const hasHlAgent = Boolean((map.get('ALFACLUB_COUNTER_TRADE_USER_HL_AGENT_KEY') ?? '').trim())
  if (!hasHlAgent) {
    console.log(
      'Note: ALFACLUB_COUNTER_TRADE_USER_HL_AGENT_KEY is unset — room-wallet defense is alert-only until HL API key is on Railway.',
    )
  }
}

main()
