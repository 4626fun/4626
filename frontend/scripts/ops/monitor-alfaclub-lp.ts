#!/usr/bin/env tsx

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
} from 'viem'
import { base } from 'viem/chains'

const FRIEND_KEY = getAddress('0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F')
const CREATOR_COIN = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const TOKEN_ID = 1659n
const BPS = 10_000n

const FACTORY_ABI = parseAbi([
  'function getPool(address creatorCoin, uint256 tokenId) view returns (address)',
])
const POOL_ABI = parseAbi([
  'function getReserves() view returns (uint256 creatorCoinReserve, uint256 keyReserve)',
  'function quoteBuyKeys(uint256 keyAmount) view returns (uint256 creatorCoinAmountIn)',
  'function quoteSellKeys(uint256 keyAmount) view returns (uint256 creatorCoinAmountOut)',
  'function feeBps() view returns (uint16)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
])
const FRIEND_KEY_ABI = parseAbi([
  'function getBuyPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)',
  'function getSellPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)',
])

type MonitorState = {
  consecutiveDivergentSamples: number
  lastBlock: string | null
  lastSampleAt: string | null
}

function envAddress(name: string): Address {
  const raw = String(process.env[name] ?? '').trim()
  if (!isAddress(raw) || /^0x0{40}$/i.test(raw)) throw new Error(`${name}_not_configured`)
  return getAddress(raw)
}

function bpsDifference(a: bigint, b: bigint): bigint {
  if (b <= 0n) return 0n
  const difference = a >= b ? a - b : b - a
  return (difference * BPS) / b
}

async function readState(path: string): Promise<MonitorState> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<MonitorState>
    return {
      consecutiveDivergentSamples: Math.max(0, Number(parsed.consecutiveDivergentSamples ?? 0)),
      lastBlock: parsed.lastBlock ?? null,
      lastSampleAt: parsed.lastSampleAt ?? null,
    }
  } catch {
    return { consecutiveDivergentSamples: 0, lastBlock: null, lastSampleAt: null }
  }
}

async function writeState(path: string, state: MonitorState): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

async function sendAlert(webhookUrl: string, payload: unknown): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`alert_webhook_http_${response.status}`)
}

async function main(): Promise<void> {
  const factory = envAddress('ALFA_CREATOR_KEY_LP_FACTORY')
  const creatorCoinPriceInput = String(process.env.ALFACLUB_LP_CREATOR_PRICE_USDC ?? '').trim()
  if (!creatorCoinPriceInput) throw new Error('ALFACLUB_LP_CREATOR_PRICE_USDC_not_configured')
  const creatorCoinPriceDecimals = 18
  const creatorCoinPriceUsdc = parseUnits(creatorCoinPriceInput, creatorCoinPriceDecimals)
  if (creatorCoinPriceUsdc <= 0n) throw new Error('creator_coin_price_must_be_positive')

  const rpcUrl = process.env.BASE_RPC_URL?.trim() || 'https://base-rpc.publicnode.com'
  const statePath = resolve(
    process.env.ALFACLUB_LP_MONITOR_STATE_PATH?.trim() ||
      '.cache/alfaclub-lp-monitor-state.json',
  )
  const divergenceThresholdBps = BigInt(process.env.ALFACLUB_LP_DIVERGENCE_BPS ?? '1000')
  const sustainedSamples = Math.max(
    1,
    Number(process.env.ALFACLUB_LP_DIVERGENCE_SUSTAINED_SAMPLES ?? '3'),
  )
  const minimumKeyReserve = BigInt(process.env.ALFACLUB_LP_MIN_KEY_RESERVE ?? '3')
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const poolRaw = await client.readContract({
    address: factory,
    abi: FACTORY_ABI,
    functionName: 'getPool',
    args: [CREATOR_COIN, TOKEN_ID],
  })
  if (/^0x0{40}$/i.test(poolRaw)) throw new Error('room_1659_pool_not_deployed')
  const pool = getAddress(poolRaw)

  const [
    blockNumber,
    reserves,
    lpBuyOne,
    lpSellOne,
    primaryBuyUsdc,
    primarySellUsdc,
    feeBps,
    lpSupply,
    lockedLp,
  ] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({ address: pool, abi: POOL_ABI, functionName: 'getReserves' }),
    client.readContract({ address: pool, abi: POOL_ABI, functionName: 'quoteBuyKeys', args: [1n] }),
    client.readContract({ address: pool, abi: POOL_ABI, functionName: 'quoteSellKeys', args: [1n] }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'getBuyPriceAfterFee',
      args: [TOKEN_ID, 1n],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'getSellPriceAfterFee',
      args: [TOKEN_ID, 1n],
    }),
    client.readContract({ address: pool, abi: POOL_ABI, functionName: 'feeBps' }),
    client.readContract({ address: pool, abi: POOL_ABI, functionName: 'totalSupply' }),
    client.readContract({
      address: pool,
      abi: POOL_ABI,
      functionName: 'balanceOf',
      args: [getAddress('0x000000000000000000000000000000000000dEaD')],
    }),
  ])

  const [creatorCoinReserve, keyReserve] = reserves
  const primaryBuyCoin =
    (primaryBuyUsdc * 10n ** 18n * 10n ** BigInt(creatorCoinPriceDecimals)) /
    (10n ** 6n * creatorCoinPriceUsdc)
  const primarySellCoin =
    (primarySellUsdc * 10n ** 18n * 10n ** BigInt(creatorCoinPriceDecimals)) /
    (10n ** 6n * creatorCoinPriceUsdc)
  const buyDivergenceBps = bpsDifference(lpBuyOne, primaryBuyCoin)
  const sellDivergenceBps = bpsDifference(lpSellOne, primarySellCoin)
  const reserveSpot = creatorCoinReserve / keyReserve
  const oneKeyImpactBps = bpsDifference(lpBuyOne, reserveSpot)
  const divergent =
    buyDivergenceBps >= divergenceThresholdBps ||
    sellDivergenceBps >= divergenceThresholdBps ||
    keyReserve < minimumKeyReserve

  const previous = await readState(statePath)
  const consecutiveDivergentSamples = divergent
    ? previous.consecutiveDivergentSamples + 1
    : 0
  const state: MonitorState = {
    consecutiveDivergentSamples,
    lastBlock: blockNumber.toString(),
    lastSampleAt: new Date().toISOString(),
  }
  await writeState(statePath, state)

  const report = {
    ok: !divergent,
    alert: divergent && consecutiveDivergentSamples >= sustainedSamples,
    blockNumber: blockNumber.toString(),
    factory,
    pool,
    pair: { creatorCoin: CREATOR_COIN, friendKey: FRIEND_KEY, tokenId: TOKEN_ID.toString() },
    feeBps: Number(feeBps),
    creatorCoinPriceUsdc: creatorCoinPriceInput,
    reserves: {
      creatorCoin: formatUnits(creatorCoinReserve, 18),
      keys: keyReserve.toString(),
      minimumKeys: minimumKeyReserve.toString(),
    },
    oneKey: {
      lpBuyCreatorCoin: formatUnits(lpBuyOne, 18),
      lpSellCreatorCoin: formatUnits(lpSellOne, 18),
      primaryBuyCreatorCoin: formatUnits(primaryBuyCoin, 18),
      primarySellCreatorCoin: formatUnits(primarySellCoin, 18),
      buyDivergenceBps: buyDivergenceBps.toString(),
      sellDivergenceBps: sellDivergenceBps.toString(),
      lpPriceImpactBps: oneKeyImpactBps.toString(),
    },
    lp: {
      totalSupply: lpSupply.toString(),
      permanentlyLocked: lockedLp.toString(),
    },
    sustained: {
      samples: consecutiveDivergentSamples,
      threshold: sustainedSamples,
    },
  }
  console.log(JSON.stringify(report, null, 2))

  const webhookUrl = process.env.ALFACLUB_LP_ALERT_WEBHOOK_URL?.trim()
  if (report.alert && webhookUrl) await sendAlert(webhookUrl, report)
  if (report.alert) process.exitCode = 2
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
