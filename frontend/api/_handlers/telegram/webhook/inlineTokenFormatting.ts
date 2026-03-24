import { getAddress, type Address } from 'viem'

import type { InlineQueryAnswer } from './parsers/inline.js'
import type {
  InlineTokenAnalysisResolution,
  ResolvedInlineTokenAnalysis,
  TokenAnalysisRiskSignals,
  UnresolvedInlineTokenAnalysis,
} from './services/inlineTokenAnalysis.js'

export const TOKEN_ANALYSIS_RESULT_ORDER = [
  'snapshot',
  'catchup',
  'risk',
  'holders',
  'flow',
  'conviction',
  'vault',
] as const

export type TokenAnalysisResultType = (typeof TOKEN_ANALYSIS_RESULT_ORDER)[number] | 'unresolved'

const TOKEN_ANALYSIS_RESULT_DESCRIPTION: Record<(typeof TOKEN_ANALYSIS_RESULT_ORDER)[number], string> = {
  snapshot: 'Overview and key metrics',
  catchup: 'Fast context summary',
  risk: 'Contract and structural risks',
  holders: 'Who owns this token',
  flow: 'Recent activity and momentum',
  conviction: 'Bull vs bear case',
  vault: '4626 / vault relationship',
}

const MOBILE_MAX_LINES = 15
const PROSE_MAX_LENGTH = 120

type InlineArticleResult = Record<string, unknown>

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function checksumOrNull(value: string | null | undefined): Address | null {
  const raw = asTrimmed(value)
  if (!raw) return null
  try {
    return getAddress(raw)
  } catch {
    return null
  }
}

function escapeCodeValue(value: string | null | undefined): string | null {
  const raw = asTrimmed(value)
  if (!raw) return null
  return `<code>${escapeTelegramHtml(raw)}</code>`
}

function formatUsdShort(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  if (absolute >= 100) return `$${Math.round(value)}`
  if (absolute >= 1) return `$${value.toFixed(2).replace(/\.00$/, '')}`
  return `$${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`
}

function formatCountShort(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `${Math.round(value)}`
}

function formatPercent(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const percent = value * 100
  const sign = percent > 0 ? '+' : percent < 0 ? '' : ''
  return `${sign}${percent.toFixed(Math.abs(percent) >= 10 ? 1 : 2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}%`
}

function formatAgeCompact(params: { createdAt: string | null; nowMs: number }): string | null {
  const createdMs = Date.parse(asTrimmed(params.createdAt ?? ''))
  if (!Number.isFinite(createdMs)) return null
  const diffMs = Math.max(0, params.nowMs - createdMs)
  const minuteMs = 60_000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const monthMs = 30 * dayMs
  const yearMs = 365 * dayMs
  if (diffMs >= yearMs) return `${Math.floor(diffMs / yearMs)}y`
  if (diffMs >= monthMs) return `${Math.floor(diffMs / monthMs)}mo`
  if (diffMs >= dayMs) return `${Math.floor(diffMs / dayMs)}d`
  if (diffMs >= hourMs) return `${Math.floor(diffMs / hourMs)}h`
  if (diffMs >= minuteMs) return `${Math.floor(diffMs / minuteMs)}m`
  return 'new'
}

function truncateProse(value: string, maxLength = PROSE_MAX_LENGTH): string {
  const raw = asTrimmed(value)
  if (raw.length <= maxLength) return raw
  const shortened = raw.slice(0, Math.max(0, maxLength - 1)).trimEnd()
  return `${shortened}…`
}

function compactJoin(values: Array<string | null | undefined>): string | null {
  const parts = values.map((value) => asTrimmed(value ?? '')).filter(Boolean)
  return parts.length > 0 ? parts.join(' • ') : null
}

function buildMetricRow(entries: Array<{ label: string; value: string | null }>): string | null {
  const parts = entries
    .map(({ label, value }) => (value ? `${label}: ${value}` : ''))
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' • ') : null
}

function countLines(message: string): number {
  return message.split('\n').length
}

function buildCardMessage(params: {
  lines: Array<string | null | undefined>
  proseLineIndexes?: number[]
  optionalLineIndexes?: number[]
}): string {
  const lines = params.lines.map((line) => (line == null ? '' : String(line)))
  for (const index of params.proseLineIndexes ?? []) {
    if (!lines[index]) continue
    lines[index] = truncateProse(lines[index])
  }
  while (countLines(lines.join('\n')) > MOBILE_MAX_LINES && (params.optionalLineIndexes?.length ?? 0) > 0) {
    const optionalIndex = params.optionalLineIndexes!.pop()
    if (typeof optionalIndex !== 'number') break
    lines[optionalIndex] = ''
  }
  return lines
    .filter((line, index, array) => {
      if (line !== '') return true
      const previous = array[index - 1]
      const next = array[index + 1]
      return Boolean(previous && next)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function shortAddress(value: string | null | undefined): string | null {
  const checksum = checksumOrNull(value)
  if (!checksum) return null
  return `${checksum.slice(0, 6)}…${checksum.slice(-4)}`
}

function checksumCode(value: string | null | undefined): string | null {
  const checksum = checksumOrNull(value)
  return checksum ? `<code>${escapeTelegramHtml(checksum)}</code>` : null
}

function buildResultId(normalizedAddress: `0x${string}`, type: TokenAnalysisResultType): string {
  return `token:${normalizedAddress}:${type}`
}

export function parseTokenAnalysisResultId(resultId: string): {
  address: `0x${string}`
  resultType: TokenAnalysisResultType
  rankPosition: number | null
} | null {
  const match = asTrimmed(resultId).match(
    /^token:(0x[a-f0-9]{40}):(snapshot|catchup|risk|holders|flow|conviction|vault|unresolved)$/i,
  )
  if (!match) return null
  const resultType = match[2].toLowerCase() as TokenAnalysisResultType
  const rankPosition =
    resultType === 'unresolved'
      ? 1
      : TOKEN_ANALYSIS_RESULT_ORDER.findIndex((entry) => entry === resultType) + 1
  return {
    address: match[1].toLowerCase() as `0x${string}`,
    resultType,
    rankPosition: rankPosition > 0 ? rankPosition : null,
  }
}

function tokenHeading(token: ResolvedInlineTokenAnalysis): string {
  const name = asTrimmed(token.name ?? '')
  const symbol = asTrimmed(token.symbol ?? '')
  if (name && symbol && name.toUpperCase() !== symbol.toUpperCase()) {
    return `<b>${escapeTelegramHtml(name)} (${escapeTelegramHtml(symbol)})</b>`
  }
  if (name) return `<b>${escapeTelegramHtml(name)}</b>`
  if (symbol) return `<b>${escapeTelegramHtml(symbol)}</b>`
  return `<b>${escapeTelegramHtml(shortAddress(token.checksumAddress) ?? token.checksumAddress)}</b>`
}

function describeLiquidity(token: ResolvedInlineTokenAnalysis): string {
  const liquidity = token.liquidityUsd ?? 0
  if (liquidity >= 500_000) return 'liquid'
  if (liquidity >= 100_000) return 'tradable'
  if (liquidity > 0) return 'thin'
  return 'inactive'
}

function describeActivity(token: ResolvedInlineTokenAnalysis): string {
  const volume = token.volume24hUsd ?? 0
  const liquidity = token.liquidityUsd ?? 0
  if (volume >= 1_000_000) return 'heavy turnover'
  if (volume >= 100_000) return 'active turnover'
  if (volume > 0 && liquidity > 0 && volume >= liquidity * 0.5) return 'steady turnover'
  if (volume > 0) return 'light turnover'
  return 'quiet flow'
}

function describeHolderBase(token: ResolvedInlineTokenAnalysis): string {
  const holders = token.holders ?? 0
  if (holders >= 5_000) return 'broad holder depth'
  if (holders >= 1_000) return 'broad holder base'
  if (holders >= 250) return 'developing holder base'
  if (holders > 0) return 'early holder base'
  return 'holder coverage is limited'
}

function snapshotSummary(token: ResolvedInlineTokenAnalysis): string {
  const liquidityDescriptor = describeLiquidity(token)
  const activityDescriptor = describeActivity(token)
  const holderDescriptor = describeHolderBase(token)
  if (liquidityDescriptor === 'liquid') {
    return `Liquid ${token.chainLabel} market with ${activityDescriptor} and ${holderDescriptor}.`
  }
  if (liquidityDescriptor === 'tradable') {
    return `Tradable ${token.chainLabel} market with ${activityDescriptor}; ${holderDescriptor} still matters.`
  }
  if (liquidityDescriptor === 'thin') {
    return `Thin ${token.chainLabel} market with ${activityDescriptor}; size around shallow depth.`
  }
  return `Primary market coverage is limited, so treat price discovery as unstable until liquidity improves.`
}

function catchUpWhat(token: ResolvedInlineTokenAnalysis): string {
  const symbol = asTrimmed(token.symbol ?? '')
  const named = asTrimmed(token.name ?? '')
  if (named && symbol && named.toUpperCase() !== symbol.toUpperCase()) {
    return `${named} (${symbol}) is trading on ${token.chainLabel}.`
  }
  if (named || symbol) return `${named || symbol} is trading on ${token.chainLabel}.`
  return `This address resolves to a supported ${token.chainLabel} token market.`
}

function catchUpWhyMoving(token: ResolvedInlineTokenAnalysis): string {
  const price = formatPercent(token.priceChange24h)
  const volume = formatUsdShort(token.volume24hUsd)
  if (price && volume) return `24h price is ${price} on ${volume} volume.`
  if (price) return `24h price is ${price} with no stronger catalyst in primary data.`
  if (volume) return `${volume} of 24h volume is driving the current tape.`
  return 'No clear catalyst is visible in primary market data.'
}

function catchUpWhatChanged(token: ResolvedInlineTokenAnalysis): string {
  const liquidity = formatUsdShort(token.liquidityUsd)
  const holders = formatCountShort(token.holders)
  if (liquidity && holders) return `Liquidity is ${liquidity} and holders are at ${holders}.`
  if (liquidity) return `Supported liquidity is currently ${liquidity}.`
  if (holders) return `Tracked holders are at ${holders}.`
  return 'Only the supported market has resolved so far.'
}

function catchUpNow(token: ResolvedInlineTokenAnalysis): string {
  if (token.vaultLink.linked && token.vaultLink.creatorLabel) {
    return `Vault-linked to ${token.vaultLink.creatorLabel} inside the 4626 surface.`
  }
  if (token.vaultLink.linked) {
    return 'Vault-linked inside the 4626 surface.'
  }
  return `Live pair is on ${token.dexId ? token.dexId : 'a supported market'} with no vault dependency.`
}

function catchUpFocus(token: ResolvedInlineTokenAnalysis): string {
  const buys = token.buys1h ?? token.buys24h
  const sells = token.sells1h ?? token.sells24h
  if (typeof buys === 'number' && typeof sells === 'number') {
    return `Watch order flow stay above ${Math.max(0, sells)} sells against ${Math.max(0, buys)} buys.`
  }
  if (token.liquidityUsd && token.volume24hUsd) {
    return 'Watch liquidity depth hold as volume rotates through the pair.'
  }
  return 'Watch for supported liquidity and cleaner directional flow.'
}

function formatRiskValue(value: TokenAnalysisRiskSignals[keyof TokenAnalysisRiskSignals]): string | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return `${(value / 100).toFixed(2).replace(/\.00$/, '')}%`
  return escapeTelegramHtml(String(value))
}

function riskVerdict(token: ResolvedInlineTokenAnalysis): string {
  const risk = token.secondary.risk
  const parts: string[] = []
  if (risk.ownership === 'owned') parts.push('Owner privileges are still live')
  if (risk.ownership === 'renounced') parts.push('ownership looks renounced')
  if (risk.proxy === 'yes') parts.push('proxy upgrade surface is present')
  if (risk.blacklist === 'yes') parts.push('blacklist or pause controls are present')
  if (risk.liquidityStatus === 'unknown') parts.push('liquidity controls are not verified')
  if (parts.length === 0) return 'Risk coverage is partial, so confirm permissions before relying on this market.'
  return `${parts.join('; ')}.`
}

function holderDistributionLine(token: ResolvedInlineTokenAnalysis): string {
  const holders = token.holders ?? 0
  if (holders >= 5_000) return 'Broad and resilient across a large holder base.'
  if (holders >= 1_000) return 'Broad enough for chat discovery, but large wallets can still move the tape.'
  if (holders >= 250) return 'Developing distribution with visible concentration risk.'
  if (holders > 0) return 'Early and likely concentrated until holder depth expands.'
  return 'Holder distribution is unresolved from the current feed.'
}

function holderVerdict(token: ResolvedInlineTokenAnalysis): string {
  if ((token.holders ?? 0) >= 1_000) return 'Holder breadth is improving, but concentration should still be checked before sizing.'
  if ((token.holders ?? 0) > 0) return 'Holder depth is still early, so single-wallet moves can matter.'
  return 'Holder concentration is still unresolved, so lean on liquidity and flow more than distribution.'
}

function describeVolumeTrend(token: ResolvedInlineTokenAnalysis): string | null {
  const volume24h = token.volume24hUsd
  const volume1h = token.volume1hUsd
  if (!volume24h || !volume1h) return volume24h ? 'present' : null
  const normalized = (volume1h * 24) / volume24h
  if (normalized >= 1.2) return 'accelerating'
  if (normalized >= 0.7) return 'steady'
  return 'cooling'
}

function describeLiquidityTrend(token: ResolvedInlineTokenAnalysis): string | null {
  const liquidity = token.liquidityUsd
  const volume24h = token.volume24hUsd
  if (!liquidity) return null
  if (!volume24h) return 'available'
  if (volume24h >= liquidity * 1.5) return 'stress-tested'
  if (volume24h >= liquidity * 0.5) return 'active'
  return 'stable'
}

function flowMomentum(token: ResolvedInlineTokenAnalysis): string {
  const price = token.priceChange24h ?? 0
  const trend = describeVolumeTrend(token)
  if (price > 0.05 && (trend === 'accelerating' || trend === 'steady')) return 'expansion'
  if (price < -0.05 && trend === 'accelerating') return 'unstable'
  if (trend === 'cooling') return 'fading'
  return 'stable'
}

function flowVerdict(token: ResolvedInlineTokenAnalysis): string {
  const momentum = flowMomentum(token)
  if (momentum === 'expansion') return 'Momentum is constructive while recent flow stays supported by live volume.'
  if (momentum === 'fading') return 'Momentum is cooling, so watch for follow-through before chasing activity.'
  if (momentum === 'unstable') return 'Momentum is unstable and can flip quickly while price and flow diverge.'
  return 'Flow is balanced, but it still depends on the current liquidity base holding.'
}

function convictionConfidence(token: ResolvedInlineTokenAnalysis): 'low' | 'medium' | 'high' {
  const liquidity = token.liquidityUsd ?? 0
  const volume = token.volume24hUsd ?? 0
  const holders = token.holders ?? 0
  const hasMaterialRisk = token.secondary.risk.ownership === 'owned' || token.secondary.risk.proxy === 'yes'
  if (liquidity >= 1_000_000 && volume >= 500_000 && holders >= 5_000 && !hasMaterialRisk) return 'high'
  if (liquidity >= 100_000 && volume >= 50_000) return 'medium'
  return 'low'
}

function convictionBull(token: ResolvedInlineTokenAnalysis): string {
  if ((token.liquidityUsd ?? 0) >= 500_000 && (token.volume24hUsd ?? 0) >= 250_000) {
    return 'Supported liquidity and turnover are already strong enough for broad chat distribution.'
  }
  if ((token.holders ?? 0) >= 1_000) {
    return 'Holder breadth is improving while the token stays on a supported market.'
  }
  return 'The token has resolved to a live supported market with usable primary metrics.'
}

function convictionBear(token: ResolvedInlineTokenAnalysis): string {
  if (token.secondary.risk.proxy === 'yes') return 'Upgradeable proxy risk is still in the path.'
  if (token.secondary.risk.ownership === 'owned') return 'Owner privileges remain live.'
  if ((token.liquidityUsd ?? 0) > 0 && (token.liquidityUsd ?? 0) < 100_000) return 'Liquidity is still thin for larger size.'
  return 'Secondary holder and permissions coverage is still partial.'
}

function convictionWatch(token: ResolvedInlineTokenAnalysis): string {
  if (typeof token.buys1h === 'number' && typeof token.sells1h === 'number') {
    return `1h buys vs sells: ${Math.round(token.buys1h)} / ${Math.round(token.sells1h)}.`
  }
  if (token.liquidityUsd && token.volume24hUsd) {
    return 'Liquidity depth versus 24h turnover.'
  }
  return 'Supported liquidity and directional flow.'
}

function vaultRelevance(token: ResolvedInlineTokenAnalysis): string {
  if (token.vaultLink.linked && token.vaultLink.relation === 'creator_coin') {
    return 'Address is the creator coin wired into a 4626 vault path.'
  }
  if (token.vaultLink.linked && token.vaultLink.relation === 'share_token') {
    return 'Address maps to a 4626 share token path.'
  }
  if (token.vaultLink.linked && token.vaultLink.relation === 'vault') {
    return 'Address is itself a 4626 vault contract.'
  }
  return 'No confirmed 4626 vault link is attached to this token.'
}

function vaultVerdict(token: ResolvedInlineTokenAnalysis): string {
  if (token.vaultLink.linked) return 'Vault linkage is confirmed, so token flow can be mapped back into the 4626 surface.'
  return 'No vault linkage is confirmed, so this stays a standalone token read.'
}

export function renderTokenSnapshotMessage(token: ResolvedInlineTokenAnalysis, nowMs = Date.now()): string {
  const addressLine = compactJoin([
    checksumCode(token.checksumAddress),
    escapeTelegramHtml(token.chainLabel),
    escapeTelegramHtml(formatAgeCompact({ createdAt: token.createdAt, nowMs }) ?? ''),
  ])
  const lines = [
    tokenHeading(token),
    addressLine,
    '',
    buildMetricRow([
      { label: 'MC', value: formatUsdShort(token.marketCapUsd) },
      { label: 'FDV', value: formatUsdShort(token.fdvUsd) },
    ]),
    buildMetricRow([
      { label: 'Liq', value: formatUsdShort(token.liquidityUsd) },
      { label: 'Vol', value: formatUsdShort(token.volume24hUsd) },
      { label: 'Holders', value: formatCountShort(token.holders) },
    ]),
    '',
    token.vaultLink.linked
      ? `Vault: ${escapeTelegramHtml(token.vaultLink.creatorLabel ?? shortAddress(token.vaultLink.vaultAddress) ?? 'yes')}`
      : 'Vault: no',
    '',
    '<b>Summary:</b>',
    escapeTelegramHtml(snapshotSummary(token)),
  ]
  return buildCardMessage({ lines, proseLineIndexes: [9] })
}

export function renderCatchUpMessage(token: ResolvedInlineTokenAnalysis): string {
  const lines = [
    '<b>Catch Up</b>',
    '',
    `<b>What:</b> ${escapeTelegramHtml(catchUpWhat(token))}`,
    `<b>Why moving:</b> ${escapeTelegramHtml(catchUpWhyMoving(token))}`,
    `<b>What changed:</b> ${escapeTelegramHtml(catchUpWhatChanged(token))}`,
    `<b>Now:</b> ${escapeTelegramHtml(catchUpNow(token))}`,
    `<b>Focus:</b> ${escapeTelegramHtml(catchUpFocus(token))}`,
  ]
  return buildCardMessage({ lines })
}

export function renderRiskMessage(token: ResolvedInlineTokenAnalysis): string {
  const risk = token.secondary.risk
  const riskRows = [
    risk.ownership ? `Ownership: ${formatRiskValue(risk.ownership)}` : null,
    risk.mint ? `Mint: ${formatRiskValue(risk.mint)}` : null,
    risk.blacklist ? `Blacklist: ${formatRiskValue(risk.blacklist)}` : null,
    risk.proxy ? `Proxy: ${formatRiskValue(risk.proxy)}` : null,
    risk.taxBps != null ? `Tax: ${formatRiskValue(risk.taxBps)}` : null,
    risk.liquidityStatus ? `Liquidity: ${formatRiskValue(risk.liquidityStatus)}` : null,
  ].filter((line): line is string => Boolean(line))
  const lines = [
    '<b>Risk Profile</b>',
    '',
    ...riskRows,
    '',
    '<b>Verdict:</b>',
    escapeTelegramHtml(riskVerdict(token)),
  ]
  return buildCardMessage({ lines, proseLineIndexes: [lines.length - 1] })
}

function renderHolderMessage(token: ResolvedInlineTokenAnalysis): string {
  const clusterLines = [
    token.vaultLink.linked ? '- Vault-linked address family is relevant.' : null,
    token.secondary.creatorLabel ? `- Creator linkage resolves to ${escapeTelegramHtml(token.secondary.creatorLabel)}.` : null,
  ].filter(Boolean)
  const lines = [
    '<b>Holder Structure</b>',
    '',
    clusterLines.length > 0 ? 'Clusters:' : null,
    ...clusterLines,
    clusterLines.length > 0 ? '' : null,
    'Distribution:',
    escapeTelegramHtml(holderDistributionLine(token)),
    '',
    '<b>Verdict:</b>',
    escapeTelegramHtml(holderVerdict(token)),
  ]
  return buildCardMessage({ lines })
}

function renderFlowMessage(token: ResolvedInlineTokenAnalysis): string {
  const activityLines = [
    typeof token.buys24h === 'number' && typeof token.sells24h === 'number'
      ? `- Buys vs sells: ${Math.round(token.buys24h)} / ${Math.round(token.sells24h)}`
      : null,
    typeof token.buys1h === 'number' && typeof token.sells1h === 'number'
      ? `- 1h flow: ${Math.round(token.buys1h)} / ${Math.round(token.sells1h)}`
      : null,
  ].filter(Boolean)
  const lines = [
    '<b>Flow</b>',
    '',
    formatPercent(token.priceChange24h) ? `Price: ${escapeTelegramHtml(formatPercent(token.priceChange24h) ?? '')}` : null,
    describeVolumeTrend(token) ? `Volume: ${escapeTelegramHtml(describeVolumeTrend(token) ?? '')}` : null,
    describeLiquidityTrend(token) ? `Liquidity: ${escapeTelegramHtml(describeLiquidityTrend(token) ?? '')}` : null,
    '',
    activityLines.length > 0 ? 'Activity:' : null,
    ...activityLines,
    activityLines.length > 0 ? '' : null,
    `Momentum: ${escapeTelegramHtml(flowMomentum(token))}`,
    '',
    '<b>Verdict:</b>',
    escapeTelegramHtml(flowVerdict(token)),
  ]
  return buildCardMessage({ lines })
}

function renderConvictionMessage(token: ResolvedInlineTokenAnalysis): string {
  const lines = [
    '<b>Conviction</b>',
    '',
    '<b>Bull:</b>',
    `- ${escapeTelegramHtml(convictionBull(token))}`,
    '',
    '<b>Bear:</b>',
    `- ${escapeTelegramHtml(convictionBear(token))}`,
    '',
    `Confidence: ${escapeTelegramHtml(convictionConfidence(token))}`,
    '',
    `Watch: ${escapeTelegramHtml(convictionWatch(token))}`,
  ]
  return buildCardMessage({ lines })
}

function renderVaultMessage(token: ResolvedInlineTokenAnalysis): string {
  const lines = [
    '<b>Vault Connection</b>',
    '',
    `Linked: ${token.vaultLink.linked ? 'yes' : 'no'}`,
    token.vaultLink.linked ? `Vault: ${checksumCode(token.vaultLink.vaultAddress) ?? escapeTelegramHtml('yes')}` : null,
    token.vaultLink.creatorLabel ? `Creator:\n${escapeTelegramHtml(token.vaultLink.creatorLabel)}` : null,
    '',
    'Relevance:',
    escapeTelegramHtml(vaultRelevance(token)),
    '',
    '<b>Verdict:</b>',
    escapeTelegramHtml(vaultVerdict(token)),
  ]
  return buildCardMessage({ lines })
}

function renderUnresolvedMessage(resolution: UnresolvedInlineTokenAnalysis): string {
  const body =
    resolution.reason === 'no_supported_active_market'
      ? 'Token metadata resolved, but no supported active market or meaningful liquidity was found.'
      : 'No supported token or pair was found for this address.'
  return buildCardMessage({
    lines: [
      '<b>Token Unresolved</b>',
      '',
      escapeCodeValue(resolution.checksumAddress),
      '',
      escapeTelegramHtml(body),
      'Verify the contract address or wait for supported liquidity.',
    ],
  })
}

function buildArticleResult(params: {
  id: string
  title: string
  description: string
  body: string
}): InlineArticleResult {
  return {
    type: 'article',
    id: params.id,
    title: params.title,
    description: params.description,
    input_message_content: {
      message_text: params.body,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    },
  }
}

export function buildInlineTokenAnalysisAnswer(params: {
  resolution: InlineTokenAnalysisResolution
  nowMs?: number
}): InlineQueryAnswer {
  const nowMs = typeof params.nowMs === 'number' && Number.isFinite(params.nowMs) ? params.nowMs : Date.now()
  if (params.resolution.kind === 'unresolved') {
    return {
      results: [
        buildArticleResult({
          id: buildResultId(params.resolution.normalizedAddress, 'unresolved'),
          title: 'Token Unresolved',
          description: 'No supported token or active market found',
          body: renderUnresolvedMessage(params.resolution),
        }),
      ],
      nextOffset: '',
      queryClass: 'token_analysis',
      offset: 0,
      totalResults: 1,
    }
  }

  const token = params.resolution
  const results = TOKEN_ANALYSIS_RESULT_ORDER.map((resultType) => {
    const body =
      resultType === 'snapshot'
        ? renderTokenSnapshotMessage(token, nowMs)
        : resultType === 'catchup'
          ? renderCatchUpMessage(token)
          : resultType === 'risk'
            ? renderRiskMessage(token)
            : resultType === 'holders'
              ? renderHolderMessage(token)
              : resultType === 'flow'
                ? renderFlowMessage(token)
                : resultType === 'conviction'
                  ? renderConvictionMessage(token)
                  : renderVaultMessage(token)

    const title =
      resultType === 'snapshot'
        ? 'Token Snapshot'
        : resultType === 'catchup'
          ? 'Catch Up'
          : resultType === 'risk'
            ? 'Risk Scan'
            : resultType === 'holders'
              ? 'Holder Breakdown'
              : resultType === 'flow'
                ? 'Flow / Momentum'
                : resultType === 'conviction'
                  ? 'Conviction Check'
                  : 'Vault Link'

    return buildArticleResult({
      id: buildResultId(token.normalizedAddress, resultType),
      title,
      description: TOKEN_ANALYSIS_RESULT_DESCRIPTION[resultType],
      body,
    })
  })

  return {
    results,
    nextOffset: '',
    queryClass: 'token_analysis',
    offset: 0,
    totalResults: results.length,
  }
}
