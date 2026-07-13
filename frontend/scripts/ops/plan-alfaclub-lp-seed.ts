#!/usr/bin/env tsx

import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
} from 'viem'
import { base } from 'viem/chains'

import { buildAlfaClubSeedCandidate } from '../../src/lib/alfaclub/lpSeedMath.js'

const FRIEND_KEY = getAddress('0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F')
const DEFAULT_CREATOR_COIN = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const DEFAULT_TOKEN_ID = 1659n
const DEFAULT_KEY_AMOUNT = 10n
const TRADING_FEE_BPS = 690n

const FRIEND_KEY_ABI = parseAbi([
  'function creatorByTokenId(uint256 tokenId) view returns (address)',
  'function roomTypes(uint256 tokenId) view returns (uint8)',
  'function roomTiers(uint256 tokenId) view returns (uint8)',
  'function totalSupply(uint256 tokenId) view returns (uint256)',
  'function bondingToken() view returns (address)',
  'function getBuyPriceAfterFee(uint256 tokenId, uint256 amount) view returns (uint256)',
  'function getSellPriceAfterFee(uint256 tokenId, uint256 amount) view returns (uint256)',
])
const ERC20_METADATA_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])

function readArg(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null
}

function parsePositiveBigInt(value: string | null, fallback: bigint): bigint {
  if (value === null) return fallback
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) throw new Error(`invalid_${value}`)
  return BigInt(value)
}

function readCreatorCoin(): Address {
  const raw = readArg('creator-coin')
  if (raw === null) return DEFAULT_CREATOR_COIN
  if (!isAddress(raw)) throw new Error('invalid_creator_coin')
  return getAddress(raw)
}

async function main(): Promise<void> {
  const rpcUrl = readArg('rpc-url') ?? process.env.BASE_RPC_URL ?? 'https://base-rpc.publicnode.com'
  const creatorPrice = readArg('creator-price')
  if (!creatorPrice) {
    throw new Error(
      'missing_creator_price: pass --creator-price=<bonding-token units per Creator Coin>',
    )
  }

  const tokenId = parsePositiveBigInt(readArg('token-id'), DEFAULT_TOKEN_ID)
  const keyAmount = parsePositiveBigInt(readArg('keys'), DEFAULT_KEY_AMOUNT)
  const creatorCoin = readCreatorCoin()
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const [
    creator,
    roomType,
    roomTier,
    totalSupply,
    bondingToken,
    primaryBuy,
    primarySell,
    coinName,
    coinSymbol,
    coinDecimals,
  ] = await Promise.all([
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'creatorByTokenId',
      args: [tokenId],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'roomTypes',
      args: [tokenId],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'roomTiers',
      args: [tokenId],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'totalSupply',
      args: [tokenId],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'bondingToken',
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'getBuyPriceAfterFee',
      args: [tokenId, 1n],
    }),
    client.readContract({
      address: FRIEND_KEY,
      abi: FRIEND_KEY_ABI,
      functionName: 'getSellPriceAfterFee',
      args: [tokenId, 1n],
    }),
    client.readContract({ address: creatorCoin, abi: ERC20_METADATA_ABI, functionName: 'name' }),
    client.readContract({ address: creatorCoin, abi: ERC20_METADATA_ABI, functionName: 'symbol' }),
    client.readContract({
      address: creatorCoin,
      abi: ERC20_METADATA_ABI,
      functionName: 'decimals',
    }),
  ])

  if (roomType !== 0) throw new Error(`unsupported_room_type_${roomType}`)
  const bondingDecimals = 6
  const creatorCoinPriceDecimals = 18
  const creatorCoinPriceBondingToken = parseUnits(creatorPrice, creatorCoinPriceDecimals)
  const candidate = buildAlfaClubSeedCandidate({
    primaryBuyBondingToken: primaryBuy,
    primarySellBondingToken: primarySell,
    creatorCoinPriceBondingToken,
    bondingTokenScale: 10n ** BigInt(bondingDecimals),
    creatorCoinPriceScale: 10n ** BigInt(creatorCoinPriceDecimals),
    creatorCoinDecimals: coinDecimals,
    keyAmount,
    feeBps: TRADING_FEE_BPS,
  })

  console.log(
    JSON.stringify(
      {
        chainId: base.id,
        friendKey: FRIEND_KEY,
        tokenId: tokenId.toString(),
        roomCreator: creator,
        roomType,
        roomTier,
        totalSupply: totalSupply.toString(),
        bondingToken,
        creatorCoin: {
          address: creatorCoin,
          name: coinName,
          symbol: coinSymbol,
          decimals: coinDecimals,
          priceInBondingToken: creatorPrice,
        },
        primary: {
          buyOne: formatUnits(primaryBuy, bondingDecimals),
          sellOne: formatUnits(primarySell, bondingDecimals),
          midpoint: formatUnits(candidate.primaryMidBondingToken, bondingDecimals),
        },
        seed: {
          keys: candidate.keyAmount.toString(),
          creatorCoinAmount: formatUnits(candidate.creatorCoinAmount, coinDecimals),
          creatorCoinPerKey: formatUnits(candidate.creatorCoinPerKey, coinDecimals),
          lpBuyOne: formatUnits(candidate.oneKeyBuy, coinDecimals),
          lpSellOne: formatUnits(candidate.oneKeySell, coinDecimals),
          lpBuyImpactBps: candidate.oneKeyBuyImpactBps.toString(),
          lpSellImpactBps: candidate.oneKeySellImpactBps.toString(),
          minimumKeyReserve: '2',
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
