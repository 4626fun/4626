import { permit2ABI, permit2Address } from '@zoralabs/protocol-deployments'
import { getAddress, isAddress, type Hex } from 'viem'
import { base } from 'viem/chains'

import { apiFetch } from '@/lib/api/apiBase'
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
    body: JSON.stringify({
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      sender: params.sender,
      slippage: slippagePercentToFraction(params.slippagePct),
      signatures: params.signatures,
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

function convertPermitAmountsToString(permit: ZoraTradeQuotePermit['permit']): ZoraTradeQuotePermit['permit'] {
  return {
    ...permit,
    sigDeadline: String(permit.sigDeadline),
    details: {
      ...permit.details,
      amount: String(permit.details.amount),
    },
  }
}

export async function signZoraQuotePermits(params: {
  quote: TradeQuoteResponse
  signerAddress: string
  walletClient: {
    signTypedData: (args: Record<string, unknown>) => Promise<Hex | string>
  }
  publicClient: {
    readContract: (args: Record<string, unknown>) => Promise<unknown>
  }
}): Promise<ZoraTradeQuotePermit[]> {
  const pending = readZoraPermitsFromQuote(params.quote).filter(
    (item) => !item.signature?.trim() || item.signature === '0x',
  )
  if (pending.length === 0) return readZoraPermitsFromQuote(params.quote)

  const signatures: ZoraTradeQuotePermit[] = []
  for (const item of pending) {
    const permit = item.permit
    const token = getAddress(permit.details.token as `0x${string}`)
    const spender = getAddress(permit.spender as `0x${string}`)
    const signer = getAddress(params.signerAddress)

    const [, , nonce] = (await params.publicClient.readContract({
      abi: permit2ABI,
      address: permit2Address[base.id],
      functionName: 'allowance',
      args: [signer, token, spender],
    })) as [bigint, bigint, number]

    const message = {
      details: {
        token,
        amount: BigInt(permit.details.amount),
        expiration: Number(permit.details.expiration),
        nonce,
      },
      spender,
      sigDeadline: BigInt(permit.sigDeadline),
    }

    const signature = (await params.walletClient.signTypedData({
      account: signer,
      domain: {
        name: 'Permit2',
        chainId: base.id,
        verifyingContract: permit2Address[base.id],
      },
      primaryType: 'PermitSingle',
      types: PERMIT_SINGLE_TYPES,
      message,
    })) as Hex

    signatures.push({
      signature,
      permit: convertPermitAmountsToString(message as unknown as ZoraTradeQuotePermit['permit']),
    })
  }

  return signatures
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
