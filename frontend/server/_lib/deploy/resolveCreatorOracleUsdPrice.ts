import type { Address } from 'viem'

import {
  creatorUsdPrice1e18FromEthFloor,
  resolveCreatorUsdPrice1e18FromMarketFloor,
  type ReadonlyPublicClient,
} from '../../../src/lib/cca/marketFloor.js'

export { creatorUsdPrice1e18FromEthFloor }

export type ResolvedCreatorOracleUsdPrice =
  | {
      ok: true
      price1e18: bigint
      source: 'market_floor'
      weiPerToken: bigint
    }
  | {
      ok: false
      reason: string
    }

/**
 * Same pricing lane as Deploy UI `marketFloorQuery` / CCA floor derivation:
 * CREATOR/ZORA v4 TWAP + conservative ZORA→ETH, converted to creator USD via oracle ETH/USD.
 */
export async function resolveCreatorOracleUsdPriceForDryRun(params: {
  publicClient: ReadonlyPublicClient
  creatorToken: Address
  ethUsdPrice1e18: bigint
}): Promise<ResolvedCreatorOracleUsdPrice> {
  try {
    const resolved = await resolveCreatorUsdPrice1e18FromMarketFloor({
      publicClient: params.publicClient,
      creatorCoin: params.creatorToken,
      ethUsdPrice1e18: params.ethUsdPrice1e18,
    })
    return {
      ok: true,
      price1e18: resolved.creatorUsdPrice1e18,
      source: 'market_floor',
      weiPerToken: resolved.weiPerToken,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, reason }
  }
}
