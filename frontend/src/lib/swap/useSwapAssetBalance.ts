import { useQuery } from '@tanstack/react-query'
import { getAddress, isAddress, type Address } from 'viem'

import { apiFetch } from '@/lib/api/apiBase'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { BASE_CHAIN_ID, NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'

export type SwapAssetBalance = {
  raw: bigint
  decimals: number
  formatted: string
}

type TokenBalanceApiData = {
  raw: string
  decimals: number
  formatted: string
}

export async function fetchSwapAssetBalanceViaApi(params: {
  ownerAddress: Address
  tokenAddress: string
}): Promise<SwapAssetBalance> {
  const qs = new URLSearchParams({
    owner: getAddress(params.ownerAddress),
    token: params.tokenAddress.trim(),
  })
  const res = await apiFetch(`/api/wallet/tokenBalance?${qs.toString()}`, { withCredentials: true })
  const body = await parseApiEnvelope<TokenBalanceApiData>(res)
  if (!res.ok || !body?.success || !body.data) {
    throw new Error(resolveApiErrorMessage(body, `token_balance_http_${res.status}`))
  }
  return {
    raw: BigInt(body.data.raw),
    decimals: body.data.decimals,
    formatted: body.data.formatted,
  }
}

export function swapAssetBalanceQueryKey(params: {
  chainId: number
  ownerAddress: Address | null | undefined
  tokenAddress: string
}) {
  return [
    'swap',
    'asset-balance',
    params.chainId,
    params.ownerAddress?.toLowerCase() ?? null,
    params.tokenAddress.trim().toLowerCase(),
  ] as const
}

export function useSwapAssetBalance(params: {
  ownerAddress: Address | null | undefined
  tokenAddress: string
  chainId: number
  enabled?: boolean
}) {
  const { ownerAddress, tokenAddress, chainId, enabled = true } = params
  const tokenLower = tokenAddress.trim().toLowerCase()
  const tokenReady = tokenLower === NATIVE_TOKEN_ADDRESS || isAddress(tokenAddress)

  return useQuery({
    queryKey: swapAssetBalanceQueryKey({ chainId, ownerAddress, tokenAddress }),
    enabled: Boolean(enabled && ownerAddress && chainId === BASE_CHAIN_ID && tokenReady),
    staleTime: 5_000,
    refetchInterval: 12_000,
    queryFn: async () => {
      const owner = getAddress(ownerAddress as Address)
      return fetchSwapAssetBalanceViaApi({ ownerAddress: owner, tokenAddress })
    },
  })
}
