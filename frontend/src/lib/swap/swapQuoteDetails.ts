import { formatUnits, getAddress, isAddress } from 'viem'

import { parsePositiveHumanAmount, formatSwapUsd } from '@/lib/swap/swapAmountUsd'
import { formatSwapDisplayAmount, parseSwapDisplayNumber } from '@/lib/swap/swapDisplayAmount'
import { isZoraProviderQuote } from '@/lib/zora/zoraTradeApi'
import { pickQuote, type TradeQuoteResponse } from '@/lib/uniswap/tradingApi'

const ROUTING_ENUM = new Set([
  'CLASSIC',
  'WRAP',
  'UNWRAP',
  'BRIDGE',
  'DUTCH_LIMIT',
  'DUTCH_V2',
  'DUTCH_V3',
  'LIMIT_ORDER',
  'PRIORITY',
])

export type SwapRouteLeg = {
  protocol: 'v2' | 'v3' | 'v4' | 'unknown'
  protocolLabel: string
  tokenIn: string
  tokenOut: string
  tokenInAddress?: `0x${string}` | null
  tokenOutAddress?: `0x${string}` | null
  feePercentLabel: string | null
  poolAddress: string | null
}

export type ParsedSwapRoute = {
  tokenPath: string[]
  legs: SwapRouteLeg[]
  summary: string | null
}

export type SwapQuoteAggregatorLabel = 'Uniswap' | 'CDP' | 'Zora'

export type SwapQuoteDetails = {
  routeSummary: string | null
  routeLegs: SwapRouteLeg[]
  aggregatorLabel: SwapQuoteAggregatorLabel
  gasEstimateLabel: string | null
  priceImpactLabel: string | null
  lpFeeUsd: string | null
  protocolFeeUsd: string | null
}

function readClassicQuote(quote: TradeQuoteResponse | null | undefined): Record<string, unknown> | null {
  if (!quote) return null
  const picked = pickQuote(quote)
  return picked && typeof picked === 'object' ? picked : null
}

function isRoutingEnum(value: string): boolean {
  return ROUTING_ENUM.has(value.trim().toUpperCase())
}

function readTokenSymbol(token: unknown): string | null {
  if (!token || typeof token !== 'object') return null
  const sym = (token as { symbol?: string }).symbol
  return typeof sym === 'string' && sym.trim() ? sym.trim() : null
}

function readTokenAddress(token: unknown): `0x${string}` | null {
  if (!token || typeof token !== 'object') return null
  const address = (token as { address?: string }).address
  if (typeof address !== 'string' || !address.trim() || !isAddress(address.trim())) return null
  return getAddress(address.trim())
}

function readPoolProtocol(pool: Record<string, unknown>): SwapRouteLeg['protocol'] {
  const type = String(pool.type ?? '').toLowerCase()
  if (type.includes('v4')) return 'v4'
  if (type.includes('v3')) return 'v3'
  if (type.includes('v2')) return 'v2'
  return 'unknown'
}

function protocolLabel(protocol: SwapRouteLeg['protocol']): string {
  switch (protocol) {
    case 'v4':
      return 'Uniswap V4'
    case 'v3':
      return 'Uniswap V3'
    case 'v2':
      return 'Uniswap V2'
    default:
      return 'Uniswap'
  }
}

/** Uniswap V2/V3/V4 pool fee tiers are encoded in hundredths of a bip (3000 = 0.3%). */
export function formatUniswapPoolFeePercent(fee: unknown): string | null {
  const n = typeof fee === 'number' ? fee : Number(String(fee ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  const pct = n / 10_000
  if (pct >= 1) return `${pct.toFixed(2)}%`
  if (pct >= 0.01) return `${pct.toFixed(2)}%`
  return `${pct.toFixed(3)}%`
}

function pushTokenPath(path: string[], symbol: string | null) {
  if (!symbol) return
  if (path[path.length - 1]?.toLowerCase() === symbol.toLowerCase()) return
  path.push(symbol)
}

export function parseSwapRouteFromClassicQuote(classic: Record<string, unknown> | null | undefined): ParsedSwapRoute {
  const tokenPath: string[] = []
  const legs: SwapRouteLeg[] = []
  if (!classic || typeof classic !== 'object') {
    return { tokenPath, legs, summary: null }
  }

  const route = classic.route
  if (Array.isArray(route)) {
    for (const hop of route) {
      if (!Array.isArray(hop)) continue
      for (const poolRaw of hop) {
        if (!poolRaw || typeof poolRaw !== 'object') continue
        const pool = poolRaw as Record<string, unknown>
        const tokenIn = readTokenSymbol(pool.tokenIn)
        const tokenOut = readTokenSymbol(pool.tokenOut)
        if (tokenPath.length === 0) pushTokenPath(tokenPath, tokenIn)
        pushTokenPath(tokenPath, tokenOut)

        const protocol = readPoolProtocol(pool)
        const feePercentLabel =
          formatUniswapPoolFeePercent(pool.fee) ??
          (protocol === 'v2' ? '0.30%' : null)

        legs.push({
          protocol,
          protocolLabel: protocolLabel(protocol),
          tokenIn: tokenIn ?? '?',
          tokenOut: tokenOut ?? '?',
          tokenInAddress: readTokenAddress(pool.tokenIn),
          tokenOutAddress: readTokenAddress(pool.tokenOut),
          feePercentLabel,
          poolAddress:
            typeof pool.address === 'string' && pool.address.trim() ? pool.address.trim() : null,
        })
      }
    }
  }

  const routeString = classic.routeString
  if (typeof routeString === 'string' && routeString.trim() && !isRoutingEnum(routeString)) {
    return {
      tokenPath,
      legs,
      summary: routeString.trim(),
    }
  }

  if (tokenPath.length >= 2) {
    return {
      tokenPath,
      legs,
      summary: tokenPath.join(' → '),
    }
  }

  return { tokenPath, legs, summary: null }
}

export function extractSwapRouteSummary(quote: TradeQuoteResponse | null | undefined): string | null {
  if (!quote) return null
  if (isZoraProviderQuote(quote)) return 'Zora Universal Router'

  const classic = readClassicQuote(quote)
  return parseSwapRouteFromClassicQuote(classic).summary
}

export function extractSwapRouteLegs(quote: TradeQuoteResponse | null | undefined): SwapRouteLeg[] {
  if (!quote || isZoraProviderQuote(quote)) return []
  return parseSwapRouteFromClassicQuote(readClassicQuote(quote)).legs
}

export function resolveQuoteAggregatorLabel(quote: TradeQuoteResponse | null | undefined): SwapQuoteAggregatorLabel {
  const provider = String((quote as { provider?: unknown; _provider?: unknown } | null)?.provider ?? (quote as any)?._provider ?? '')
    .trim()
    .toLowerCase()
  if (provider === 'zora') return 'Zora'
  if (provider === 'cdp') return 'CDP'
  return 'Uniswap'
}

/** Uniswap Trading API `priceImpact` is already a percent (0–100); e.g. 0.04 = 0.04%, 4 = 4%. */
export function normalizePriceImpactPercent(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(String(value).replace('%', '').trim())
  if (!Number.isFinite(n)) return null

  if (Math.abs(n) >= 50) return null
  return n
}

export function formatSwapPriceImpactLabel(value: unknown): string | null {
  const n = normalizePriceImpactPercent(value)
  if (n == null) return null
  if (Math.abs(n) < 0.000_05) return '<0.01%'
  return `${n.toFixed(2)}%`
}

function parsePositiveNumber(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, '').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/** Uniswap `gasFeeUSD` is already denominated in USDC; `gasFee` is wei on EVM chains. */
export function formatQuoteGasEstimateLabel(params: {
  quote: TradeQuoteResponse | null | undefined
  ethUsd: number
  /** Parent-CSW paymaster swaps — user does not pay network gas out of pocket. */
  sponsoredExecution?: boolean
}): string | null {
  if (params.sponsoredExecution) {
    return 'Sponsored'
  }

  const classic = readClassicQuote(params.quote)
  const usdSources = [
    classic?.gasFeeUSD,
    classic?.gasEstimateUSD,
    (params.quote as { gasFeeUSD?: unknown } | null)?.gasFeeUSD,
    (params.quote as { gasEstimateUSD?: unknown } | null)?.gasEstimateUSD,
  ]

  for (const raw of usdSources) {
    const n = parsePositiveNumber(raw)
    if (n == null) continue
    return formatSwapUsd(n)
  }

  const gasFeeRaw = classic?.gasFee ?? (params.quote as { gasFee?: unknown } | null)?.gasFee
  if (gasFeeRaw != null && params.ethUsd > 0) {
    const gasFeeStr = String(gasFeeRaw).trim()
    if (/^\d+$/.test(gasFeeStr)) {
      try {
        const eth = Number(formatUnits(BigInt(gasFeeStr), 18))
        if (Number.isFinite(eth) && eth > 0) {
          return formatSwapUsd(eth * params.ethUsd)
        }
      } catch {
        // fall through to human-readable parse
      }
    }
    const gasFeeEth = parsePositiveNumber(gasFeeRaw)
    if (gasFeeEth != null && gasFeeEth > 0 && gasFeeEth < 1) {
      return formatSwapUsd(gasFeeEth * params.ethUsd)
    }
  }

  return null
}

function formatPortionFeeUsd(params: {
  portionAmount: unknown
  tokenDecimals: number
  tokenUsd: number | null
}): string | null {
  const raw = String(params.portionAmount ?? '').trim()
  if (!/^\d+$/.test(raw)) return null
  try {
    const human = Number(formatUnits(BigInt(raw), params.tokenDecimals))
    if (!Number.isFinite(human) || human <= 0) return null
    if (params.tokenUsd != null && params.tokenUsd > 0) {
      return formatSwapUsd(human * params.tokenUsd)
    }
    return null
  } catch {
    return null
  }
}

/** Uniswap-style "1 USDC = 95840.4 akita" execution rate from quoted amounts. */
export function formatSwapExchangeRate(params: {
  amountIn: string
  tokenInSymbol: string
  amountOut: string
  tokenOutSymbol: string
}): string | null {
  const inSym = String(params.tokenInSymbol ?? '').trim()
  const outSym = String(params.tokenOutSymbol ?? '').trim()
  if (!inSym || !outSym) return null

  const inAmt = parsePositiveHumanAmount(params.amountIn) ?? parseSwapDisplayNumber(params.amountIn)
  const outAmt = parsePositiveHumanAmount(params.amountOut) ?? parseSwapDisplayNumber(params.amountOut)
  if (inAmt == null || outAmt == null || inAmt <= 0 || outAmt <= 0) return null

  const rate = outAmt / inAmt
  if (!Number.isFinite(rate) || rate <= 0) return null

  const formattedRate = formatSwapDisplayAmount(String(rate), outSym)
  return `1 ${inSym} = ${formattedRate} ${outSym}`
}

export function summarizeRouteProtocols(legs: SwapRouteLeg[]): string | null {
  if (legs.length === 0) return null
  const protocols = new Set(legs.map((leg) => leg.protocol).filter((p) => p !== 'unknown'))
  const labels: string[] = []
  if (protocols.has('v2')) labels.push('V2')
  if (protocols.has('v3')) labels.push('V3')
  if (protocols.has('v4')) labels.push('V4')
  if (labels.length === 0) return null
  return `${labels.join(' + ')} 100%`
}

export type SwapNetworkCostDisplay = {
  primary: string
  sponsoredFree: boolean
}

/** Network cost row — sponsored canonical swaps: user pays $0 (paymaster covers gas). */
export function formatSwapNetworkCostDisplay(params: {
  gasEstimateLabel: string | null
  sponsoredExecution?: boolean
}): SwapNetworkCostDisplay | null {
  if (params.sponsoredExecution || params.gasEstimateLabel === 'Sponsored') {
    return { primary: 'Free', sponsoredFree: true }
  }
  if (params.gasEstimateLabel) {
    return { primary: params.gasEstimateLabel, sponsoredFree: false }
  }
  return null
}

export function extractSwapQuoteDetails(params: {
  quote: TradeQuoteResponse | null | undefined
  ethUsd: number
  tokenOutDecimals?: number
  tokenOutUsd?: number | null
  sponsoredExecution?: boolean
}): SwapQuoteDetails {
  const classic = readClassicQuote(params.quote)

  const priceImpactCandidate =
    classic?.priceImpact ??
    classic?.priceImpactPercent ??
    (params.quote as { priceImpact?: unknown; priceImpactPercent?: unknown } | null)?.priceImpact ??
    (params.quote as { priceImpactPercent?: unknown } | null)?.priceImpactPercent

  const parsedRoute = parseSwapRouteFromClassicQuote(classic)

  const protocolFeeUsd = formatPortionFeeUsd({
    portionAmount: classic?.portionAmount,
    tokenDecimals: params.tokenOutDecimals ?? 18,
    tokenUsd: params.tokenOutUsd ?? null,
  })

  return {
    routeSummary: extractSwapRouteSummary(params.quote),
    routeLegs: parsedRoute.legs.length > 0 ? parsedRoute.legs : extractSwapRouteLegs(params.quote),
    aggregatorLabel: resolveQuoteAggregatorLabel(params.quote),
    gasEstimateLabel: formatQuoteGasEstimateLabel({
      quote: params.quote,
      ethUsd: params.ethUsd,
      sponsoredExecution: params.sponsoredExecution,
    }),
    priceImpactLabel: formatSwapPriceImpactLabel(priceImpactCandidate),
    lpFeeUsd: null,
    protocolFeeUsd,
  }
}
