import { apiFetch } from '@/lib/api/apiBase'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

export type CdpPriceRequest = {
  network: string
  fromToken: string
  toToken: string
  fromAmount: string
  taker?: string
  slippageBps?: number
  account?: string
  useCdpPaymaster?: boolean
}

export type CdpExecuteRequest = CdpPriceRequest

function normalizeCdpNetwork(chainId: number): string {
  if (chainId === 8453) return 'base'
  if (chainId === 1) return 'ethereum'
  if (chainId === 42161) return 'arbitrum'
  if (chainId === 10) return 'optimism'
  if (chainId === 137) return 'polygon'
  throw new Error(`CDP swaps are unsupported on chainId ${chainId}`)
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await parseApiEnvelope<T>(res)
  if (!res.ok || !json?.success) {
    const message = resolveApiErrorMessage(json, `Request failed (${res.status})`)
    throw new Error(message)
  }
  return json.data as T
}

export function buildCdpPriceRequest(params: {
  chainId: number
  tokenIn: string
  tokenOut: string
  amount: string
  swapper: string
  slippageTolerance: number
}): CdpPriceRequest {
  return {
    network: normalizeCdpNetwork(params.chainId),
    fromToken: params.tokenIn,
    toToken: params.tokenOut,
    fromAmount: params.amount,
    taker: params.swapper,
    slippageBps: Math.max(1, Math.round(params.slippageTolerance * 100)),
    account: params.swapper,
  }
}

export async function fetchCdpSwapPrice(body: CdpPriceRequest): Promise<Record<string, unknown>> {
  return await post<Record<string, unknown>>(API_ENDPOINTS.cdpSwap.price, body as Record<string, unknown>)
}

export async function executeCdpSwap(body: CdpExecuteRequest): Promise<Record<string, unknown>> {
  return await post<Record<string, unknown>>(API_ENDPOINTS.cdpSwap.execute, body as Record<string, unknown>)
}
