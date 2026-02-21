import { normalizeUniswapError } from './error'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; details?: unknown }

export type LiquidityAction = 'positions' | 'quote-create' | 'create' | 'add' | 'remove' | 'claim' | 'migrate'

export type LiquidityRequest<T = Record<string, unknown>> = {
  action: LiquidityAction
  payload: T
}

export async function callLiquidityApi<T = Record<string, unknown>>(body: LiquidityRequest): Promise<T> {
  try {
    const res = await fetch('/api/uniswap/liquidity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
    if (!res.ok || !json?.success) {
      const normalized = normalizeUniswapError(json?.error ?? `Request failed (${res.status})`)
      throw new Error(normalized.message)
    }
    return json.data as T
  } catch (error: any) {
    const normalized = normalizeUniswapError(error?.message ?? error)
    throw new Error(normalized.message)
  }
}

export async function fetchLiquidityPositions(walletAddress: string, chainId: number) {
  return callLiquidityApi({ action: 'positions', payload: { walletAddress, chainId } })
}

export async function quoteCreatePosition(payload: Record<string, unknown>) {
  return callLiquidityApi({ action: 'quote-create', payload })
}

export async function createPosition(payload: Record<string, unknown>) {
  return callLiquidityApi({ action: 'create', payload })
}

export async function addLiquidity(payload: Record<string, unknown>) {
  return callLiquidityApi({ action: 'add', payload })
}

export async function removeLiquidity(payload: Record<string, unknown>) {
  return callLiquidityApi({ action: 'remove', payload })
}

export async function claimLiquidityFees(payload: Record<string, unknown>) {
  return callLiquidityApi({ action: 'claim', payload })
}
