import { permit2ABI, permit2Address } from '@zoralabs/protocol-deployments'
import { getAddress, hashTypedData, isAddress, type Hex, type PublicClient } from 'viem'
import { base } from 'viem/chains'

import { findCoinbaseSmartWalletOwnerIndex } from '@/lib/aa/coinbaseErc4337Owners'
import { getProductionBaseReadClient } from '@/lib/base/productionBaseReadClient'
import { apiFetch } from '@/lib/api/apiBase'
import { wrapCswOwnerSignature } from '@/lib/wallet/cswOwnerSignature'
import { signRawEcdsaDigest } from '@/lib/wallet/signRawEcdsaDigest'
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
  }

  return {
    routing: 'CLASSIC',
    provider: 'zora',
    _provider: 'zora',
    zoraCall: params.payload.call,
    zoraPermits: params.payload.permits ?? [],
    quote: classicQuote,
  } as unknown as TradeQuoteResponse
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

  const envelope = await parseApiEnvelope<ZoraTradeQuotePayload & { call?: ZoraTradeQuotePayload['call'] }>(res)
  if (!res.ok || !envelope?.success) {
    throw new Error(resolveApiErrorMessage(envelope, 'Zora trade quote failed'))
  }

  // Server handlers must return `{ success, data }`; accept legacy top-level spread as fallback.
  const data =
    envelope.data ??
    (envelope.call?.target && envelope.call?.data
      ? ({
          call: envelope.call,
          permits: (envelope as ZoraTradeQuotePayload).permits,
          quote: (envelope as ZoraTradeQuotePayload).quote,
        } as ZoraTradeQuotePayload)
      : null)

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
  amount: string
  expiration: number
  nonce: number
  sigDeadline: string
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
  })) as [bigint, bigint, number]
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
      : (params.publicClient as PublicClient)

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
    amount: permitForApi.details.amount,
    expiration: permitForApi.details.expiration,
    nonce: chainNonce,
    sigDeadline: permitForApi.sigDeadline,
  })

  const permitDomain = {
    name: 'Permit2',
    chainId: base.id,
    verifyingContract: permit2Address[base.id],
  } as const

  let signature: Hex
  if (permitOwnerIsContract && executionAddress) {
    const digest = hashTypedData({
      domain: permitDomain,
      types: PERMIT_SINGLE_TYPES,
      primaryType: 'PermitSingle',
      message: signMessage,
    })
    signature = await signRawEcdsaDigest({
      digest,
      signerAddress: signer,
      walletClient: params.walletClient,
      label: 'zoraPermit2',
    })

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
    signature = wrapCswOwnerSignature(signature, ownerLookup.ownerIndex)
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
    const needsResign = await zoraPermitNeedsResign({
      item,
      executionAddress: params.executionAddress,
      publicClient: params.publicClient,
    })
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
}): Promise<TradeQuoteResponse> {
  if (!isZoraProviderQuote(params.quote)) return params.quote

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

  const signatures = await signZoraQuotePermits({
    quote: params.quote,
    signerAddress: params.signerAddress,
    executionAddress: params.executionAddress,
    walletClient: params.walletClient,
    publicClient: params.publicClient,
  })

  if (signatures.length === 0) {
    throw new Error('Zora trade is missing Permit2 authorization. Refresh the quote and try again.')
  }

  return refreshZoraTradeQuoteWithPermits({
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    sender,
    slippagePct: params.slippagePct,
    signatures,
  })
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
