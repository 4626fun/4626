import { getAddress, isAddress, type Address } from 'viem'

const BASE_CHAIN_ID = 8453
const ZORA_QUOTE_URL = 'https://api-sdk.zora.engineering/quote'
const NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

export type ZoraTradeCurrency =
  | { type: 'eth' }
  | { type: 'erc20'; address: string }

export type ZoraTradeQuoteCall = {
  target: string
  data: string
  value: string
}

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

export type ZoraTradeQuoteResult = {
  call: ZoraTradeQuoteCall
  permits?: ZoraTradeQuotePermit[]
  quote?: {
    amountOut?: string
    slippage?: number
    tokenIn?: { type?: string; address?: string }
  }
}

export function getZoraPlatformReferrerAddress(): Address | undefined {
  const explicit = (process.env.ZORA_PLATFORM_REFERRER_ADDRESS ?? '').trim()
  if (explicit && isAddress(explicit)) return getAddress(explicit) as Address

  const csw = (process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim()
  if (csw && isAddress(csw)) return getAddress(csw) as Address

  return undefined
}

export function toZoraTradeCurrency(tokenAddress: string): ZoraTradeCurrency {
  const normalized = tokenAddress.trim().toLowerCase()
  if (normalized === NATIVE_TOKEN_ADDRESS) return { type: 'eth' }
  if (!isAddress(tokenAddress)) {
    throw new Error('Invalid token address for Zora trade quote')
  }
  return { type: 'erc20', address: getAddress(tokenAddress) }
}

export async function fetchZoraTradeQuote(params: {
  tokenIn: string
  tokenOut: string
  amountIn: string
  slippage?: number
  sender: string
  signatures?: ZoraTradeQuotePermit[]
}): Promise<ZoraTradeQuoteResult> {
  const amountIn = String(params.amountIn ?? '').trim()
  if (!/^\d+$/.test(amountIn) || BigInt(amountIn) <= 0n) {
    throw new Error('Invalid amountIn: expected positive integer base-unit string')
  }

  const sender = String(params.sender ?? '').trim()
  if (!isAddress(sender)) {
    throw new Error('Invalid sender address for Zora trade quote')
  }

  const slippage = params.slippage
  if (slippage !== undefined && (slippage <= 0 || slippage >= 1)) {
    throw new Error('Zora slippage must be greater than 0 and less than 1')
  }

  const body: Record<string, unknown> = {
    tokenIn: toZoraTradeCurrency(params.tokenIn),
    tokenOut: toZoraTradeCurrency(params.tokenOut),
    amountIn,
    slippage,
    chainId: BASE_CHAIN_ID,
    sender: getAddress(sender),
    recipient: getAddress(sender),
  }

  const referrer = getZoraPlatformReferrerAddress()
  if (referrer) body.referrer = referrer
  if (params.signatures?.length) body.signatures = params.signatures

  const apiKey = (process.env.ZORA_SERVER_API_KEY ?? '').trim()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['x-api-key'] = apiKey

  const res = await fetch(ZORA_QUOTE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Zora quote API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const raw = (await res.json()) as {
    success?: boolean | string
    error?: string
    call?: ZoraTradeQuoteCall
    permits?: ZoraTradeQuotePermit[]
    quote?: ZoraTradeQuoteResult['quote']
  }

  const success =
    raw.success === true || String(raw.success ?? '').toLowerCase() === 'true'
  if (!success) {
    const message = String(raw.error ?? '').trim() || 'Zora quote API returned an error'
    throw new Error(message)
  }

  const data = raw

  if (!data.call?.target || !data.call?.data) {
    if (data.permits?.length) {
      throw new Error(
        'Zora quote returned Permit2 authorization only. Sign permits and request a follow-up quote.',
      )
    }
    throw new Error('Invalid Zora quote response — missing call data')
  }

  return {
    call: {
      target: getAddress(data.call.target),
      data: data.call.data,
      value: String(data.call.value ?? '0'),
    },
    permits: data.permits,
    quote: data.quote,
  }
}
