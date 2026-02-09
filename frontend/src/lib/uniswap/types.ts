/**
 * Uniswap V4 Subgraph Types
 * https://github.com/Uniswap/v4-subgraph
 */

export type UniswapPoolDayData = {
  id: string
  date: number
  pool: { id: string }
  liquidity: string
  sqrtPrice: string
  token0Price: string
  token1Price: string
  tick: number | null
  tvlUSD: string
  volumeToken0: string
  volumeToken1: string
  volumeUSD: string
  feesUSD: string
  txCount: string
  open: string
  high: string
  low: string
  close: string
}

export type UniswapPoolHourData = {
  id: string
  periodStartUnix: number
  pool: { id: string }
  liquidity: string
  sqrtPrice: string
  token0Price: string
  token1Price: string
  tick: number | null
  tvlUSD: string
  volumeToken0: string
  volumeToken1: string
  volumeUSD: string
  feesUSD: string
  txCount: string
  open: string
  high: string
  low: string
  close: string
}

export type UniswapTokenDayData = {
  id: string
  date: number
  token: { id: string; symbol: string; name: string }
  volume: string
  volumeUSD: string
  untrackedVolumeUSD: string
  totalValueLocked: string
  totalValueLockedUSD: string
  priceUSD: string
  feesUSD: string
  open: string
  high: string
  low: string
  close: string
}

export type UniswapPool = {
  id: string
  token0: { id: string; symbol: string; name: string; decimals: string }
  token1: { id: string; symbol: string; name: string; decimals: string }
  feeTier: string
  liquidity: string
  sqrtPrice: string
  token0Price: string
  token1Price: string
  volumeUSD: string
  feesUSD: string
  txCount: string
  totalValueLockedUSD: string
  hooks: string
  createdAtTimestamp: string
}

export type UniswapSwap = {
  id: string
  timestamp: string
  transaction: {
    id: string
    timestamp: string
  }
  token0: { id: string; symbol: string; decimals: string }
  token1: { id: string; symbol: string; decimals: string }
  sender: string
  origin: string
  amount0: string
  amount1: string
  amountUSD: string
}

export type UniswapToken = {
  id: string
  symbol: string
  name: string
  decimals: string
  volume: string
  volumeUSD: string
  feesUSD: string
  txCount: string
  totalValueLocked: string
  totalValueLockedUSD: string
  derivedETH: string
}

export type HistoricalVolumeData = {
  timestamp: number
  volumeUSD: number
  feesUSD: number
  tvlUSD: number
  priceUSD?: number
  open?: number
  high?: number
  low?: number
  close?: number
}

export type TimeframeData = {
  timeframe: '1h' | '1d' | '1w' | '1m' | '1y'
  volumeUSD: number
  feesUSD: number
  tvlUSD: number
  priceChangePercent: number
  dataPoints: HistoricalVolumeData[]
}
