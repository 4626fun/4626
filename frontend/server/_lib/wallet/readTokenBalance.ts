import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
  type Address,
} from 'viem'
import { base } from 'viem/chains'

import { resolveServerBaseRpcUrls } from '../onchain/baseRpcUrl.js'

export const NATIVE_TOKEN_BALANCE_ADDRESS = '0x0000000000000000000000000000000000000000'

export type TokenBalanceResult = {
  raw: string
  decimals: number
  formatted: string
}

export async function readTokenBalance(params: {
  ownerAddress: Address
  tokenAddress: string
}): Promise<TokenBalanceResult> {
  const owner = getAddress(params.ownerAddress)
  const tokenLower = params.tokenAddress.trim().toLowerCase()
  const urls = resolveServerBaseRpcUrls()
  let lastError: unknown = null

  for (const url of urls) {
    try {
      const client = createPublicClient({ chain: base, transport: http(url) })
      if (tokenLower === NATIVE_TOKEN_BALANCE_ADDRESS) {
        const value = await client.getBalance({ address: owner, blockTag: 'latest' })
        return { raw: value.toString(), decimals: 18, formatted: formatUnits(value, 18) }
      }
      if (!isAddress(params.tokenAddress)) {
        throw new Error('invalid_token_address')
      }
      const token = getAddress(params.tokenAddress)
      const [value, decimals] = await Promise.all([
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [owner],
        }),
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ])
      const decimalCount = Number(decimals)
      return {
        raw: value.toString(),
        decimals: decimalCount,
        formatted: formatUnits(value, decimalCount),
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('token_balance_read_failed')
}
