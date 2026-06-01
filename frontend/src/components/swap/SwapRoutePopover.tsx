import { Info } from 'lucide-react'

import { TokenAvatar } from '@/components/swap/TokenAvatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/shared/utils'
import { summarizeRouteProtocols, type SwapRouteLeg } from '@/lib/swap/swapQuoteDetails'
import {
  resolveKnownBaseRouteTokenAddress,
  resolveSwapRouteTokenMeta,
  type SwapRouteTokenMeta,
} from '@/lib/swap/swapRouteTokenLookup'
import { tokenLogoFallbacks } from '@/lib/uniswap/swapUtils'

type SwapRoutePopoverProps = {
  routeSummary: string | null
  routeLegs?: SwapRouteLeg[]
  routeTokenLookup?: Record<string, SwapRouteTokenMeta>
  aggregator?: string
  showUniswapBranding?: boolean
}

function RouteHopConnector() {
  return (
    <svg width="20" height="8" viewBox="0 0 20 8" fill="none" aria-hidden className="shrink-0 text-zinc-600">
      <line x1="0" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <path d="M12 2 L16 4 L12 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RouteTokenChip({
  meta,
  feePercent,
}: {
  meta: SwapRouteTokenMeta
  feePercent?: string | null
}) {
  return (
    <span className="relative inline-flex shrink-0 flex-col items-center gap-0.5">
      <TokenAvatar
        symbol={meta.symbol}
        imageUrl={meta.imageUrl}
        token={
          meta.address
            ? {
                address: meta.address,
                logoUrl: meta.imageUrl ?? undefined,
                logoUrls: tokenLogoFallbacks(meta.address),
                group: resolveKnownBaseRouteTokenAddress(meta.symbol) ? 'core' : undefined,
              }
            : undefined
        }
        size={24}
        withFallbackLabel
        className="shrink-0"
      />
      <span className="max-w-[3.25rem] truncate text-[9px] font-medium text-zinc-400">{meta.symbol}</span>
      {feePercent ? (
        <span className="rounded-md border border-white/10 bg-zinc-800/80 px-1 py-px text-[9px] font-medium tabular-nums text-zinc-400">
          {feePercent}
        </span>
      ) : null}
    </span>
  )
}

function routeMetaForSymbol(
  lookup: Record<string, SwapRouteTokenMeta> | undefined,
  symbol: string,
): SwapRouteTokenMeta {
  if (lookup) return resolveSwapRouteTokenMeta(lookup, symbol)
  return resolveSwapRouteTokenMeta({}, symbol)
}

function RouteVisualPath({
  routeSummary,
  routeLegs,
  routeTokenLookup,
}: {
  routeSummary: string | null
  routeLegs: SwapRouteLeg[]
  routeTokenLookup?: Record<string, SwapRouteTokenMeta>
}) {
  const protocolSummary = summarizeRouteProtocols(routeLegs)

  if (routeLegs.length > 0) {
    return (
      <div className="space-y-2">
        {protocolSummary ? (
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
            {protocolSummary}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-1">
          {routeLegs.map((leg, index) => (
            <span key={`${leg.tokenIn}-${leg.tokenOut}-${index}`} className="flex items-end gap-1">
              {index === 0 ? (
                <RouteTokenChip meta={routeMetaForSymbol(routeTokenLookup, leg.tokenIn)} />
              ) : null}
              <RouteHopConnector />
              <RouteTokenChip
                meta={routeMetaForSymbol(routeTokenLookup, leg.tokenOut)}
                feePercent={leg.feePercentLabel}
              />
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (!routeSummary) return null

  const tokens = routeSummary
    .split(/\s*(?:→|->)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (tokens.length === 0) return null

  return (
    <div className="flex flex-wrap items-end gap-1">
      {tokens.map((token, index) => (
        <span key={`${token}-${index}`} className="flex items-end gap-1">
          {index > 0 ? <RouteHopConnector /> : null}
          <RouteTokenChip meta={routeMetaForSymbol(routeTokenLookup, token)} />
        </span>
      ))}
    </div>
  )
}

export function SwapRoutePopover({
  routeSummary,
  routeLegs = [],
  routeTokenLookup,
  aggregator,
  showUniswapBranding = true,
}: SwapRoutePopoverProps) {
  const hasRoute = Boolean(routeSummary) || routeLegs.length > 0
  const aggregatorLabel = aggregator ?? 'Uniswap'
  const routeViaLabel = showUniswapBranding && aggregatorLabel === 'Uniswap' ? 'Uniswap API' : aggregatorLabel

  const popoverContent = (
    <div className="w-[min(20rem,calc(100vw-2rem))] space-y-3 p-0.5 text-left">
      <div className="flex items-center gap-2">
        {showUniswapBranding && aggregatorLabel === 'Uniswap' ? (
          <img src="/protocols/uniswap.svg" alt="" className="h-4 w-4" loading="lazy" aria-hidden />
        ) : null}
        <span className="text-sm font-medium text-zinc-100">Route via {routeViaLabel}</span>
      </div>

      {hasRoute ? (
        <RouteVisualPath
          routeSummary={routeSummary}
          routeLegs={routeLegs}
          routeTokenLookup={routeTokenLookup}
        />
      ) : (
        <p className="text-xs text-zinc-400">Route details appear after a quote is ready.</p>
      )}

      <p className="text-xs leading-relaxed text-zinc-400">
        The Uniswap Auto Router considers the most efficient routes and network costs to provide you with competitive
        prices.
      </p>

      <a
        href="https://docs.uniswap.org/contracts/v4/overview"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs font-medium text-brand-300 hover:text-brand-200"
      >
        Learn more
      </a>
    </div>
  )

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-1 text-vault-subtext">
        Route
        <Tooltip
          content={popoverContent}
          placement="left"
          hasInteractiveContent
          openDelay={0}
          contentClassName="max-w-sm border-vault-borderStrong bg-vault-cardRaised p-3 shadow-2xl"
        >
          <button
            type="button"
            className={cn(
              'inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-500',
              'hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60',
            )}
            aria-label="View swap route details"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </span>
      <span className="inline-flex items-center gap-1.5 text-vault-text">
        {showUniswapBranding && aggregatorLabel === 'Uniswap' ? (
          <img src="/protocols/uniswap.svg" alt="" className="h-3.5 w-auto opacity-90" loading="lazy" aria-hidden />
        ) : null}
        <span className="app-meta-value text-xs sm:text-sm">{routeViaLabel}</span>
      </span>
    </div>
  )
}
