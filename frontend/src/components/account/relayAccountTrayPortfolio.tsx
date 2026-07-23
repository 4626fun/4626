import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import type {
  TrayAssetHolding,
  TrayNetworkHolding,
  TrayTokenHolding,
} from '@/components/account/trayPortfolioHelpers'

function formatUsdValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function formatTokenAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  if (value >= 10_000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (value >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

export function RelayTrayPortfolioModule(props: {
  tab: 'tokens' | 'activity'
  onTabChange: (tab: 'tokens' | 'activity') => void
  aggregateUsd: number
  activeNetworkLabel: string
  rows: TrayNetworkHolding[]
  loading: boolean
  holdings: TrayAssetHolding[]
  holdingsLoading: boolean
  portfolioSourceNote?: string | null
  zoraCreatorTokens: TrayTokenHolding[]
  zoraContentTokens: TrayTokenHolding[]
  zoraTrendTokens: TrayTokenHolding[]
  zoraTokensLoading: boolean
  /** True after the Zora holdings query has finished (success or empty). */
  zoraTokensSettled?: boolean
}) {
  const [networksExpanded, setNetworksExpanded] = useState(false)
  const topRows = props.rows.slice(0, 6)
  const activityRows = props.rows.slice(0, 4)
  const topHoldings = props.holdings
  const hasBalanceWithoutTokens =
    !props.holdingsLoading && topHoldings.length === 0 && props.aggregateUsd > 0.01
  const hasZoraTokens =
    props.zoraCreatorTokens.length > 0 ||
    props.zoraContentTokens.length > 0 ||
    props.zoraTrendTokens.length > 0
  const showZoraEmptyState =
    Boolean(props.zoraTokensSettled) && !props.zoraTokensLoading && !hasZoraTokens

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-2 pb-3">
      <div className="text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">
        {formatUsdValue(props.aggregateUsd)}
      </div>
      <div className="mt-1 text-[10px] text-zinc-500 truncate">{props.activeNetworkLabel}</div>
      {props.portfolioSourceNote ? (
        <div className="mt-1.5 text-[10px] leading-snug text-zinc-500">{props.portfolioSourceNote}</div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-b border-white/8 pb-1">
        {(['tokens', 'activity'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onTabChange(value)}
            className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
              props.tab === value
                ? 'text-white bg-white/[0.08]'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            {value === 'tokens' ? 'Tokens' : 'Activity'}
          </button>
        ))}
      </div>

      {props.tab === 'tokens' ? (
        <div className="mt-3 flex-1">
          <div className="pb-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Holdings</div>
          {props.loading || props.holdingsLoading ? (
            <div className="text-[11px] text-zinc-500">Loading token balances…</div>
          ) : topHoldings.length === 0 ? (
            <div className="text-[11px] text-zinc-500">
              {hasBalanceWithoutTokens
                ? `Portfolio total is ${formatUsdValue(props.aggregateUsd)}, but individual tokens could not be loaded. Try again in a moment.`
                : hasZoraTokens
                  ? 'No other Base token balances. Zora coins are listed below.'
                  : 'No token balances found yet.'}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {topHoldings.map((token) => (
                <RelayTrayHoldingRow key={`holding:${token.tokenKey}`} token={token} />
              ))}
            </div>
          )}

          {topRows.length > 0 ? (
            <div className="mt-4 border-t border-white/8 pt-3">
              <button
                type="button"
                onClick={() => setNetworksExpanded((current) => !current)}
                className="flex w-full items-center justify-between gap-2 py-1 text-left"
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  By network ({topRows.length})
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${networksExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {networksExpanded ? (
                <div className="mt-1 divide-y divide-white/5">
                  {topRows.map((row) => (
                    <div key={row.networkId} className="flex items-center gap-2 py-2">
                      {row.networkLogoUrl ? (
                        <img src={row.networkLogoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full border border-white/10" />
                      ) : (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                          <span className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--brand-primary))]" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-200">{row.networkLabel}</span>
                      <span className="text-[12px] tabular-nums text-zinc-300">{formatUsdValue(row.usdTotal)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasZoraTokens || props.zoraTokensLoading || showZoraEmptyState ? (
            <div className="mt-4 space-y-4 border-t border-white/8 pt-3">
              {props.zoraTokensLoading ? (
                <div className="text-[11px] text-zinc-500">Loading Zora coin holdings…</div>
              ) : showZoraEmptyState ? (
                <div className="text-[11px] text-zinc-500">
                  No Zora creator or content coins found in this wallet’s top holdings.
                </div>
              ) : (
                <>
                  {props.zoraCreatorTokens.length > 0 ? (
                    <div>
                      <div className="pb-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        Zora creator coins
                      </div>
                      <div className="divide-y divide-white/5">
                        {props.zoraCreatorTokens.map((token) => (
                          <RelayTrayHoldingRow
                            key={`zora-creator:${token.tokenKey}`}
                            token={token}
                            subtitle="Creator coin"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {props.zoraTrendTokens.length > 0 ? (
                    <div>
                      <div className="pb-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        Zora trend coins
                      </div>
                      <div className="divide-y divide-white/5">
                        {props.zoraTrendTokens.map((token) => (
                          <RelayTrayHoldingRow
                            key={`zora-trend:${token.tokenKey}`}
                            token={token}
                            subtitle="Trend coin"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {props.zoraContentTokens.length > 0 ? (
                    <div>
                      <div className="pb-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        Zora content coins
                      </div>
                      <div className="divide-y divide-white/5">
                        {props.zoraContentTokens.map((token) => (
                          <RelayTrayHoldingRow
                            key={`zora-content:${token.tokenKey}`}
                            token={token}
                            subtitle="Content coin"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 flex-1 divide-y divide-white/5">
          {activityRows.length === 0 && topHoldings.length === 0 ? (
            <div className="py-2 text-[11px] text-zinc-500">No recent portfolio activity yet.</div>
          ) : (
            <>
              {activityRows.map((row) => (
                <div key={`activity:${row.networkId}`} className="flex items-center justify-between py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-zinc-200">{row.networkLabel}</span>
                    <span className="block text-[10px] text-zinc-600">Network exposure</span>
                  </span>
                  <span className="text-[12px] tabular-nums text-zinc-300">{formatUsdValue(row.usdTotal)}</span>
                </div>
              ))}
              {topHoldings.slice(0, 3).map((token) => (
                <div key={`activity-token:${token.tokenKey}`} className="flex items-center justify-between py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-zinc-200">{token.symbol}</span>
                    <span className="block text-[10px] text-zinc-600">Top holding snapshot</span>
                  </span>
                  <span className="text-[12px] tabular-nums text-zinc-300">{formatUsdValue(token.usdValue)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function RelayTrayHoldingRow(props: { token: TrayAssetHolding; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      {props.token.logoUrl ? (
        <img src={props.token.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/10" />
      ) : (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <span className="h-3 w-3 rounded-sm bg-[rgb(var(--brand-primary))]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white">{props.token.symbol}</span>
        <span className="block truncate text-[11px] text-zinc-500">
          {formatTokenAmount(props.token.amount)}
          {props.subtitle ? ` · ${props.subtitle}` : ''}
        </span>
      </span>
      <span className="text-[13px] font-medium tabular-nums text-zinc-100">{formatUsdValue(props.token.usdValue)}</span>
    </div>
  )
}
