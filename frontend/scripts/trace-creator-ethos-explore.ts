/**
 * Trace creator_address → creator_ethos_projection → explore + coin API ethos fields.
 *
 * Usage (from `frontend/`; use env if tsx swallows CLI flags):
 *   TRACE_ETHOS_CREATOR=0x<40hex> pnpm exec tsx scripts/trace-creator-ethos-explore.ts --base-url https://app.4626.fun
 *   pnpm exec tsx scripts/trace-creator-ethos-explore.ts --creator 0x... --coin 0x... --base-url https://app.4626.fun
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getDb, isDbConfigured } from '@4626/server-core'
import {
  loadCreatorEthosProjectionByAddresses,
  loadMergedCreatorEthosByAddresses,
} from '../server/_lib/zora/creatorEthosProjection.js'

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(resolve(process.cwd(), '.env'))

function readArg(flag: string): string | null {
  for (let i = 2; i < process.argv.length; i++) {
    const token = process.argv[i]
    if (token === flag) {
      const value = process.argv[i + 1]
      return typeof value === 'string' && value.trim() ? value.trim() : null
    }
    if (token.startsWith(`${flag}=`)) {
      const value = token.slice(flag.length + 1)
      return value.trim() ? value.trim() : null
    }
  }
  return null
}

async function fetchJson(url: string) {
  const res = await fetch(url)
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

function readCreatorArg(): string | null {
  const fromFlag = readArg('--creator')?.toLowerCase() ?? null
  if (fromFlag) return fromFlag
  const fromEnv = String(process.env.TRACE_ETHOS_CREATOR ?? '').trim().toLowerCase()
  if (/^0x[a-f0-9]{40}$/.test(fromEnv)) return fromEnv
  const positional = process.argv.slice(2).find((token) => /^0x[a-f0-9]{40}$/i.test(token))
  return positional ? positional.toLowerCase() : null
}

async function main() {
  const creator = readCreatorArg()
  const coin = readArg('--coin')?.toLowerCase() ?? null
  const baseUrl = (readArg('--base-url') ?? 'http://localhost:5173').replace(/\/$/, '')
  if (!creator || !/^0x[a-f0-9]{40}$/.test(creator)) {
    console.error('Provide --creator 0x<40 hex>')
    process.exit(1)
  }

  console.log('creator:', creator)
  if (coin) console.log('coin:', coin)

  if (isDbConfigured()) {
    const db = await getDb()
    if (db) {
      const projection = await loadCreatorEthosProjectionByAddresses(db, [creator])
      const row = projection.get(creator) ?? null
      console.log('v_explore_creators (or creator_ethos_projection) — canonical unified source for all sortable Explore data:', row ?? '(no row)')

      const merged = await loadMergedCreatorEthosByAddresses([creator])
      console.log('merged_ethos (projection + resolver):', merged.get(creator) ?? '(no score)')
    } else {
      console.log('v_explore_creators (or creator_ethos_projection) — canonical unified source for all sortable Explore data: db_unavailable')
    }
  } else {
    console.log('v_explore_creators (or creator_ethos_projection) — canonical unified source for all sortable Explore data: DATABASE_URL not configured (skip)')
  }

  const exploreUrl = `${baseUrl}/api/zora/explore?list=TOP_VOLUME_CREATORS_24H&count=50`
  const explore = await fetchJson(exploreUrl)
  const exploreBody = explore.body as {
    success?: boolean
    data?: { edges?: Array<{ node?: { creatorAddress?: string; ethosScore?: number; ethosScoreSource?: string } }> }
  }
  const exploreMatch = (exploreBody.data?.edges ?? []).find(
    (edge) => String(edge.node?.creatorAddress ?? '').toLowerCase() === creator,
  )
  console.log('explore_api_status:', explore.status)
  console.log(
    'explore_match:',
    exploreMatch?.node
      ? {
          ethosScore: exploreMatch.node.ethosScore ?? null,
          ethosScoreSource: exploreMatch.node.ethosScoreSource ?? null,
        }
      : '(creator not in first page of TOP_VOLUME_CREATORS_24H)',
  )

  if (coin && /^0x[a-f0-9]{40}$/.test(coin)) {
    const coinUrl = `${baseUrl}/api/zora/coin?address=${encodeURIComponent(coin)}&chain=8453`
    const coinRes = await fetchJson(coinUrl)
    const coinBody = coinRes.body as {
      success?: boolean
      data?: {
        creatorAddress?: string
        ethosScore?: number
        ethosLevel?: string
        ethosScoreSource?: string
      }
    }
    console.log('coin_api_status:', coinRes.status)
    console.log(
      'coin_ethos:',
      coinBody.data
        ? {
            creatorAddress: coinBody.data.creatorAddress ?? null,
            ethosScore: coinBody.data.ethosScore ?? null,
            ethosLevel: coinBody.data.ethosLevel ?? null,
            ethosScoreSource: coinBody.data.ethosScoreSource ?? null,
          }
        : '(no coin payload)',
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
