import { base } from 'viem/chains'

import type { FriendKeyFundingLane } from '@/lib/alfaclub/friendKeyFundingLane'
import {
  fetchZoraTradeQuoteFromApi,
  readZoraQuoteAmountOut,
} from '@/lib/zora/zoraTradeApi'
import { fetchTradeQuote, type TradeQuoteRequest } from '@/lib/uniswap/tradingApi'
import { getNestedAmountOut } from '@/lib/uniswap/swapUtils'

/**
 * Quote ETH → Sudoswap pair ERC-20 for FriendKey funding.
 * Creator-coin lane uses Zora; ShareOFT lane uses Uniswap.
 */
export async function fetchEthToPairErc20AmountOut(params: {
  lane: FriendKeyFundingLane
  amountInWei: bigint
  sender: string
  slippagePct: number
}): Promise<bigint> {
  const amountIn = params.amountInWei
  if (amountIn <= 0n) throw new Error('eth_amount_invalid')

  const provider = params.lane.ethFundingProvider
  switch (provider) {
    case 'zora': {
      const payload = await fetchZoraTradeQuoteFromApi({
        tokenIn: params.lane.ethTokenIn,
        tokenOut: params.lane.pairErc20,
        amountIn: amountIn.toString(),
        sender: params.sender,
        slippagePct: params.slippagePct,
        allowAmountOutOnly: true,
      })
      const out = readZoraQuoteAmountOut(payload)
      if (out <= 0n) {
        throw new Error('Zora returned no pair-ERC20 output for the ETH funding quote')
      }
      return out
    }
    case 'uniswap': {
      const body: TradeQuoteRequest = {
        type: 'EXACT_INPUT',
        amount: amountIn.toString(),
        tokenInChainId: base.id,
        tokenOutChainId: base.id,
        tokenIn: params.lane.ethTokenIn,
        tokenOut: params.lane.pairErc20,
        swapper: params.sender,
        slippageTolerance: params.slippagePct,
        providerOverride: 'uniswap',
      }
      const quote = await fetchTradeQuote(body)
      const raw = getNestedAmountOut(quote)
      let out = 0n
      try {
        out = BigInt(String(raw ?? '0'))
      } catch {
        out = 0n
      }
      if (out <= 0n) {
        throw new Error('Uniswap returned no ShareOFT output for the ETH funding quote')
      }
      return out
    }
    default: {
      const _exhaustive: never = provider
      throw new Error(`unsupported_eth_funding_provider:${String(_exhaustive)}`)
    }
  }
}
