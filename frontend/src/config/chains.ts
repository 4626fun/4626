import { base, mainnet, arbitrum, optimism, polygon } from 'wagmi/chains'
import type { Chain } from 'wagmi/chains'

export type SupportedChainId = 1 | 8453 | 42161 | 10 | 137
const BASE_CHAIN_LOGO = '/base/base-chain-light.svg'

export interface ChainMeta {
  id: SupportedChainId
  name: string
  shortName: string
  chain: Chain
  nativeCurrency: { symbol: string; name: string; decimals: number }
  logoUrl: string
  explorerUrl: string
  weth: `0x${string}`
  usdc: `0x${string}`
  color: string
}

export const SUPPORTED_CHAINS: ChainMeta[] = [
  {
    id: 8453,
    name: 'Base',
    shortName: 'Base',
    chain: base,
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    logoUrl: BASE_CHAIN_LOGO,
    explorerUrl: 'https://basescan.org',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    color: '#1C5CF2',
  },
  {
    id: 1,
    name: 'Ethereum',
    shortName: 'ETH',
    chain: mainnet,
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    explorerUrl: 'https://etherscan.io',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    color: '#627EEA',
  },
  {
    id: 42161,
    name: 'Arbitrum',
    shortName: 'ARB',
    chain: arbitrum,
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    logoUrl: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
    explorerUrl: 'https://arbiscan.io',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    color: '#12AAFF',
  },
  {
    id: 10,
    name: 'Optimism',
    shortName: 'OP',
    chain: optimism,
    nativeCurrency: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    logoUrl: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
    explorerUrl: 'https://optimistic.etherscan.io',
    weth: '0x4200000000000000000000000000000000000006',
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    color: '#FF0420',
  },
  {
    id: 137,
    name: 'Polygon',
    shortName: 'MATIC',
    chain: polygon,
    nativeCurrency: { symbol: 'POL', name: 'POL', decimals: 18 },
    logoUrl: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
    explorerUrl: 'https://polygonscan.com',
    weth: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    color: '#8247E5',
  },
]

export const CHAIN_MAP = new Map(SUPPORTED_CHAINS.map((c) => [c.id, c]))

export function getChainMeta(chainId: number): ChainMeta | undefined {
  return CHAIN_MAP.get(chainId as SupportedChainId)
}

export const DEFAULT_CHAIN_ID: SupportedChainId = 8453
