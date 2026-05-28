import { getAddress, isAddress, type Address, type Hex } from 'viem'

import { getApiContracts } from './contracts.js'
import { encodeUniswapV3Path } from './uniswapV3Path.js'
import { resolvePayoutRouterFeeConfig, resolvePayoutRouterZoraToken } from './payoutRouterRuntime.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address
const DEFAULT_ROUTE_FALLBACK_FEE = 3_000

const UNISWAP_V3_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const

export type PayoutRouterSwapPathPlan = {
  tokenIn: Address
  path: Hex
  label: 'WETH' | 'ZORA'
}

type PublicClientReader = {
  readContract: (args: {
    address: Address
    abi: typeof UNISWAP_V3_FACTORY_ABI
    functionName: 'getPool'
    args: [Address, Address, number]
  }) => Promise<unknown>
}

function sameAddress(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function candidateV3Fees(preferredFee: number): number[] {
  const common = [preferredFee, DEFAULT_ROUTE_FALLBACK_FEE, 500, 3_000, 10_000, 100]
  const out: number[] = []
  for (const fee of common) {
    if (!Number.isInteger(fee) || fee <= 0 || fee > 1_000_000) continue
    if (!out.includes(fee)) out.push(fee)
  }
  return out
}

async function hasV3Pool(
  publicClient: PublicClientReader,
  factory: Address,
  tokenA: Address,
  tokenB: Address,
  fee: number,
): Promise<boolean> {
  if (sameAddress(tokenA, tokenB)) return false
  try {
    const pool = await publicClient.readContract({
      address: factory,
      abi: UNISWAP_V3_FACTORY_ABI,
      functionName: 'getPool',
      args: [tokenA, tokenB, fee],
    })
    return typeof pool === 'string' && isAddress(pool) && !sameAddress(pool as Address, ZERO_ADDRESS)
  } catch {
    return false
  }
}

async function resolveV3Fee(
  publicClient: PublicClientReader,
  factory: Address,
  tokenA: Address,
  tokenB: Address,
  preferredFee: number,
): Promise<number | null> {
  for (const fee of candidateV3Fees(preferredFee)) {
    if (await hasV3Pool(publicClient, factory, tokenA, tokenB, fee)) return fee
  }
  return null
}

export async function resolvePayoutRouterSwapPaths(params: {
  publicClient: PublicClientReader
  creatorToken: Address
}): Promise<PayoutRouterSwapPathPlan[]> {
  const contracts = getApiContracts()
  const weth = getAddress(contracts.weth)
  const usdc = getAddress(contracts.usdc)
  const creatorToken = getAddress(params.creatorToken)
  const factory = getAddress(contracts.uniswapV3Factory)
  const { zoraWethFee, wethCreatorFee } = resolvePayoutRouterFeeConfig()
  const zoraToken = resolvePayoutRouterZoraToken(getAddress(contracts.zora))

  const out: PayoutRouterSwapPathPlan[] = []

  const usdcCreatorFee = !sameAddress(usdc, creatorToken)
    ? await resolveV3Fee(params.publicClient, factory, usdc, creatorToken, DEFAULT_ROUTE_FALLBACK_FEE)
    : null

  if (!sameAddress(weth, creatorToken)) {
    const directWethCreatorFee = await resolveV3Fee(params.publicClient, factory, weth, creatorToken, wethCreatorFee)
    if (directWethCreatorFee !== null) {
      out.push({
        tokenIn: weth,
        path: encodeUniswapV3Path([weth, creatorToken], [directWethCreatorFee]),
        label: 'WETH',
      })
    } else {
      const wethUsdcFee = await resolveV3Fee(params.publicClient, factory, weth, usdc, DEFAULT_ROUTE_FALLBACK_FEE)
      if (wethUsdcFee !== null && usdcCreatorFee !== null) {
        out.push({
          tokenIn: weth,
          path: encodeUniswapV3Path([weth, usdc, creatorToken], [wethUsdcFee, usdcCreatorFee]),
          label: 'WETH',
        })
      }
    }
  }

  if (
    zoraToken &&
    !sameAddress(zoraToken, creatorToken) &&
    !sameAddress(zoraToken, weth) &&
    !sameAddress(zoraToken, usdc)
  ) {
    const directZoraCreatorFee = await resolveV3Fee(
      params.publicClient,
      factory,
      zoraToken,
      creatorToken,
      DEFAULT_ROUTE_FALLBACK_FEE,
    )
    if (directZoraCreatorFee !== null) {
      out.push({
        tokenIn: zoraToken,
        path: encodeUniswapV3Path([zoraToken, creatorToken], [directZoraCreatorFee]),
        label: 'ZORA',
      })
    } else {
      const zoraWethResolvedFee = await resolveV3Fee(params.publicClient, factory, zoraToken, weth, zoraWethFee)
      const wethCreatorResolvedFee = await resolveV3Fee(params.publicClient, factory, weth, creatorToken, wethCreatorFee)
      if (zoraWethResolvedFee !== null && wethCreatorResolvedFee !== null) {
        out.push({
          tokenIn: zoraToken,
          path: encodeUniswapV3Path([zoraToken, weth, creatorToken], [zoraWethResolvedFee, wethCreatorResolvedFee]),
          label: 'ZORA',
        })
      } else {
        const zoraUsdcFee = await resolveV3Fee(
          params.publicClient,
          factory,
          zoraToken,
          usdc,
          DEFAULT_ROUTE_FALLBACK_FEE,
        )
        if (zoraUsdcFee !== null && usdcCreatorFee !== null) {
          out.push({
            tokenIn: zoraToken,
            path: encodeUniswapV3Path([zoraToken, usdc, creatorToken], [zoraUsdcFee, usdcCreatorFee]),
            label: 'ZORA',
          })
        }
      }
    }
  }

  return out
}
