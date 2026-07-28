#!/usr/bin/env tsx
/**
 * Compute CreatorOracle initializeAssetPrice seed from the Zora V4 market floor.
 *
 * Defaults to dry-run (prints values only). Does not broadcast.
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/seed-oracle-from-market-floor.ts \
 *     --creator 0x5b674196812451B7cEC024FE9d22D2c0b172fa75
 */
import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  computeMarketFloorQuote,
  creatorUsdPrice1e18FromEthFloor,
} from '../../src/lib/cca/marketFloor.js'
import { impliedFdvEthFromWeiPerToken } from '../../src/lib/cca/oracleLaunchPreflight.js'

function getArg(name: string): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return ''
  return v
}

async function main() {
  const creatorRaw = getArg('--creator')
  if (!isAddress(creatorRaw)) {
    throw new Error('Pass --creator <0x…> (Zora creator / agent coin)')
  }
  const creatorCoin = creatorRaw as Address
  const rpc = process.env.BASE_RPC_URL
  if (!rpc) throw new Error('BASE_RPC_URL missing')

  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
  const quote = await computeMarketFloorQuote({ publicClient, creatorCoin })

  const ethUsdRaw = await publicClient.readContract({
    address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    abi: [
      {
        type: 'function',
        name: 'latestRoundData',
        stateMutability: 'view',
        inputs: [],
        outputs: [
          { type: 'uint80' },
          { type: 'int256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint80' },
        ],
      },
    ],
    functionName: 'latestRoundData',
  })
  const ethUsd1e18 = BigInt(ethUsdRaw[1]) * 10n ** 10n
  const creatorUsd1e18 = creatorUsdPrice1e18FromEthFloor({
    weiPerToken: quote.weiPerToken,
    ethUsdPrice1e18: ethUsd1e18,
  })

  const out = {
    mode: 'DRY_RUN',
    creatorCoin,
    weiPerToken: quote.weiPerToken.toString(),
    ethPerToken: formatEther(quote.weiPerToken),
    initializeAssetPriceUsd1e18: creatorUsd1e18.toString(),
    usdPerToken: formatUnits(creatorUsd1e18, 18),
    impliedFdvEth1b: impliedFdvEthFromWeiPerToken({ weiPerToken: quote.weiPerToken }),
    v4PoolLiquidity: quote.creatorZora.liquidity.toString(),
    note:
      'Call CreatorOracle.initializeAssetPrice(initializeAssetPriceUsd1e18) as owner once. ' +
      'Do NOT point setV3Pool at a dust CREATOR/USDC pool (liquidity < 1e12). Prefer V4 market floor seed. ' +
      'requiredRaise (default 0.1 ETH) is graduation minimum only — not FDV.',
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
