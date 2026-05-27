import { erc20Abi, isAddress, type Address } from 'viem'

import { CONTRACTS } from '@/config/contracts'
import { BASE_CHAIN_ID, NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'

/** Base mainnet tokens where a wrong decimals fallback breaks swap preflight. */
const BASE_KNOWN_TOKEN_DECIMALS: Record<string, number> = {
  [CONTRACTS.usdc.toLowerCase()]: 6,
  [CONTRACTS.weth.toLowerCase()]: 18,
}

type PublicDecimalsClient = {
  readContract: (args: {
    address: Address
    abi: typeof erc20Abi
    functionName: 'decimals'
  }) => Promise<unknown>
}

export async function resolveSwapTokenDecimals(params: {
  token: string
  chainId: number
  publicClient?: PublicDecimalsClient | null
}): Promise<number> {
  const tokenLower = params.token.trim().toLowerCase()
  if (tokenLower === NATIVE_TOKEN_ADDRESS) return 18

  if (params.chainId === BASE_CHAIN_ID) {
    const known = BASE_KNOWN_TOKEN_DECIMALS[tokenLower]
    if (known != null) return known
  }

  if (params.publicClient && isAddress(params.token)) {
    try {
      const decimals = await params.publicClient.readContract({
        address: params.token as Address,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      const parsed = Number(decimals)
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 36) return parsed
    } catch {
      // fall through
    }
  }

  // Creator/share coins on Base are overwhelmingly 18 decimals; avoid assuming 6.
  if (params.chainId === BASE_CHAIN_ID && isAddress(params.token)) return 18

  return 18
}
