import type { Address } from 'viem'
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, keccak256, parseAbi, toBytes } from 'viem'
import { base } from 'viem/chains'

import { getOrCreateCreatorAgentWallet } from '../_lib/wallet/creatorAgentWallets.js'
import { logger } from '../_lib/infra/logger.js'
import { BASE_CAIP2, walletRpc } from '../_lib/wallet/privyWalletApi.js'
import {
  checkWalletBalancePreflight,
  getBasePreflightPublicClient,
  isInsufficientFundsError,
  type PreflightResult,
} from '../_lib/wallet/walletBalancePreflight.js'
import type { CommandIssuerContext } from '../_lib/wallet/commandIssuerContext.js'
import { submitUserOpOrRefuse } from '../_lib/wallet/userOperationSubmitter.js'
import { assertTeeAttestationOrThrow } from '../_lib/agent/teeAttestationGate.js'
import type { CoinbaseSmartWalletCall } from '../_lib/wallet/privyCoinbaseSmartWallet.js'

/**
 * Sentinel error thrown by `reserveTrendTicker` when the agent wallet cannot
 * cover the trend-deploy gas cost. Callers (`commands.ts`, `_trendReserve.ts`,
 * `trendLaunchSentinel.ts`) map this to a friendly user refusal. This is
 * defensive: the underlying fix is Architecture B (smart-wallet UserOperation
 * routing), tracked in docs/architecture-b-design.md.
 */
export class TrendInsufficientFundsError extends Error {
  readonly code = 'insufficient_funds'
  constructor(message: string) {
    super(message)
    this.name = 'TrendInsufficientFundsError'
  }
}

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

  // Defensive preflight: trend deploy sends value=0x0, so only a gas buffer is
  // required. If the Privy-managed EOA can't cover gas, refuse early with a
  // typed error instead of leaking the raw Privy 400. Fail-open on RPC errors.
  let balancePreflight: PreflightResult | null = null
  try {
    balancePreflight = await checkWalletBalancePreflight({
      publicClient: getBasePreflightPublicClient(),
      wallet: wallet.address as Address,
      valueWei: 0n,
    })
  } catch (error) {
    logger.warn('[zora/trends] balance preflight threw unexpectedly; proceeding', {
      ticker: preflight.ticker,
      wallet: wallet.address,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  if (balancePreflight && balancePreflight.sufficient === false) {
    logger.warn('[zora/trends] agent wallet insufficient for trend deploy', {
      ticker: preflight.ticker,
      wallet: wallet.address,
      balanceWei: balancePreflight.balanceWei.toString(),
      requiredWei: balancePreflight.requiredWei.toString(),
    })
    throw new TrendInsufficientFundsError(balancePreflight.message)
  }

  const idempotencyKey = `zora-trend-deploy:${params.groupId}:${preflight.tickerHash}`
  let tx: any
  try {
    tx = await walletRpc<any>({
      walletId: wallet.walletId,
      method: 'eth_sendTransaction',
      caip2: BASE_CAIP2,
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
  } catch (error) {
    if (isInsufficientFundsError(error)) {
      logger.warn('[zora/trends] walletRpc returned insufficient-funds after preflight', {
        ticker: preflight.ticker,
        wallet: wallet.address,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new TrendInsufficientFundsError(
        "This trade can't be executed right now — the agent wallet needs funding before it can cover gas. " +
          'Contact setup or try again after it is topped up.',
      )
    }
    throw error
  }

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

// ---------------------------------------------------------------------------
// Architecture B — reserveTrendTickerViaUserOp
// ---------------------------------------------------------------------------

/**
 * Typed refusal surfaced when `reserveTrendTickerViaUserOp` cannot proceed
 * (TEE attestation denied, factory address mismatch, UserOp submitter
 * refusal). Callers (`commands.ts`) map `.response` straight to the user.
 */
export type TrendReserveArchBRefusal = {
  ok: false
  code:
    | 'tee_attestation_denied'
    | 'factory_target_mismatch'
    | 'userop_refused'
  response: string
}

export type TrendReserveArchBResult =
  | ({ ok: true } & TrendReserveResult & {
      userOpHash: `0x${string}`
      smartWallet: `0x${string}`
    })
  | TrendReserveArchBRefusal

/**
 * Route a TrendCoin deploy through the command issuer's Coinbase Smart
 * Wallet via `submitUserOpOrRefuse` (Phase 4).
 *
 * Key differences from the legacy agent-EOA path:
 * - Deployer is the CSW, not a Privy-managed EOA. No agent-wallet funding
 *   is required.
 * - Caps + preflight + daily ledger are enforced inside `submitUserOpOrRefuse`.
 * - No custom idempotency key; the CSW UserOp nonce prevents double-execution.
 * - TEE attestation is required before the UserOp is built.
 * - Factory target is re-checked against env/default before dispatch
 *   (defense in depth against env drift).
 */
export async function reserveTrendTickerViaUserOp(params: {
  ticker: string
  issuer: CommandIssuerContext
  groupId: string
  waitForReceipt?: boolean
}): Promise<TrendReserveArchBResult> {
  // 1. Ticker preflight (shared with legacy path).
  const preflight = await preflightTrendTicker({ ticker: params.ticker })
  if (preflight.deployed) {
    return {
      ok: true,
      ticker: preflight.ticker,
      tickerHash: preflight.tickerHash,
      predictedAddress: preflight.predictedAddress,
      deployedAddress: preflight.predictedAddress,
      deployed: true,
      txHash: null,
      walletAddress: null,
      walletId: null,
      status: 'already_deployed',
      userOpHash: '0x' as `0x${string}`,
      smartWallet: params.issuer.smartWallet as `0x${string}`,
    }
  }

  // 2. TEE attestation gate. Distinct action name so auditors can filter
  //    trend-deploys from coin-trades in attestation logs.
  try {
    await assertTeeAttestationOrThrow({
      action: 'zora.trend.reserve',
      actorAddress: params.issuer.smartWallet,
      metadata: {
        groupId: params.groupId,
        ticker: preflight.ticker,
        tickerHash: preflight.tickerHash,
        predictedAddress: preflight.predictedAddress,
        archBPhase: 4,
      },
    })
  } catch (err) {
    logger.warn('[zora/trends/arch-b] TEE attestation gate denied reserve', {
      groupId: params.groupId,
      ticker: preflight.ticker,
      smartWallet: params.issuer.smartWallet,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      code: 'tee_attestation_denied',
      response:
        'Trend reserve denied: secure signer attestation is not verified. Please retry once attestation is healthy.',
    }
  }

  // 3. Build the deploy calldata against the configured factory.
  const factory = getFactoryAddress()
  const data = encodeFunctionData({
    abi: TREND_FACTORY_ABI,
    functionName: 'deployTrendCoin',
    args: [preflight.ticker],
  })

  // 4. Defensive factory-target re-check. `getFactoryAddress` already
  //    normalizes via `getAddress`, but we re-read the canonical source of
  //    truth and fail closed if anything looks off. The TrendCoinFactory is
  //    the ONLY contract this path should ever invoke.
  const configuredFactory = getAddress(
    String(process.env.ZORA_FACTORY_ADDRESS ?? '').trim() || DEFAULT_ZORA_FACTORY_ADDRESS,
  )
  if (getAddress(factory) !== configuredFactory) {
    logger.error('[zora/trends/arch-b] factory target mismatch', {
      groupId: params.groupId,
      ticker: preflight.ticker,
      resolved: factory,
      configured: configuredFactory,
    })
    return {
      ok: false,
      code: 'factory_target_mismatch',
      response:
        "Trend reserve blocked: the TrendCoin factory address didn't match the configured value. Please contact support.",
    }
  }

  // 5. Build the single-call array. TrendCoinFactory.deployTrendCoin is
  //    non-payable, so value is always 0n.
  const calls: CoinbaseSmartWalletCall[] = [
    {
      to: factory,
      value: 0n,
      data: data as `0x${string}`,
    },
  ]

  // 6. Submit via the shared choke point. Caps + CSW preflight + daily
  //    ledger are all handled inside `submitUserOpOrRefuse`.
  const submission = await submitUserOpOrRefuse({
    issuer: params.issuer,
    calls,
    valueWei: 0n,
    correlationId: `zora/trend/reserve/arch-b:${params.groupId}:${preflight.tickerHash}`,
  })
  if (!submission.ok) {
    return {
      ok: false,
      code: 'userop_refused',
      response: submission.response,
    }
  }

  // 7. Optional receipt wait (the UserOp submitter already waits for bundler
  //    inclusion; this is an additional safety wait on the execution tx
  //    itself). Defaults match the legacy path's ZORA_TREND_WAIT_FOR_RECEIPT.
  const shouldWait = params.waitForReceipt ?? parseBooleanEnv('ZORA_TREND_WAIT_FOR_RECEIPT', true)
  if (shouldWait) {
    try {
      await getPublicClient().waitForTransactionReceipt({
        hash: submission.txHash,
        timeout: DEFAULT_DEPLOY_WAIT_TIMEOUT_MS,
      })
    } catch (error) {
      logger.warn('[zora/trends/arch-b] receipt wait failed; continuing', {
        groupId: params.groupId,
        ticker: preflight.ticker,
        txHash: submission.txHash,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // 8. Postflight to confirm the TrendCoin is live.
  let deployed = false
  try {
    const postflight = await preflightTrendTicker({ ticker: preflight.ticker })
    deployed = postflight.deployed
  } catch (error) {
    logger.warn('[zora/trends/arch-b] postflight failed after UserOp', {
      groupId: params.groupId,
      ticker: preflight.ticker,
      txHash: submission.txHash,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  logger.info('[zora/trends/arch-b] trend reserved via UserOp', {
    groupId: params.groupId,
    profileId: params.issuer.profileId,
    ticker: preflight.ticker,
    tickerHash: preflight.tickerHash,
    predictedAddress: preflight.predictedAddress,
    smartWallet: submission.smartWallet,
    txHash: submission.txHash,
    userOpHash: submission.userOpHash,
    deployed,
  })

  return {
    ok: true,
    ticker: preflight.ticker,
    tickerHash: preflight.tickerHash,
    predictedAddress: preflight.predictedAddress,
    deployedAddress: preflight.predictedAddress,
    deployed,
    txHash: submission.txHash,
    walletAddress: submission.smartWallet,
    walletId: null,
    status: deployed ? 'deployed' : 'submitted',
    userOpHash: submission.userOpHash,
    smartWallet: submission.smartWallet,
  }
}
