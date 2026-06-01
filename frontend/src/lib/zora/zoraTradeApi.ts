import { permit2ABI, permit2Address } from '@zoralabs/protocol-deployments'
import { getAddress, hashTypedData, isAddress, numberToHex, type Hex, type PublicClient } from 'viem'
import { base } from 'viem/chains'

import {
  extractExecutionFailedInnerSelector,
  extractRevertInfo,
  isPreflightSimulationRejection,
  isSwapPreflightSimulationRetryable,
} from '@/lib/aa/coinbaseErc4337ErrorUtils'
import { findCoinbaseSmartWalletOwnerIndex } from '@/lib/aa/coinbaseErc4337Owners'
import { getProductionBaseReadClient } from '@/lib/base/productionBaseReadClient'
import { apiFetch } from '@/lib/api/apiBase'
import {
  assertCswAcceptsErc1271Signature,
  signOwnerSignatureForCswErc1271,
} from '@/lib/wallet/cswOwnerSignature'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import {
  assertValidSwapTransaction,
  type CreateSwapResponse,
  type TradeQuoteRequest,
  type TradeQuoteResponse,
  type TransactionRequest,
} from '@/lib/uniswap/tradingApi'
import { coerceSwapTransactionValue } from '@/lib/uniswap/swapQuoteSanitize'
import { NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'
import { SWAP_PREPARE_STATUS, ZORA_SWAP_SIMULATION_FAILED_MESSAGE } from '@/lib/swap/swapStatusCopy'

export type ZoraTradeQuotePermit = {
  signature: string
  permit: {
    sigDeadline: string
    spender: string
    details: {
      token: string
      amount: string
      expiration: number
      nonce: number
    }
  }
}

export type ZoraTradeQuotePayload = {
  call: { target: string; data: string; value: string }
  permits?: ZoraTradeQuotePermit[]
  quote?: { amountOut?: string; slippage?: number }
}

const ZORA_TRADE_QUOTE_PATH = '/api/zora/tradeQuote'

/** Zora embeds this in calldata and permit.signature until a real Permit2 sig is supplied. */
export const ZORA_PERMIT_SIGNATURE_PLACEHOLDER = 'REPLACE_WITH_PERMIT_SIGNATURE'

export function isZoraPermitSignaturePlaceholder(signature: string | undefined | null): boolean {
  const sig = String(signature ?? '').trim()
  if (!sig || sig === '0x') return true
  return sig.includes(ZORA_PERMIT_SIGNATURE_PLACEHOLDER)
}

export function zoraCallDataContainsPermitPlaceholder(data: string | undefined | null): boolean {
  return String(data ?? '').includes(ZORA_PERMIT_SIGNATURE_PLACEHOLDER)
}

export function quoteNeedsZoraPermitFinalization(
  quote: TradeQuoteResponse | null | undefined,
): boolean {
  if (!isZoraProviderQuote(quote)) return false
  if (readZoraPermitsFromQuote(quote).some((item) => isZoraPermitSignaturePlaceholder(item.signature))) {
    return true
  }
  const call = readZoraCallFromQuote(quote)
  return Boolean(call?.data && zoraCallDataContainsPermitPlaceholder(call.data))
}

function slippagePercentToFraction(slippagePct: number): number {
  const n = Number(slippagePct)
  if (!Number.isFinite(n) || n <= 0) return 0.005
  return Math.min(0.99, n / 100)
}

export function isZoraProviderQuote(value: TradeQuoteResponse | null | undefined): boolean {
  return String((value as any)?.provider ?? (value as any)?._provider ?? '')
    .trim()
    .toLowerCase() === 'zora'
}

export function readZoraCallFromQuote(quote: TradeQuoteResponse | null | undefined): ZoraTradeQuotePayload['call'] | null {
  const direct = (quote as any)?.zoraCall
  if (direct?.target && direct?.data) return direct
  const nested = (quote as any)?.quote?._zoraCall
  if (nested?.target && nested?.data) return nested
  return null
}

export function readZoraPermitsFromQuote(quote: TradeQuoteResponse | null | undefined): ZoraTradeQuotePermit[] {
  const permits = (quote as any)?.zoraPermits
  return Array.isArray(permits) ? permits : []
}

export function zoraTradeQuoteToResponse(params: {
  tokenIn: string
  tokenOut: string
  amountIn: string
  payload: ZoraTradeQuotePayload
}): TradeQuoteResponse {
  const amountOut = String(params.payload.quote?.amountOut ?? '').trim()
  const classicQuote: Record<string, unknown> = {
    _provider: 'zora',
    input: {
      token: params.tokenIn,
      amount: params.amountIn,
    },
    output: amountOut
      ? {
          token: params.tokenOut,
          amount: amountOut,
        }
      : undefined,
    amountOut: amountOut || undefined,
    _zoraCall: params.payload.call,
    _zoraSlippage: params.payload.quote?.slippage,
  }

  return {
    routing: 'CLASSIC',
    provider: 'zora',
    _provider: 'zora',
    zoraCall: params.payload.call,
    zoraPermits: params.payload.permits ?? [],
    zoraQuoteSlippage: params.payload.quote?.slippage,
    quote: classicQuote,
  } as unknown as TradeQuoteResponse
}

/** Slippage percent (0.5 = 0.5%) recorded on the last Zora quote refresh, if present. */
export function readZoraQuotedSlippagePct(quote: TradeQuoteResponse | null | undefined): number | null {
  const raw =
    (quote as { zoraQuoteSlippage?: number } | null | undefined)?.zoraQuoteSlippage ??
    (quote as { quote?: { _zoraSlippage?: number } } | null | undefined)?.quote?._zoraSlippage
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  return raw >= 1 ? raw : raw * 100
}

/** Next slippage step after a bundler send failure when prepare-time simulation already passed. */
export function pickNextZoraBundlerRetrySlippagePct(slippagePct: number): number | null {
  const ladder = buildZoraSlippageEscalationLadder(Math.max(slippagePct, 5))
  for (const pct of ladder) {
    if (pct > slippagePct + 1e-9) return pct
  }
  return null
}

/** Retry simulation with higher slippage when the router reverts (thin pools / stale minOut). */
export function buildZoraSlippageEscalationLadder(slippagePct: number): number[] {
  const start = Number(slippagePct)
  const base = Number.isFinite(start) && start > 0 ? start : 0.5
  const candidates = [base, 2, 5, 10, 15, 20, 25, 30]
  const ladder: number[] = []
  for (const pct of candidates) {
    if (pct + 1e-9 < base) continue
    if (!ladder.some((v) => Math.abs(v - pct) < 1e-9)) ladder.push(pct)
  }
  return ladder.slice(0, 6)
}

/** Production eth_call passed but CDP/bundler simulation reverted (common on thin creator pools). */
export class ZoraBundlerSimulationMismatchError extends Error {
  override readonly name = 'ZoraBundlerSimulationMismatchError'
}

export function isZoraBundlerSimulationMismatchError(error: unknown): error is ZoraBundlerSimulationMismatchError {
  return error instanceof ZoraBundlerSimulationMismatchError
}

export function buildZoraBundlerSimulationMismatchError(): ZoraBundlerSimulationMismatchError {
  return new ZoraBundlerSimulationMismatchError(
    'The swap looked valid locally but the sponsored transaction simulation failed. ' +
      ZORA_SWAP_SIMULATION_FAILED_MESSAGE,
  )
}

/** Bundler rejected a UserOp after local Zora eth_call passed — refresh quote and retry once. */
export function isZoraBundlerSendRetryable(error: unknown): boolean {
  if (isZoraBundlerSimulationMismatchError(error)) return true
  if (isPreflightSimulationRejection(error) && isSwapPreflightSimulationRetryable(error)) {
    return true
  }
  if (isZoraRouterSimulationRetryable(error)) return true
  const msg = String(error instanceof Error ? error.message : error).toLowerCase()
  if (
    msg.includes('permit2 rejected') ||
    msg.includes('invalid signature') ||
    msg.includes('aa25') ||
    msg.includes('invalid account nonce') ||
    msg.includes('sponsorship limit') ||
    msg.includes('session expired') ||
    msg.includes('not authenticated')
  ) {
    return false
  }
  return (
    msg.includes('unknown reason') ||
    msg.includes('bundler could not simulate') ||
    msg.includes('bundler rejected') ||
    msg.includes('simulation passed but the sponsored') ||
    msg.includes('eth_estimateuseroperationgas failed')
  )
}

export function isZoraRouterSimulationRetryable(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase()
  if (
    msg.includes('permit2 rejected') ||
    msg.includes('0xb0669cbc') ||
    msg.includes('invalidcontractsignature') ||
    msg.includes('not an on-chain owner') ||
    msg.includes('embedded signer is not')
  ) {
    return false
  }
  return (
    msg.includes('would fail on-chain') ||
    msg.includes('would revert') ||
    msg.includes('malformed or stale') ||
    msg.includes('0x2c4029e9') ||
    msg.includes('0x3b99b53d') ||
    msg.includes('sliceoutofbounds') ||
    msg.includes('stale quote') ||
    msg.includes('slippage') ||
    msg.includes('liquidity')
  )
}

export async function fetchZoraTradeQuoteFromApi(params: {
  tokenIn: string
  tokenOut: string
  amountIn: string
  sender: string
  slippagePct: number
  signatures?: ZoraTradeQuotePermit[]
}): Promise<ZoraTradeQuotePayload> {
  const res = await apiFetch(ZORA_TRADE_QUOTE_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: jsonStringifyForApi({
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      sender: params.sender,
      slippage: slippagePercentToFraction(params.slippagePct),
      signatures: params.signatures?.map((item) => ({
        signature: item.signature,
        permit: convertPermitAmountsToString(item.permit),
      })),
    }),
  })

  // Support both modern `{ success, data: ZoraTradeQuotePayload }` and legacy top-level spread responses.
  type LegacyZoraQuote = ZoraTradeQuotePayload & { call?: ZoraTradeQuotePayload['call'] }
  const envelope = await parseApiEnvelope<ZoraTradeQuotePayload | LegacyZoraQuote>(res)

  if (!res.ok || !envelope?.success) {
    throw new Error(resolveApiErrorMessage(envelope, 'Zora trade quote failed'))
  }

  const raw = envelope.data ?? (envelope as any as LegacyZoraQuote)

  const data: ZoraTradeQuotePayload | null =
    raw && typeof raw === 'object' && 'call' in raw && raw.call?.target && raw.call?.data
      ? (raw as ZoraTradeQuotePayload)
      : null

  if (!data?.call?.target || !data?.call?.data) {
    if (data?.permits?.length) {
      throw new Error(
        'Zora trade requires a Permit2 signature before the swap can be quoted. Open review and confirm in your wallet.',
      )
    }
    throw new Error('Zora trade quote response missing executable call')
  }

  return data
}

/** Map a production `eth_call` failure from the Zora Universal Router into user-facing copy. */
export function formatZoraRouterSimulationFailure(error: unknown): Error {
  const info = extractRevertInfo(error)
  const revertData = info.revertData
  const selector = revertData?.slice(0, 10).toLowerCase()

  if (selector === '0x3b99b53d') {
    return new Error(
      'Swap route data from Zora is malformed or stale. Refresh the quote and try again.',
    )
  }

  if (selector === '0xb0669cbc') {
    return new Error(
      'Permit2 rejected the smart-wallet signature. Refresh the quote, sign again when prompted, then retry.',
    )
  }

  const innerSelector = extractExecutionFailedInnerSelector(revertData)
  if (innerSelector === '0xb0669cbc') {
    return new Error(
      'Permit2 rejected the smart-wallet signature. Refresh the quote, sign again when prompted, then retry.',
    )
  }

  const isExecutionFailed =
    selector === '0x2c4029e9' ||
    info.errorName === 'ExecutionFailed(uint256,bytes)' ||
    String(info.error ?? '')
      .toLowerCase()
      .includes('executionfailed')

  if (isExecutionFailed) {
    return new Error(ZORA_SWAP_SIMULATION_FAILED_MESSAGE)
  }

  const detail = info.errorName ?? info.error ?? 'unknown revert'
  return new Error(
    `Zora swap would revert on-chain (${detail}). Refresh the quote and try again.`,
  )
}

function isInvalidEthCallSenderParameterError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase()
  return (
    msg.includes('invalid parameters were provided') ||
    msg.includes('missing or invalid parameters')
  )
}

async function ethCallZoraRouterAsCsw(params: {
  readClient: PublicClient
  executionAddress: `0x${string}`
  target: `0x${string}`
  data: Hex
  value: bigint
}): Promise<void> {
  const from = getAddress(params.executionAddress)
  try {
    await params.readClient.call({
      to: params.target,
      data: params.data,
      value: params.value,
      account: from,
      blockTag: 'latest',
    })
    return
  } catch (e: unknown) {
    if (!isInvalidEthCallSenderParameterError(e)) throw e
  }

  await params.readClient.transport.request({
    method: 'eth_call',
    params: [
      {
        to: params.target,
        data: params.data,
        value: numberToHex(BigInt(params.value)),
        from,
      },
      'latest',
    ],
  })
}

/** Production-RPC eth_call: CSW → Zora router (catches stale/malformed route bytes before UserOp submit). */
export async function assertZoraRouterCallExecutesFromCsw(params: {
  executionAddress: `0x${string}`
  call: { target: string; data: string; value?: string | null }
}): Promise<void> {
  const readClient = getProductionBaseReadClient()
  const target = getAddress(params.call.target as `0x${string}`)
  const data = params.call.data as Hex
  const value = BigInt(params.call.value ?? '0')
  // Match sponsored bundler simulation (chain head), not pending mempool state.
  try {
    await ethCallZoraRouterAsCsw({
      readClient,
      executionAddress: getAddress(params.executionAddress),
      target,
      data,
      value,
    })
  } catch (e: unknown) {
    throw formatZoraRouterSimulationFailure(e)
  }
}

export function buildSwapFromZoraQuote(params: {
  quote: TradeQuoteResponse
  executionAddress: string
  chainId: number
}): CreateSwapResponse {
  const call = readZoraCallFromQuote(params.quote)
  if (!call?.target || !call.data) {
    throw new Error('Zora quote does not contain executable call data')
  }
  if (zoraCallDataContainsPermitPlaceholder(call.data)) {
    throw new Error(
      'Zora swap requires a Permit2 signature before it can execute. Confirm the permit in your wallet and try again.',
    )
  }

  const executionAddress = String(params.executionAddress ?? '').trim()
  if (!isAddress(executionAddress)) {
    throw new Error('Invalid execution address for Zora swap')
  }

  const swap: TransactionRequest = {
    to: getAddress(call.target),
    from: getAddress(executionAddress),
    data: call.data,
    value: coerceSwapTransactionValue(call.value) as TransactionRequest['value'],
    chainId: params.chainId as TransactionRequest['chainId'],
  }

  assertValidSwapTransaction(swap)
  const requestId =
    typeof params.quote === 'object' && params.quote && 'requestId' in params.quote
      ? String((params.quote as { requestId?: string }).requestId ?? '').trim() || 'zora-trade'
      : 'zora-trade'
  return { swap, requestId }
}

export function shouldUseZoraTradeRoute(body: TradeQuoteRequest, preferZoraTradeRoute: boolean): boolean {
  if (!preferZoraTradeRoute) return false
  if (body.providerOverride === 'uniswap' || body.providerOverride === 'cdp') return false
  if (Number(body.tokenInChainId) !== 8453 || Number(body.tokenOutChainId) !== 8453) return false
  return true
}

export function normalizeZoraTradeTokenAddress(address: string): string {
  const trimmed = address.trim()
  if (trimmed.toLowerCase() === NATIVE_TOKEN_ADDRESS) return trimmed
  return getAddress(trimmed)
}

const PERMIT_SINGLE_TYPES = {
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
} as const

function convertPermitAmountsToString(
  permit: ZoraTradeQuotePermit['permit'] | Record<string, unknown>,
): ZoraTradeQuotePermit['permit'] {
  const details = (permit as ZoraTradeQuotePermit['permit']).details
  return {
    sigDeadline: String((permit as ZoraTradeQuotePermit['permit']).sigDeadline),
    spender: String((permit as ZoraTradeQuotePermit['permit']).spender),
    details: {
      token: String(details.token),
      amount: String(details.amount),
      expiration: Number(details.expiration),
      nonce: Number(details.nonce),
    },
  }
}

/** Privy `eth_signTypedData_v4` JSON-stringifies the payload — no BigInt allowed. */
function buildPermit2TypedDataMessage(params: {
  token: `0x${string}`
  spender: `0x${string}`
  amount: bigint
  expiration: number
  nonce: number
  sigDeadline: bigint
}) {
  return {
    details: {
      token: params.token,
      amount: params.amount,
      expiration: params.expiration,
      nonce: params.nonce,
    },
    spender: params.spender,
    sigDeadline: params.sigDeadline,
  }
}

/** Permit payload sent to Zora must match the typed-data fields we signed (incl. on-chain nonce). */
export function mergePermitWithChainNonce(
  permit: ZoraTradeQuotePermit['permit'],
  chainNonce: number,
): ZoraTradeQuotePermit['permit'] {
  const base = convertPermitAmountsToString(permit)
  return {
    ...base,
    details: {
      ...base.details,
      nonce: chainNonce,
    },
  }
}

function jsonStringifyForApi(value: unknown): string {
  return JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val))
}

async function readPermit2AllowanceNonce(params: {
  readClient: PublicClient
  permitOwner: `0x${string}`
  token: `0x${string}`
  spender: `0x${string}`
}): Promise<number> {
  const [, , nonce] = (await params.readClient.readContract({
    abi: permit2ABI,
    address: permit2Address[base.id],
    functionName: 'allowance',
    args: [params.permitOwner, params.token, params.spender],
  })) as any as readonly [bigint, bigint, number]
  return Number(nonce)
}

/** True when a CSW-held sell needs a fresh Permit2 signature (placeholder or on-chain nonce drift). */
export async function zoraPermitNeedsResign(params: {
  item: ZoraTradeQuotePermit
  executionAddress?: string | null
  publicClient: {
    readContract: (args: Record<string, unknown>) => Promise<unknown>
    getBytecode?: (args: { address: `0x${string}` }) => Promise<Hex | undefined>
  }
}): Promise<boolean> {
  if (isZoraPermitSignaturePlaceholder(params.item.signature)) return true

  const executionRaw = String(params.executionAddress ?? '').trim()
  if (!executionRaw || !isAddress(executionRaw)) return false

  const permit = params.item.permit
  const token = getAddress(permit.details.token as `0x${string}`)
  const spender = getAddress(permit.spender as `0x${string}`)
  const permitOwner = getAddress(executionRaw)
  const readClient = getProductionBaseReadClient()
  const chainNonce = await readPermit2AllowanceNonce({
    readClient,
    permitOwner,
    token,
    spender,
  })
  return zoraPermitNonceDrifted(permit.details.nonce, chainNonce)
}

export function zoraPermitNonceDrifted(quotedNonce: number, chainNonce: number): boolean {
  return Number(quotedNonce) !== Number(chainNonce)
}

export async function isDeployedSmartWalletExecutionAddress(
  executionAddress?: string | null,
): Promise<boolean> {
  const executionRaw = String(executionAddress ?? '').trim()
  if (!executionRaw || !isAddress(executionRaw)) return false
  const readClient = getProductionBaseReadClient()
  const bytecode = await readClient.getBytecode({ address: getAddress(executionRaw) })
  return Boolean(bytecode && bytecode !== '0x')
}

async function signOneZoraQuotePermit(params: {
  permit: ZoraTradeQuotePermit['permit']
  signerAddress: string
  executionAddress?: string | null
  walletClient: {
    signTypedData: (args: Record<string, unknown>) => Promise<Hex | string>
    signMessage?: (args: Record<string, unknown>) => Promise<Hex | string>
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  }
  publicClient: {
    readContract: (args: Record<string, unknown>) => Promise<unknown>
    getBytecode?: (args: { address: `0x${string}` }) => Promise<Hex | undefined>
  }
}): Promise<ZoraTradeQuotePermit> {
  const permit = params.permit
  const token = getAddress(permit.details.token as `0x${string}`)
  const spender = getAddress(permit.spender as `0x${string}`)
  const signer = getAddress(params.signerAddress)
  const executionRaw = String(params.executionAddress ?? '').trim()
  const executionAddress =
    executionRaw && isAddress(executionRaw) ? getAddress(executionRaw) : null
  const permitOwner = executionAddress ?? signer
  let permitOwnerIsContract = executionAddress !== null && executionAddress !== signer
  const readClient: PublicClient =
    permitOwnerIsContract && executionAddress
      ? getProductionBaseReadClient()
      : (params.publicClient as any as PublicClient)

  if (permitOwnerIsContract && readClient.getBytecode) {
    const bytecode = await readClient.getBytecode({ address: permitOwner })
    permitOwnerIsContract = Boolean(bytecode && bytecode !== '0x')
  }

  const chainNonce = await readPermit2AllowanceNonce({
    readClient,
    permitOwner,
    token,
    spender,
  })
  const permitForApi = mergePermitWithChainNonce(permit, chainNonce)
  const signMessage = buildPermit2TypedDataMessage({
    token,
    spender,
    amount: BigInt(permitForApi.details.amount),
    expiration: permitForApi.details.expiration,
    nonce: chainNonce,
    sigDeadline: BigInt(permitForApi.sigDeadline),
  })

  const permitDomain = {
    name: 'Permit2',
    chainId: base.id,
    verifyingContract: permit2Address[base.id],
  } as const

  let signature: Hex
  if (permitOwnerIsContract && executionAddress) {
    const ownerLookup = await findCoinbaseSmartWalletOwnerIndex({
      publicClient: readClient,
      smartWallet: executionAddress,
      ownerAddress: signer,
    })
    if (ownerLookup.ownerIndex === null) {
      throw new Error(
        'Embedded signer is not an on-chain owner of your Coinbase Smart Wallet. Finish waitlist signing setup, then retry the swap.',
      )
    }

    const permitDigest = hashTypedData({
      domain: permitDomain,
      types: PERMIT_SINGLE_TYPES,
      primaryType: 'PermitSingle',
      message: signMessage,
    })
    signature = await signOwnerSignatureForCswErc1271({
      innerTypedDataDigest: permitDigest,
      smartWallet: executionAddress,
      ownerIndex: ownerLookup.ownerIndex,
      signerAddress: signer,
      walletClient: params.walletClient,
      publicClient: readClient,
    })
    await assertCswAcceptsErc1271Signature({
      publicClient: readClient,
      smartWallet: executionAddress,
      digest: permitDigest,
      signature,
    })
  } else {
    signature = (await params.walletClient.signTypedData({
      account: signer,
      domain: permitDomain,
      primaryType: 'PermitSingle',
      types: PERMIT_SINGLE_TYPES,
      message: signMessage,
    })) as Hex
  }

  return {
    signature,
    permit: permitForApi,
  }
}

export async function signZoraQuotePermits(params: {
  quote: TradeQuoteResponse
  /** Privy embedded EOA (or external signer) that signs Permit2 typed data. */
  signerAddress: string
  /** CSW that holds sell tokens and executes the Zora call; required for ERC-20 sells. */
  executionAddress?: string | null
  /** Re-sign every permit (e.g. CSW submit after a prior personal_sign quote). */
  forceResignPermits?: boolean
  walletClient: {
    signTypedData: (args: Record<string, unknown>) => Promise<Hex | string>
    signMessage?: (args: Record<string, unknown>) => Promise<Hex | string>
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  }
  publicClient: {
    readContract: (args: Record<string, unknown>) => Promise<unknown>
    getBytecode?: (args: { address: `0x${string}` }) => Promise<Hex | undefined>
  }
}): Promise<ZoraTradeQuotePermit[]> {
  const allPermits = readZoraPermitsFromQuote(params.quote)
  if (allPermits.length === 0) return []

  const signatures: ZoraTradeQuotePermit[] = []
  for (const item of allPermits) {
    const needsResign =
      params.forceResignPermits === true ||
      (await zoraPermitNeedsResign({
        item,
        executionAddress: params.executionAddress,
        publicClient: params.publicClient,
      }))
    if (!needsResign) {
      signatures.push({
        signature: item.signature,
        permit: convertPermitAmountsToString(item.permit),
      })
      continue
    }

    signatures.push(
      await signOneZoraQuotePermit({
        permit: item.permit,
        signerAddress: params.signerAddress,
        executionAddress: params.executionAddress,
        walletClient: params.walletClient,
        publicClient: params.publicClient,
      }),
    )
  }

  return signatures
}

type ZoraCswWalletClient = {
  signTypedData: (args: Record<string, unknown>) => Promise<Hex | string>
  signMessage?: (args: Record<string, unknown>) => Promise<Hex | string>
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/**
 * Sign Permit2, refresh Zora calldata, and production-simulate CSW → router.
 * Escalates slippage (e.g. 0.5% → 2% → 5%) when simulation fails on thin creator pools.
 */
export async function executeZoraCswQuoteWithEscalation(params: {
  quote: TradeQuoteResponse
  tokenIn: string
  tokenOut: string
  amountIn: string
  sender: string
  slippagePct: number
  /** When set (auto slippage), simulation may escalate above `slippagePct` up to this cap. */
  slippageEscalationCapPct?: number
  signerAddress: string
  executionAddress?: string | null
  walletClient: ZoraCswWalletClient
  publicClient: {
    readContract: (args: Record<string, unknown>) => Promise<unknown>
    getBytecode?: (args: { address: `0x${string}` }) => Promise<Hex | undefined>
  }
  onStatus?: (message: string) => void
}): Promise<TradeQuoteResponse> {
  const sender = String(params.sender ?? '').trim()
  if (!isAddress(sender)) {
    throw new Error('Execution address is required to refresh the Zora trade quote.')
  }

  const needsPermitFlow =
    quoteNeedsZoraPermitFinalization(params.quote) || readZoraPermitsFromQuote(params.quote).length > 0

  if (!needsPermitFlow) return params.quote

  if (!params.walletClient || !params.signerAddress || !params.publicClient) {
    throw new Error('Permit2 signature is required for this Zora trade, but the owner signer is not available.')
  }

  const startSlippage = Math.max(
    params.slippagePct,
    readZoraQuotedSlippagePct(params.quote) ?? 0,
  )
  const isCswExecution = await isDeployedSmartWalletExecutionAddress(params.executionAddress)
  const escalationCap =
    params.slippageEscalationCapPct != null && Number.isFinite(params.slippageEscalationCapPct)
      ? params.slippageEscalationCapPct
      : params.slippagePct
  // Thin creator pools (e.g. AKITA) usually need ≥5% on CSW-sponsored paths; 0.5% often passes
  // stale pending eth_call but reverts on bundler simulation.
  const rawLadder = buildZoraSlippageEscalationLadder(
    isCswExecution ? Math.max(startSlippage, 5) : startSlippage,
  )
  const ladder = rawLadder.filter((pct) => pct <= escalationCap + 1e-9)
  const effectiveLadder =
    ladder.length > 0
      ? ladder
      : [isCswExecution ? Math.max(params.slippagePct, 5) : params.slippagePct]
  const forceResignPermits = isCswExecution

  let lastError: unknown
  for (let i = 0; i < effectiveLadder.length; i += 1) {
    const slippagePct = effectiveLadder[i]
    try {
      if (i > 0) {
        params.onStatus?.(SWAP_PREPARE_STATUS)
      }

      let baseQuote = params.quote
      if (i > 0) {
        const payload = await fetchZoraTradeQuoteFromApi({
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          sender,
          slippagePct: slippagePct ?? 0.5,
        })
        baseQuote = zoraTradeQuoteToResponse({
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          payload,
        })
      }

      const signatures = await signZoraQuotePermits({
        quote: baseQuote,
        signerAddress: params.signerAddress,
        executionAddress: params.executionAddress,
        forceResignPermits: forceResignPermits || i > 0,
        walletClient: params.walletClient,
        publicClient: params.publicClient,
      })

      if (signatures.length === 0) {
        throw new Error('Zora trade is missing Permit2 authorization. Refresh the quote and try again.')
      }

      return await refreshZoraTradeQuoteWithSimulation({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        sender,
        slippagePct: slippagePct ?? 0.5,
        signatures,
      })
    } catch (error) {
      lastError = error
      if (i >= effectiveLadder.length - 1 || !isZoraRouterSimulationRetryable(error)) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Zora trade preparation failed')
}

/**
 * Before submitting a Zora swap from a CSW, refresh router calldata and re-sign Permit2 when
 * the on-chain nonce no longer matches the quote (common after review → confirm delay).
 */
export async function prepareZoraQuoteForExecute(params: {
  quote: TradeQuoteResponse
  tokenIn: string
  tokenOut: string
  amountIn: string
  sender: string
  slippagePct: number
  slippageEscalationCapPct?: number
  signerAddress: string
  executionAddress?: string | null
  walletClient: ZoraCswWalletClient
  publicClient: {
    readContract: (args: Record<string, unknown>) => Promise<unknown>
    getBytecode?: (args: { address: `0x${string}` }) => Promise<Hex | undefined>
  }
  onStatus?: (message: string) => void
}): Promise<TradeQuoteResponse> {
  if (!isZoraProviderQuote(params.quote)) return params.quote
  return executeZoraCswQuoteWithEscalation(params)
}

/** Refresh Zora router calldata with signed permits, then simulate CSW → router on production Base RPC. */
export async function refreshZoraTradeQuoteWithSimulation(params: {
  tokenIn: string
  tokenOut: string
  amountIn: string
  sender: string
  slippagePct: number
  signatures: ZoraTradeQuotePermit[]
}): Promise<TradeQuoteResponse> {
  const refreshed = await refreshZoraTradeQuoteWithPermits(params)
  const sender = String(params.sender ?? '').trim()
  if (!isAddress(sender)) {
    throw new Error('Execution address is required to simulate the Zora trade.')
  }

  const call = readZoraCallFromQuote(refreshed)
  if (call?.target && call.data) {
    await assertZoraRouterCallExecutesFromCsw({
      executionAddress: getAddress(sender),
      call,
    })
  }

  return refreshed
}

export async function refreshZoraTradeQuoteWithPermits(params: {
  tokenIn: string
  tokenOut: string
  amountIn: string
  sender: string
  slippagePct: number
  signatures: ZoraTradeQuotePermit[]
}): Promise<TradeQuoteResponse> {
  const payload = await fetchZoraTradeQuoteFromApi({
    ...params,
    signatures: params.signatures,
  })
  return zoraTradeQuoteToResponse({
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    payload,
  })
}
