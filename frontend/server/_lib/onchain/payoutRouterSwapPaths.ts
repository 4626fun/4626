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
  label: 'WETH' | 'ZORA' | 'USDC'
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
  shareOft: Address
}): Promise<PayoutRouterSwapPathPlan[]> {
  const contracts = getApiContracts()
  const weth = getAddress(contracts.weth)
  const usdc = getAddress(contracts.usdc)
  const shareOft = getAddress(params.shareOft)
  const factory = getAddress(contracts.uniswapV3Factory)
  const { zoraWethFee, wethShareFee } = resolvePayoutRouterFeeConfig()
  const zoraToken = resolvePayoutRouterZoraToken(getAddress(contracts.zora))

  const out: PayoutRouterSwapPathPlan[] = []

  const usdcShareFee = !sameAddress(usdc, shareOft)
    ? await resolveV3Fee(params.publicClient, factory, usdc, shareOft, DEFAULT_ROUTE_FALLBACK_FEE)
    : null

  if (!sameAddress(weth, shareOft)) {
    const directWethShareFee = await resolveV3Fee(params.publicClient, factory, weth, shareOft, wethShareFee)
    if (directWethShareFee !== null) {
      out.push({
        tokenIn: weth,
        path: encodeUniswapV3Path([weth, shareOft], [directWethShareFee]),
        label: 'WETH',
      })
    } else {
      const wethUsdcFee = await resolveV3Fee(params.publicClient, factory, weth, usdc, DEFAULT_ROUTE_FALLBACK_FEE)
      if (wethUsdcFee !== null && usdcShareFee !== null) {
        out.push({
          tokenIn: weth,
          path: encodeUniswapV3Path([weth, usdc, shareOft], [wethUsdcFee, usdcShareFee]),
          label: 'WETH',
        })
      }
    }
  }

  if (
    zoraToken &&
    !sameAddress(zoraToken, shareOft) &&
    !sameAddress(zoraToken, weth) &&
    !sameAddress(zoraToken, usdc)
  ) {
    const directZoraShareFee = await resolveV3Fee(
      params.publicClient,
      factory,
      zoraToken,
      shareOft,
      DEFAULT_ROUTE_FALLBACK_FEE,
    )
    if (directZoraShareFee !== null) {
      out.push({
        tokenIn: zoraToken,
        path: encodeUniswapV3Path([zoraToken, shareOft], [directZoraShareFee]),
        label: 'ZORA',
      })
    } else {
      const zoraWethResolvedFee = await resolveV3Fee(params.publicClient, factory, zoraToken, weth, zoraWethFee)
      const wethShareResolvedFee = await resolveV3Fee(params.publicClient, factory, weth, shareOft, wethShareFee)
      if (zoraWethResolvedFee !== null && wethShareResolvedFee !== null) {
        out.push({
          tokenIn: zoraToken,
          path: encodeUniswapV3Path([zoraToken, weth, shareOft], [zoraWethResolvedFee, wethShareResolvedFee]),
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
        if (zoraUsdcFee !== null && usdcShareFee !== null) {
          out.push({
            tokenIn: zoraToken,
            path: encodeUniswapV3Path([zoraToken, usdc, shareOft], [zoraUsdcFee, usdcShareFee]),
            label: 'ZORA',
          })
        }
      }
    }
  }

  if (
    !sameAddress(usdc, shareOft) &&
    !sameAddress(usdc, weth) &&
    usdcShareFee !== null
  ) {
    out.push({
      tokenIn: usdc,
      path: encodeUniswapV3Path([usdc, shareOft], [usdcShareFee]),
      label: 'USDC',
    })
  }

  return out
}
