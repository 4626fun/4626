import type { Address } from 'viem'
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, keccak256, parseAbi, toBytes } from 'viem'
import { base } from 'viem/chains'

import { getOrCreateCreatorAgentWallet } from '../_lib/creatorAgentWallets.js'
import { logger } from '../_lib/logger.js'
import { walletRpc } from '../_lib/privyWalletApi.js'

declare const process: { env: Record<string, string | undefined> }

const BASE_CHAIN_ID = 8453
const DEFAULT_ZORA_FACTORY_ADDRESS = '0x777777751622c0d3258f214f9df38e35bf45baf3'
const DEFAULT_DEPLOY_WAIT_TIMEOUT_MS = 120_000

const TREND_FACTORY_ABI = parseAbi([
  'function trendCoinAddress(string ticker) view returns (address)',
  'function deployTrendCoin(string ticker)',
])

export type TrendValidationResult =
  | { ok: true; ticker: string; tickerHash: `0x${string}` }
  | { ok: false; error: string }

export type TrendPreflightResult = {
  ticker: string
  tickerHash: `0x${string}`
  predictedAddress: `0x${string}`
  deployed: boolean
  deployedBytecode: `0x${string}` | null
}

export type TrendReserveResult = {
  ticker: string
  tickerHash: `0x${string}`
  predictedAddress: `0x${string}`
  deployedAddress: `0x${string}`
  deployed: boolean
  txHash: string | null
  walletAddress: `0x${string}` | null
  walletId: string | null
  status: 'already_deployed' | 'submitted' | 'deployed'
}

function getFactoryAddress(): Address {
  const raw = String(process.env.ZORA_FACTORY_ADDRESS ?? '').trim() || DEFAULT_ZORA_FACTORY_ADDRESS
  return getAddress(raw)
}

function getPublicClient() {
  const rpcUrl = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  return createPublicClient({ chain: base, transport: http(rpcUrl) })
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return fallback
}

function tickerHashFor(ticker: string): `0x${string}` {
  return keccak256(toBytes(ticker.toLowerCase()))
}

export function normalizeTrendTicker(input: string): string | null {
  const raw = String(input ?? '')
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.toUpperCase()
}

export function validateTrendTicker(input: string): TrendValidationResult {
  const ticker = normalizeTrendTicker(input)
  if (!ticker) return { ok: false, error: 'ticker_required' }
  if (ticker.length > 32) return { ok: false, error: 'ticker_too_long' }
  if (!/^[A-Z0-9\- ]+$/.test(ticker)) return { ok: false, error: 'ticker_invalid_characters' }
  if (!/[A-Z0-9]/.test(ticker)) return { ok: false, error: 'ticker_invalid_characters' }
  return { ok: true, ticker, tickerHash: tickerHashFor(ticker) }
}

export async function preflightTrendTicker(params: { ticker: string }): Promise<TrendPreflightResult> {
  const validation = validateTrendTicker(params.ticker)
  if (!validation.ok) throw new Error(validation.error)

  const factory = getFactoryAddress()
  const client = getPublicClient()
  const predicted = await client.readContract({
    address: factory,
    abi: TREND_FACTORY_ABI,
    functionName: 'trendCoinAddress',
    args: [validation.ticker],
  })
  if (!isAddress(predicted)) throw new Error('trend_coin_address_invalid')

  const predictedAddress = getAddress(predicted).toLowerCase() as `0x${string}`
  const deployedBytecode = (await client.getBytecode({
    address: predictedAddress,
  })) as `0x${string}` | undefined
  const deployed = Boolean(deployedBytecode && deployedBytecode !== '0x')

  return {
    ticker: validation.ticker,
    tickerHash: validation.tickerHash,
    predictedAddress,
    deployed,
    deployedBytecode: deployed ? deployedBytecode ?? null : null,
  }
}

export async function reserveTrendTicker(params: {
  ticker: string
  creatorToken: `0x${string}`
  groupId: string
  waitForReceipt?: boolean
}): Promise<TrendReserveResult> {
  const preflight = await preflightTrendTicker({ ticker: params.ticker })
  if (preflight.deployed) {
    return {
      ticker: preflight.ticker,
      tickerHash: preflight.tickerHash,
      predictedAddress: preflight.predictedAddress,
      deployedAddress: preflight.predictedAddress,
      deployed: true,
      txHash: null,
      walletAddress: null,
      walletId: null,
      status: 'already_deployed',
    }
  }

  const wallet = await getOrCreateCreatorAgentWallet({ creatorToken: params.creatorToken })
  const factory = getFactoryAddress()
  const client = getPublicClient()

  const data = encodeFunctionData({
    abi: TREND_FACTORY_ABI,
    functionName: 'deployTrendCoin',
    args: [preflight.ticker],
  })

  const idempotencyKey = `zora-trend-deploy:${params.groupId}:${preflight.tickerHash}`
  const tx = await walletRpc<any>({
    walletId: wallet.walletId,
    method: 'eth_sendTransaction',
    rpcParams: {
      transaction: {
        to: factory,
        data,
        value: '0x0',
        chain_id: BASE_CHAIN_ID,
      },
    },
    idempotencyKey,
    teeContext: {
      action: 'zora_trend_deploy',
      actorAddress: wallet.address,
      metadata: {
        ticker: preflight.ticker,
        tickerHash: preflight.tickerHash,
        predictedAddress: preflight.predictedAddress,
      },
    },
  })

  const txHash = String(tx?.data?.hash ?? tx?.hash ?? '').trim()
  if (!txHash || !/^0x[a-fA-F0-9]+$/.test(txHash)) {
    throw new Error('trend_deploy_missing_tx_hash')
  }

  const shouldWait = params.waitForReceipt ?? parseBooleanEnv('ZORA_TREND_WAIT_FOR_RECEIPT', true)
  if (shouldWait) {
    await client.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: DEFAULT_DEPLOY_WAIT_TIMEOUT_MS,
    })
  }

  let deployed = false
  try {
    const postflight = await preflightTrendTicker({ ticker: preflight.ticker })
    deployed = postflight.deployed
  } catch (error) {
    logger.warn('[zora/trends] postflight failed after deploy submission', {
      ticker: preflight.ticker,
      txHash,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return {
    ticker: preflight.ticker,
    tickerHash: preflight.tickerHash,
    predictedAddress: preflight.predictedAddress,
    deployedAddress: preflight.predictedAddress,
    deployed,
    txHash,
    walletAddress: wallet.address,
    walletId: wallet.walletId,
    status: deployed ? 'deployed' : 'submitted',
  }
}

