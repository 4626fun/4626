#!/usr/bin/env node
/**
 * Smoke-check that Shovel tip-following is not confused with event decoding.
 *
 * Tip cursors can advance with nrows=0. This script reports:
 *   - slowest live tip for lottery integrations
 *   - protocol_* row counts from v_protocol_index_freshness (when available)
 *   - LotteryWinner eth_getLogs sample vs index row count in the same window
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node scripts/smoke-index-decode.mjs
 *   node scripts/smoke-index-decode.mjs --lookback 5000
 *   node scripts/smoke-index-decode.mjs --strict
 */
import { spawnSync } from 'node:child_process'
import { buildSlowestCursorTipSql, interpretSlowestCursorTip } from './shovel-cursor-tip.mjs'

const LOOKBACK = (() => {
  const idx = process.argv.indexOf('--lookback')
  if (idx >= 0) return Number(process.argv[idx + 1] || '2000')
  return 2000
})()
const STRICT = process.argv.includes('--strict')

const LOTTERY_IGS = [
  'protocol_lottery_winners',
  'protocol_lottery_multi_jackpot',
  'protocol_lottery_entries',
  'protocol_lottery_winner_callbacks',
  'protocol_lottery_winner_callback_drops',
]

function pgUrl() {
  return (process.env.SHOVEL_PG_URL || process.env.DIRECT_URL || process.env.DATABASE_URL || '').trim()
}

function rpcUrl() {
  return (process.env.BASE_LOGS_RPC_URL || process.env.BASE_RPC_URL || '').trim()
}

function lotteryManager() {
  return (
    process.env.LOTTERY_MANAGER ||
    '0xB45E68a5867935a5734E4185977F81c528006650'
  ).trim()
}

function psql(sql) {
  const url = pgUrl()
  if (!url) throw new Error('SHOVEL_PG_URL / DATABASE_URL required')
  const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-tAc', sql], {
    encoding: 'utf8',
    timeout: 20_000,
  })
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'psql failed').trim().slice(0, 400))
  }
  return (result.stdout || '').trim()
}

async function ethBlockNumber() {
  const url = rpcUrl()
  if (!url) return null
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    signal: AbortSignal.timeout(10_000),
  })
  const body = await res.json()
  return Number.parseInt(body.result, 16)
}

async function ethGetLogsLotteryWinners(fromBlock, toBlock) {
  const url = rpcUrl()
  if (!url) return { skipped: true, reason: 'no rpc url' }
  const cast = spawnSync(
    'cast',
    ['sig-event', 'LotteryWinner(address,address,uint256,uint256,uint256)'],
    { encoding: 'utf8' },
  )
  const eventTopic = (cast.stdout || '').trim()
  if (!eventTopic.startsWith('0x')) {
    return { skipped: true, reason: 'cast sig-event unavailable' }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getLogs',
      params: [
        {
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`,
          address: lotteryManager(),
          topics: [eventTopic],
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  })
  const body = await res.json()
  if (body.error) throw new Error(JSON.stringify(body.error))
  return { skipped: false, count: Array.isArray(body.result) ? body.result.length : 0 }
}

async function main() {
  const tipSql = buildSlowestCursorTipSql(LOTTERY_IGS)
  const tipLine = psql(tipSql)
  const [tipRaw, presentRaw = '0', missingRaw = ''] = tipLine.split('|')
  const tip = interpretSlowestCursorTip({ tipRaw, presentRaw, missingRaw }, LOTTERY_IGS.length)

  console.log('[smoke-index] lottery tip:', tip)

  let freshness = []
  try {
    const freshRaw = psql(
      `select table_name || '=' || coalesce(row_count::text, '0') from public.v_protocol_index_freshness where table_name not like 'shovel:%' order by 1`,
    )
    freshness = freshRaw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch (err) {
    console.log('[smoke-index] freshness view unavailable:', err instanceof Error ? err.message : err)
  }
  if (freshness.length) {
    console.log('[smoke-index] protocol row_counts:')
    for (const line of freshness) console.log('  ', line)
  }

  const chainTip = await ethBlockNumber()
  if (chainTip == null) {
    console.log('[smoke-index] chain tip unavailable (set BASE_LOGS_RPC_URL)')
    return
  }
  console.log('[smoke-index] chain tip:', chainTip)
  if (tip.ok && tip.tip != null) {
    console.log('[smoke-index] lag blocks:', chainTip - tip.tip)
  }

  const toBlock = tip.ok && tip.tip != null ? tip.tip : chainTip
  const fromBlock = Math.max(0, toBlock - LOOKBACK)
  let indexWinnerCount = 0
  try {
    indexWinnerCount = Number(
      psql(
        `select count(*)::text from public.protocol_lottery_winners where block_num >= ${fromBlock} and block_num <= ${toBlock}`,
      ) || '0',
    )
  } catch (err) {
    console.log('[smoke-index] index winner count failed:', err instanceof Error ? err.message : err)
  }

  const rpc = await ethGetLogsLotteryWinners(fromBlock, toBlock)
  console.log('[smoke-index] window', { fromBlock, toBlock, indexWinnerCount, rpc })

  const zeroRows = freshness.length > 0 && freshness.every((line) => line.endsWith('=0'))
  if (zeroRows) {
    console.log(
      '[smoke-index] WARN: all protocol tables report row_count=0. Tip-following alone does not prove event decoding. If RPC finds events in the same window, treat index decode as broken.',
    )
  }

  if (STRICT && tip.ok && rpc && !rpc.skipped && rpc.count > 0 && indexWinnerCount === 0) {
    console.error('[smoke-index] STRICT fail: RPC found LotteryWinner events but index has 0 rows')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[smoke-index] error', err)
  process.exit(1)
})
