import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { erc20Abi, getAddress, isAddress } from 'viem'
import { usePublicClient } from 'wagmi'

import { useTokenImage } from '@/hooks/useTokenMetadata'
import { creatorCoinRawLogo, resolveTokenDisplay, type TokenDisplay, type TokenOption } from '@/lib/uniswap/swapUtils'

export function useTokenIdentity(params: {
  address: string
  option: TokenOption | null
}): {
  display: TokenDisplay
  isLoading: boolean
} {
  const publicClient = usePublicClient()
  const shouldFetchOnchain = Boolean(
    publicClient && isAddress(params.address) && params.option?.group !== 'core',
  )
  const shouldFetchImage = Boolean(shouldFetchOnchain && !params.option?.logoUrl)

  const tokenImage = useTokenImage(
    shouldFetchImage ? (params.address as `0x${string}`) : undefined,
  )
  const creatorCoinImageUrl = useMemo(() => {
    if (params.option?.group !== 'creator') return null
    if (!isAddress(params.address)) return null
    return creatorCoinRawLogo(getAddress(params.address), 8453)
  }, [params.address, params.option?.group])

  const tokenMetadataQuery = useQuery({
    queryKey: ['token-identity', params.address.toLowerCase()],
    enabled: shouldFetchOnchain,
    staleTime: 120_000,
    queryFn: async () => {
      if (!publicClient || !isAddress(params.address)) return null
      const [nameRaw, symbolRaw] = await Promise.all([
        publicClient.readContract({
          address: params.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name',
        }).catch(() => null),
        publicClient.readContract({
          address: params.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'symbol',
        }).catch(() => null),
      ])
      const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
      const symbol = typeof symbolRaw === 'string' ? symbolRaw.trim() : ''
      return { name, symbol }
    },
  })

  const display = useMemo(
    () =>
      resolveTokenDisplay({
        option: params.option,
        address: params.address,
        onchain: tokenMetadataQuery.data ?? null,
        imageUrl: creatorCoinImageUrl ?? tokenImage.imageUrl,
      }),
    [params.option, params.address, tokenMetadataQuery.data, tokenImage.imageUrl, creatorCoinImageUrl],
  )

  return {
    display,
    isLoading: tokenMetadataQuery.isLoading || tokenImage.isLoading,
  }
}

