export type ArenaPositionLeg = {
  symbol: string
  side: 'LONG' | 'SHORT'
  size: number
  entryPx: number | null
  markPx: number | null
  liquidationPx: number | null
  unrealizedPnl: number | null
  positionValueUsd: number | null
  leverage: number | null
}

export type ArenaPositionIntelDetails = {
  positions?: unknown
  walletAddress?: string | null
  agentProfile?: {
    id?: string
    name?: string
    url?: string
    walletAddress?: string | null
  } | null
  clearinghouseState?: unknown
  spotUsdcBalance?: number | null
  userDetails?: unknown
  userFees?: unknown
  ledgerUpdates?: unknown
  userFills?: unknown
  allMids?: unknown
  partialFailures?: unknown
}

export type ArenaPositionsView = 'positions' | 'risk' | 'activity' | 'account' | 'pnl'

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function formatUsd(value: number | null, digits = 0): string {
  if (value == null) return 'n/a'
  if (value === 0) return '$0'
  const sign = value > 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: digits })}`
}

function formatUsdCompact(value: number | null): string {
  if (value == null) return 'n/a'
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}k`
  return formatUsd(value, abs >= 100 ? 0 : 2)
}

function formatPrice(value: number | null, digits = 0): string {
  if (value == null) return 'n/a'
  if (value >= 10_000) return `$${(value / 1_000).toFixed(2)}k`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: digits })}`
}

function formatPct(value: number | null, digits = 1): string {
  if (value == null) return 'n/a'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

function blockBar(ratio: number, width = 8): string {
  const clamped = Math.min(1, Math.max(0, ratio))
  const filled = Math.round(clamped * width)
  return `${'▓'.repeat(filled)}${'░'.repeat(width - filled)}`
}

function liqCushionBar(liqDist: number | null, width = 8): string {
  if (liqDist == null) return blockBar(0, width)
  return blockBar(Math.min(liqDist, 50) / 50, width)
}

function marginUsePct(used: number | null, total: number | null): number | null {
  if (used == null || total == null || total <= 0) return null
  return (used / total) * 100
}

function roiFromEntry(leg: ArenaPositionLeg): number | null {
  if (leg.entryPx == null || leg.markPx == null || leg.entryPx <= 0) return null
  const raw = ((leg.markPx - leg.entryPx) / leg.entryPx) * 100
  return leg.side === 'SHORT' ? -raw : raw
}

function relativeTime(ms: number | null): string {
  if (ms == null || ms <= 0) return 'recent'
  const ts = ms > 1_000_000_000_000 ? ms : ms * 1000
  const deltaMin = Math.round((Date.now() - ts) / 60_000)
  if (deltaMin < 1) return 'just now'
  if (deltaMin < 60) return `${deltaMin}m ago`
  const deltaHr = Math.round(deltaMin / 60)
  if (deltaHr < 48) return `${deltaHr}h ago`
  return new Date(ts).toISOString().slice(0, 10)
}

function bookHealthLabel(legs: ArenaPositionLeg[]): string {
  const distances = legs
    .map((leg) => liqDistancePct(leg))
    .filter((value): value is number => value != null)
  const tightest = distances.length > 0 ? Math.min(...distances) : null
  if (tightest == null) return 'health n/a'
  if (tightest < 8) return 'tight'
  if (tightest < 15) return 'watch'
  if (tightest < 25) return 'ok'
  return 'safe'
}

function sideBadge(side: 'LONG' | 'SHORT'): string {
  return side === 'LONG' ? '▲ LONG' : '▼ SHORT'
}

function formatTreeList(lines: string[]): string[] {
  if (lines.length === 0) return []
  if (lines.length === 1) return [`└ ${lines[0]}`]
  return lines.map((line, index) => `${index === lines.length - 1 ? '└' : '├'} ${line}`)
}

function formatTreeBlock(header: string | null, lines: string[]): string {
  const tree = formatTreeList(lines)
  if (!header) return tree.join('\n')
  return [header, ...tree].join('\n')
}

function sectionRule(width = 28): string {
  return '─'.repeat(width)
}

function formatProgressMenu(currentView: ArenaPositionsView): string {
  const optionsByView: Record<ArenaPositionsView, Array<{ key: string; label: string }>> = {
    positions: [
      { key: '2', label: 'risk' },
      { key: '3', label: 'activity' },
      { key: '4', label: 'account' },
      { key: '5', label: 'pnl' },
    ],
    risk: [
      { key: '1', label: 'book' },
      { key: '3', label: 'activity' },
      { key: '4', label: 'account' },
      { key: '5', label: 'pnl' },
    ],
    activity: [
      { key: '1', label: 'book' },
      { key: '2', label: 'risk' },
      { key: '4', label: 'account' },
      { key: '5', label: 'pnl' },
    ],
    account: [
      { key: '1', label: 'book' },
      { key: '2', label: 'risk' },
      { key: '3', label: 'activity' },
      { key: '5', label: 'pnl' },
    ],
    pnl: [
      { key: '1', label: 'book' },
      { key: '2', label: 'risk' },
      { key: '3', label: 'activity' },
      { key: '4', label: 'account' },
    ],
  }
  const actionLines = optionsByView[currentView].map(({ key, label }) => `[${key}] ${label}`)
  return [sectionRule(32), 'Actions', ...formatTreeList(actionLines)].join('\n')
}

function viewHeader(title: string, wallet: string): string {
  return `${title} · \`${wallet}\``
}

function readAgentProfile(details: ArenaPositionIntelDetails): {
  name: string
  url: string
} | null {
  const profile = asObject(details.agentProfile)
  if (!profile) return null
  const name = String(profile.name ?? '').trim()
  const url = String(profile.url ?? '').trim()
  if (!name || !url) return null
  return { name, url }
}

function formatBookHeader(details: ArenaPositionIntelDetails, wallet: string): string {
  const profile = readAgentProfile(details)
  if (profile) {
    return viewHeader(`◆ [**${profile.name}**](${profile.url})`, wallet)
  }
  return viewHeader('◆ **Virtuals book**', wallet)
}

function formatBookHeaderMultiline(details: ArenaPositionIntelDetails, wallet: string): string {
  const profile = readAgentProfile(details)
  if (profile) {
    return [`◆ [**${profile.name}**](${profile.url})`, ` · \`${wallet}\``].join('\n')
  }
  return [`◆ **Virtuals book**`, ` · \`${wallet}\``].join('\n')
}

function formatSubviewHeader(
  details: ArenaPositionIntelDetails,
  icon: string,
  label: string,
  wallet: string,
): string {
  const profile = readAgentProfile(details)
  if (profile) {
    return `${icon} [**${profile.name}**](${profile.url}) · ${label} · \`${wallet}\``
  }
  return viewHeader(`${icon} **${label}**`, wallet)
}

function formatLegPriceTail(leg: ArenaPositionLeg): string {
  if (leg.entryPx != null && leg.markPx != null) {
    return ` · ${formatPrice(leg.entryPx, 0)}→${formatPrice(leg.markPx, 0)}`
  }
  if (leg.markPx != null) return ` · mark ${formatPrice(leg.markPx, 0)}`
  if (leg.entryPx != null) return ` · entry ${formatPrice(leg.entryPx, 0)}`
  return ''
}

function formatUsdPlain(value: number | null): string {
  if (value == null) return 'n/a'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `$${(abs / 1_000).toFixed(1)}k`
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(2)}k`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: abs >= 100 ? 0 : 2 })}`
}

function readPositionLeverage(position: Record<string, unknown>): number | null {
  const direct = asFiniteNumber((position.leverage as { value?: unknown } | undefined)?.value ?? position.leverage)
  if (direct != null && direct > 0) return direct

  const positionValue = Math.abs(asFiniteNumber(position.positionValue) ?? 0)
  const marginUsed = asFiniteNumber(position.marginUsed)
  if (positionValue > 0 && marginUsed != null && marginUsed > 0) {
    return Math.round((positionValue / marginUsed) * 10) / 10
  }
  return null
}

function formatLegLeverage(leverage: number | null): string {
  if (leverage == null) return '?x'
  return Number.isInteger(leverage) ? `${leverage}x` : `${leverage.toFixed(1)}x`
}

function legLabelPlain(leg: ArenaPositionLeg): string {
  return `${leg.symbol} ${formatLegLeverage(leg.leverage)} ${leg.side}`
}

function formatCompactLegLines(legs: ArenaPositionLeg[]): string[] {
  if (legs.length === 0) return []

  const rows = legs.map((leg) => ({
    leg,
    plain: legLabelPlain(leg),
    markdown: `**${leg.symbol} ${formatLegLeverage(leg.leverage)}** ${leg.side}`,
  }))
  const labelWidth = Math.max(...rows.map((row) => row.plain.length), 12)

  return rows.map(({ leg, plain, markdown }) => {
    const pad = ' '.repeat(labelWidth - plain.length)
    const bar = liqCushionBar(liqDistancePct(leg))
    const roi = roiFromEntry(leg)
    const roiSuffix = roi == null ? '' : ` (${formatPct(roi)})`
    return `${markdown}${pad} ${bar} ${formatUsd(leg.unrealizedPnl)}${roiSuffix}${formatLegPriceTail(leg)}`
  })
}

function formatCompactBookBlock(params: {
  account: ReturnType<typeof readAccountSummary>
  totalPnl: number
  legs: ArenaPositionLeg[]
}): string {
  const { account, totalPnl, legs } = params
  const marginPct = marginUsePct(account.marginUsedUsd, account.accountValueUsd)
  const marginBar = marginPct == null ? blockBar(0) : blockBar(marginPct / 100)
  const summaryLine = `Margin ${formatUsdPlain(account.marginUsedUsd)}  ${marginBar}  Account ${formatUsdPlain(account.accountValueUsd)}  uPnL ${formatUsd(totalPnl)}`

  const contentLines = [
    summaryLine,
    ...(account.spotUsdcUsd != null && account.spotUsdcUsd > 0
      ? [`Spot: ${formatUsdPlain(account.spotUsdcUsd)} idle`]
      : []),
    ...formatCompactLegLines(legs),
  ]
  return formatTreeList(contentLines).join('\n')
}

function walletLabel(address: string | null | undefined): string {
  if (!address) return 'wallet n/a'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function parseSideFromSize(sizeRaw: number | null): 'LONG' | 'SHORT' | null {
  if (sizeRaw == null || sizeRaw === 0) return null
  return sizeRaw > 0 ? 'LONG' : 'SHORT'
}

function readMarkPrice(symbol: string, allMids: Record<string, unknown> | null): number | null {
  if (!allMids) return null
  const direct = asFiniteNumber(allMids[symbol] ?? allMids[symbol.toUpperCase()])
  if (direct != null) return direct
  const base = symbol.includes(':') ? symbol.split(':').pop() ?? symbol : symbol
  return asFiniteNumber(allMids[base] ?? allMids[base.toUpperCase()])
}

function liqDistancePct(params: {
  side: 'LONG' | 'SHORT'
  markPx: number | null
  liquidationPx: number | null
}): number | null {
  const ref = params.markPx ?? null
  const liq = params.liquidationPx
  if (ref == null || liq == null || ref <= 0) return null
  if (params.side === 'LONG') {
    if (liq >= ref) return null
    return ((ref - liq) / ref) * 100
  }
  if (liq <= ref) return null
  return ((liq - ref) / ref) * 100
}

function mergeLeg(existing: ArenaPositionLeg | undefined, patch: Partial<ArenaPositionLeg>): ArenaPositionLeg {
  return {
    symbol: patch.symbol ?? existing?.symbol ?? 'UNKNOWN',
    side: patch.side ?? existing?.side ?? 'LONG',
    size: patch.size ?? existing?.size ?? 0,
    entryPx: patch.entryPx ?? existing?.entryPx ?? null,
    markPx: patch.markPx ?? existing?.markPx ?? null,
    liquidationPx: patch.liquidationPx ?? existing?.liquidationPx ?? null,
    unrealizedPnl: patch.unrealizedPnl ?? existing?.unrealizedPnl ?? null,
    positionValueUsd: patch.positionValueUsd ?? existing?.positionValueUsd ?? null,
    leverage: patch.leverage ?? existing?.leverage ?? null,
  }
}

export function normalizeArenaPositionLegs(details: ArenaPositionIntelDetails): ArenaPositionLeg[] {
  const bySymbol = new Map<string, ArenaPositionLeg>()
  const allMids = asObject(details.allMids)

  for (const raw of asArray(details.positions)) {
    const row = asObject(raw)
    if (!row) continue
    const position = asObject(row.position) ?? row
    const sizeRaw =
      asFiniteNumber(position.szi) ??
      asFiniteNumber(position.size) ??
      asFiniteNumber(position.positionSize) ??
      asFiniteNumber(position.qty)
    const side = parseSideFromSize(sizeRaw)
    if (!side || sizeRaw == null) continue
    const symbol =
      String(position.coin ?? position.symbol ?? position.asset ?? '').trim().toUpperCase() || 'UNKNOWN'
    const leg = mergeLeg(bySymbol.get(symbol), {
      symbol,
      side,
      size: Math.abs(sizeRaw),
      entryPx: asFiniteNumber(position.entryPx ?? position.entryPrice),
      liquidationPx: asFiniteNumber(position.liquidationPx ?? position.liqPx),
      unrealizedPnl: asFiniteNumber(position.unrealizedPnl ?? position.unrealizedPnlUsd),
      markPx: readMarkPrice(symbol, allMids),
      leverage: readPositionLeverage(position),
    })
    bySymbol.set(symbol, leg)
  }

  const clearinghouse = asObject(details.clearinghouseState)
  for (const raw of asArray(clearinghouse?.assetPositions)) {
    const row = asObject(raw)
    if (!row) continue
    const position = asObject(row.position) ?? row
    const sizeRaw =
      asFiniteNumber(position.szi) ??
      asFiniteNumber(position.size) ??
      asFiniteNumber(position.positionSize)
    let side = parseSideFromSize(sizeRaw)
    if (!side) {
      const sideRaw = String(position.side ?? row.side ?? '').trim().toLowerCase()
      if (sideRaw === 'long') side = 'LONG'
      else if (sideRaw === 'short') side = 'SHORT'
    }
    if (!side) continue
    const symbol = String(position.coin ?? row.coin ?? 'UNKNOWN').trim().toUpperCase()
    const markPx = readMarkPrice(symbol, allMids)
    const positionValueUsd = asFiniteNumber(position.positionValue ?? row.positionValue)
    const inferredSize =
      sizeRaw != null
        ? Math.abs(sizeRaw)
        : markPx != null && positionValueUsd != null && markPx > 0
          ? Math.abs(positionValueUsd / markPx)
          : 0
    const directLeverage = asFiniteNumber(position.leverage ?? row.leverage)
    const leg = mergeLeg(bySymbol.get(symbol), {
      symbol,
      side,
      size: inferredSize,
      entryPx: asFiniteNumber(position.entryPx ?? row.entryPx),
      liquidationPx: asFiniteNumber(position.liquidationPx ?? row.liquidationPx),
      unrealizedPnl: asFiniteNumber(position.unrealizedPnl ?? row.unrealizedPnl),
      positionValueUsd,
      leverage: directLeverage ?? readPositionLeverage(position),
      markPx,
    })
    bySymbol.set(symbol, leg)
  }

  return [...bySymbol.values()].sort((a, b) => {
    const aVal = Math.abs(a.unrealizedPnl ?? 0)
    const bVal = Math.abs(b.unrealizedPnl ?? 0)
    return bVal - aVal
  })
}

function readAccountSummary(details: ArenaPositionIntelDetails): {
  accountValueUsd: number | null
  marginUsedUsd: number | null
  withdrawableUsd: number | null
  spotUsdcUsd: number | null
} {
  const clearinghouse = asObject(details.clearinghouseState)
  const marginSummary = asObject(clearinghouse?.marginSummary)
  const rawAccountValue = asFiniteNumber(marginSummary?.accountValue)
  const rawMarginUsed = asFiniteNumber(
    marginSummary?.totalMarginUsed ?? marginSummary?.totalNtlPos,
  )
  const rawWithdrawable = asFiniteNumber(clearinghouse?.withdrawable)
  const normalizedAccountValue = asFiniteNumber(clearinghouse?.accountValueUsd)
  const normalizedMarginUsed = asFiniteNumber(
    clearinghouse?.totalNtlPosUsd ?? clearinghouse?.totalRawUsdUsd,
  )
  const normalizedWithdrawable = asFiniteNumber(clearinghouse?.withdrawableUsd)

  return {
    accountValueUsd: rawAccountValue ?? normalizedAccountValue,
    marginUsedUsd: rawMarginUsed ?? normalizedMarginUsed,
    withdrawableUsd: rawWithdrawable ?? normalizedWithdrawable,
    spotUsdcUsd: asFiniteNumber(details.spotUsdcBalance),
  }
}

export function parseArenaPositionsView(token: string | undefined): ArenaPositionsView {
  const normalized = String(token ?? '')
    .trim()
    .toLowerCase()
  switch (normalized) {
    case '':
    case '1':
    case 'positions':
    case 'position':
    case 'pos':
    case 'overview':
    case 'summary':
      return 'positions'
    case '2':
    case 'risk':
    case 'liq':
    case 'liquidation':
      return 'risk'
    case '3':
    case 'activity':
    case 'trades':
    case 'fills':
    case 'ledger':
      return 'activity'
    case '4':
    case 'account':
    case 'fees':
    case 'balance':
    case 'wallet':
      return 'account'
    case '5':
    case 'pnl':
    case 'score':
    case 'scorecard':
    case 'stats':
    case 'record':
      return 'pnl'
    default:
      return 'positions'
  }
}

function formatPositionsView(details: ArenaPositionIntelDetails): string {
  const legs = normalizeArenaPositionLegs(details)
  const account = readAccountSummary(details)
  const wallet = walletLabel(details.walletAddress ?? null)
  if (legs.length === 0) {
    const free = account.withdrawableUsd ?? account.spotUsdcUsd
    return [
      formatBookHeaderMultiline(details, wallet),
      sectionRule(32),
      formatTreeBlock(null, [free == null ? 'Flat · no open perps' : `Flat · free ${formatUsdCompact(free)}`]),
    ].join('\n')
  }

  const totalPnl = legs.reduce((sum, leg) => sum + (leg.unrealizedPnl ?? 0), 0)
  const marginPct = marginUsePct(account.marginUsedUsd, account.accountValueUsd)
  const marginBar = marginPct == null ? blockBar(0) : blockBar(marginPct / 100)
  const summaryLine = `Margin ${formatUsdPlain(account.marginUsedUsd)}  ${marginBar}  Account ${formatUsdPlain(account.accountValueUsd)}  uPnL ${formatUsd(totalPnl)}`

  return [
    formatBookHeaderMultiline(details, wallet),
    sectionRule(32),
    `├ ${summaryLine}`,
    sectionRule(32),
    'Positions',
    ...formatTreeList(formatCompactLegLines(legs)),
  ].join('\n')
}

function formatRiskView(details: ArenaPositionIntelDetails): string {
  const legs = normalizeArenaPositionLegs(details)
  const account = readAccountSummary(details)
  const wallet = walletLabel(details.walletAddress ?? null)
  if (legs.length === 0) {
    return [
      formatSubviewHeader(details, '⚠', 'Risk', wallet),
      sectionRule(32),
      formatTreeBlock(null, ['No open positions']),
    ].join('\n')
  }

  const ranked = legs
    .map((leg) => ({ leg, liqDist: liqDistancePct(leg) }))
    .sort((a, b) => (a.liqDist ?? 999) - (b.liqDist ?? 999))
  const tightest = ranked[0]
  const marginPct = marginUsePct(account.marginUsedUsd, account.accountValueUsd)
  const totalPnl = legs.reduce((sum, leg) => sum + (leg.unrealizedPnl ?? 0), 0)

  const summaryParts = [
    tightest?.liqDist != null
      ? `Tightest: ${tightest.leg.symbol} · ◆ ${formatPct(tightest.liqDist)} to liq`
      : 'Tightest: n/a',
    marginPct != null ? `${blockBar(marginPct / 100)} ${formatPct(marginPct, 0)} margin` : null,
    `uPnL ${formatUsd(totalPnl)}`,
  ].filter((line): line is string => Boolean(line))

  return [
    formatSubviewHeader(details, '⚠', 'Risk', wallet),
    sectionRule(32),
    formatTreeList([summaryParts.join('  '), ...formatCompactLegLines(ranked.map(({ leg }) => leg))]).join('\n'),
  ].join('\n')
}

function summarizeLedgerRow(entry: unknown): string | null {
  const row = asObject(entry)
  if (!row) return null
  const delta = asObject(row.delta)
  const type = String(delta?.type ?? row.type ?? 'update')
  const usdc = asFiniteNumber(delta?.usdc ?? row.usdc ?? row.amount)
  const time = asFiniteNumber(row.time ?? row.timestamp)
  const when = relativeTime(time)
  return `${when} · ${type} · ${formatUsd(usdc)}`
}

function summarizeFillRow(entry: unknown): string | null {
  const row = asObject(entry)
  if (!row) return null
  const coin = String(row.coin ?? row.symbol ?? '?').toUpperCase()
  const side = String(row.dir ?? row.side ?? '?')
  const px = asFiniteNumber(row.px ?? row.price)
  const sz = asFiniteNumber(row.sz ?? row.size)
  const pnl = asFiniteNumber(row.closedPnl ?? row.pnl)
  const fee = asFiniteNumber(row.fee)
  const time = asFiniteNumber(row.time ?? row.timestamp)
  const when = relativeTime(time)
  return `**${coin}** · ${side} · ${when} · ${sz == null ? '?' : sz} @ ${px == null ? '?' : formatPrice(px, 0)} · pnl ${formatUsd(pnl)} · fee ${formatUsd(fee, 2)}`
}

function formatActivityView(details: ArenaPositionIntelDetails): string {
  const wallet = walletLabel(details.walletAddress ?? null)
  const openSymbols = new Set(normalizeArenaPositionLegs(details).map((leg) => leg.symbol))
  const rawFills = asArray(details.userFills)
  const fills = rawFills
    .map(summarizeFillRow)
    .filter((line): line is string => Boolean(line))
  const openFills = fills.filter((line) => {
    const match = line.match(/\*\*([A-Z0-9:_]+)\*\*/)
    const coin = match?.[1]?.toUpperCase()
    return coin ? openSymbols.has(coin) : false
  })
  const fillLines = (openFills.length > 0 ? openFills : fills).slice(0, 5)
  const displayedRawFills = (openFills.length > 0
    ? rawFills.filter((entry) => {
        const row = asObject(entry)
        const coin = String(row?.coin ?? row?.symbol ?? '').toUpperCase()
        return openSymbols.has(coin)
      })
    : rawFills
  ).slice(0, 5)
  const fillPnlTotal = displayedRawFills.reduce<number>(
    (sum, entry) => sum + (asFiniteNumber(asObject(entry)?.closedPnl ?? asObject(entry)?.pnl) ?? 0),
    0,
  )

  const ledgerLines = asArray(details.ledgerUpdates)
    .map(summarizeLedgerRow)
    .filter((line): line is string => Boolean(line))
    .slice(0, 5)

  const tradeLines =
    fillLines.length > 0
      ? [...fillLines, `Total pnl: ${formatUsd(fillPnlTotal)}`]
      : ['none']

  const cashLines = ledgerLines.length > 0 ? ledgerLines : ['none']

  return [
    formatSubviewHeader(details, '↺', 'Activity', wallet),
    sectionRule(32),
    formatTreeBlock('**Trades**', tradeLines),
    '',
    formatTreeBlock('**Cash moves**', cashLines),
  ]
    .filter(Boolean)
    .join('\n')
}

function readLatestDailyVolume(userFees: Record<string, unknown> | null): number | null {
  const daily = asArray(userFees?.dailyUserVlm)
  if (daily.length === 0) return null
  const latest = asObject(daily[daily.length - 1])
  const cross = asFiniteNumber(latest?.userCross)
  const add = asFiniteNumber(latest?.userAdd)
  if (cross == null && add == null) return null
  return (cross ?? 0) + (add ?? 0)
}

function readUserDetailsSummary(userDetails: unknown): string | null {
  const row = asObject(userDetails)
  if (!row) return null
  const txs = asArray(row.txs ?? row.transactions)
  if (txs.length > 0) return `${txs.length} recent explorer txs`
  const txCount = asFiniteNumber(row.txCount ?? row.count)
  if (txCount != null) return `${txCount} explorer txs`
  return null
}

function formatFeeBps(rate: number | null): string {
  if (rate == null) return 'n/a'
  return `${(rate * 10_000).toFixed(2)} bps`
}

function formatAccountView(details: ArenaPositionIntelDetails): string {
  const account = readAccountSummary(details)
  const wallet = walletLabel(details.walletAddress ?? null)
  const fees = asObject(details.userFees)
  const crossRate = asFiniteNumber(fees?.userCrossRate)
  const addRate = asFiniteNumber(fees?.userAddRate)
  const dailyVol = readLatestDailyVolume(fees)
  const explorer = readUserDetailsSummary(details.userDetails)
  const marginPct = marginUsePct(account.marginUsedUsd, account.accountValueUsd)

  const accountLines: string[] = [
    `Wallet: \`${wallet}\``,
    `Perps: ${formatUsdCompact(account.accountValueUsd)} · withdraw ${formatUsdCompact(account.withdrawableUsd)}`,
    `Spot: ${formatUsdCompact(account.spotUsdcUsd)}`,
  ]
  if (marginPct != null) {
    accountLines.push(`Margin: ${blockBar(marginPct / 100)} ${formatPct(marginPct, 0)}`)
  }
  if (crossRate != null || addRate != null) {
    accountLines.push(`Fees: taker ${formatFeeBps(crossRate)} · maker ${formatFeeBps(addRate)}`)
  } else {
    accountLines.push('Fees: unavailable')
  }
  if (dailyVol != null) accountLines.push(`Volume: ${formatUsdCompact(dailyVol)} today`)
  if (explorer) accountLines.push(`Explorer: ${explorer}`)

  return [
    formatSubviewHeader(details, '◈', 'Account', wallet),
    sectionRule(32),
    formatTreeBlock(null, accountLines),
  ]
    .filter(Boolean)
    .join('\n')
}

export type ArenaRealizedScorecard = {
  /** Distinct closing orders (fills grouped by tx hash with a closing dir). */
  closeEvents: number
  wins: number
  losses: number
  /** Sum of closedPnl across all fills (before fees). */
  realizedPnlUsd: number
  /** Sum of fees across all fills. */
  feesUsd: number
  avgWinUsd: number | null
  avgLossUsd: number | null
  /** Sum of |px * sz| across all fills. */
  volumeUsd: number
  fillCount: number
  firstFillAtMs: number | null
  lastFillAtMs: number | null
}

function isClosingFillDir(dir: string): boolean {
  const normalized = dir.toLowerCase()
  return (
    normalized.includes('close') ||
    normalized.includes('liquidat') ||
    normalized.includes('>')
  )
}

/**
 * Aggregate a Hyperliquid `userFills` payload into a realized-PnL scorecard.
 * A "trade" is a closing order: fills sharing one tx hash where the fill
 * direction closes or flips a position (partial fills of one close order
 * count once). Exported for tests.
 */
export function computeArenaRealizedScorecard(userFills: unknown): ArenaRealizedScorecard | null {
  const rawFills = asArray(userFills)
  if (rawFills.length === 0) return null

  let realizedPnlUsd = 0
  let feesUsd = 0
  let volumeUsd = 0
  let fillCount = 0
  let firstFillAtMs: number | null = null
  let lastFillAtMs: number | null = null
  const closePnlByHash = new Map<string, number>()

  for (const entry of rawFills) {
    const row = asObject(entry)
    if (!row) continue
    fillCount += 1
    const closedPnl = asFiniteNumber(row.closedPnl ?? row.pnl) ?? 0
    const fee = asFiniteNumber(row.fee) ?? 0
    const px = asFiniteNumber(row.px ?? row.price)
    const sz = asFiniteNumber(row.sz ?? row.size)
    realizedPnlUsd += closedPnl
    feesUsd += fee
    if (px != null && sz != null) volumeUsd += Math.abs(px * sz)

    const time = asFiniteNumber(row.time ?? row.timestamp)
    if (time != null && time > 0) {
      if (firstFillAtMs == null || time < firstFillAtMs) firstFillAtMs = time
      if (lastFillAtMs == null || time > lastFillAtMs) lastFillAtMs = time
    }

    const dir = String(row.dir ?? row.side ?? '')
    if (isClosingFillDir(dir)) {
      const hash = String(row.hash ?? row.tid ?? `${dir}:${String(time ?? fillCount)}`)
      closePnlByHash.set(hash, (closePnlByHash.get(hash) ?? 0) + closedPnl)
    }
  }

  let wins = 0
  let losses = 0
  let winTotal = 0
  let lossTotal = 0
  for (const pnl of closePnlByHash.values()) {
    if (pnl > 0) {
      wins += 1
      winTotal += pnl
    } else {
      losses += 1
      lossTotal += pnl
    }
  }

  return {
    closeEvents: closePnlByHash.size,
    wins,
    losses,
    realizedPnlUsd,
    feesUsd,
    avgWinUsd: wins > 0 ? winTotal / wins : null,
    avgLossUsd: losses > 0 ? lossTotal / losses : null,
    volumeUsd,
    fillCount,
    firstFillAtMs,
    lastFillAtMs,
  }
}

function formatSinceDate(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null
  return new Date(ms).toISOString().slice(0, 10)
}

function formatSignedUsdFixed(value: number | null): string {
  if (value == null) return 'n/a'
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

function formatUnsignedUsdCompact(value: number | null): string {
  return formatUsdCompact(value).replace(/^\+/, '')
}

function formatPnlView(details: ArenaPositionIntelDetails): string {
  const wallet = walletLabel(details.walletAddress ?? null)
  const scorecard = computeArenaRealizedScorecard(details.userFills)
  const account = readAccountSummary(details)
  const legs = normalizeArenaPositionLegs(details)
  const header = formatSubviewHeader(details, '◎', 'PnL', wallet)

  if (!scorecard) {
    return [header, sectionRule(32), formatTreeBlock(null, ['No fills recorded yet'])].join('\n')
  }

  const netRealized = scorecard.realizedPnlUsd - scorecard.feesUsd
  const winRatePct =
    scorecard.closeEvents > 0 ? (scorecard.wins / scorecard.closeEvents) * 100 : null

  const lines: string[] = [
    `Realized: ${formatSignedUsdFixed(netRealized)} net (gross ${formatSignedUsdFixed(scorecard.realizedPnlUsd)} · fees $${scorecard.feesUsd.toFixed(2)})`,
    winRatePct == null
      ? `Closes: none yet · ${scorecard.fillCount} fills`
      : `Win rate: ${winRatePct.toFixed(0)}% (${scorecard.wins}W / ${scorecard.losses}L over ${scorecard.closeEvents} closes)`,
  ]
  if (scorecard.avgWinUsd != null || scorecard.avgLossUsd != null) {
    lines.push(
      `Avg: win ${formatSignedUsdFixed(scorecard.avgWinUsd)} · loss ${formatSignedUsdFixed(scorecard.avgLossUsd)}`,
    )
  }
  const since = formatSinceDate(scorecard.firstFillAtMs)
  lines.push(
    `Volume: ${formatUnsignedUsdCompact(scorecard.volumeUsd)} across ${scorecard.fillCount} fills${since ? ` since ${since}` : ''}`,
  )
  const openPnl = legs.reduce((sum, leg) => sum + (leg.unrealizedPnl ?? 0), 0)
  lines.push(
    `Account: ${formatUnsignedUsdCompact(account.accountValueUsd)}${legs.length > 0 ? ` · uPnL ${formatSignedUsdFixed(openPnl)} (${legs.length} open)` : ' · flat'}`,
  )
  const fullWallet = String(details.walletAddress ?? '').trim().toLowerCase()
  if (/^0x[a-f0-9]{40}$/.test(fullWallet)) {
    lines.push(`Explorer: https://hypurrscan.io/address/${fullWallet}`)
  }

  return [header, sectionRule(32), formatTreeBlock(null, lines)].join('\n')
}

export function formatArenaPositionIntelReply(
  detailToken: string | undefined,
  details: ArenaPositionIntelDetails,
): string {
  const view = parseArenaPositionsView(detailToken)
  const partialFailures = asArray(details.partialFailures).map((value) => String(value))
  const warning =
    partialFailures.length > 0
      ? `_⚠ partial data (${partialFailures.slice(0, 2).join(' · ')})_`
      : ''

  const body =
    view === 'risk'
      ? formatRiskView(details)
      : view === 'activity'
        ? formatActivityView(details)
        : view === 'account'
          ? formatAccountView(details)
          : view === 'pnl'
            ? formatPnlView(details)
            : formatPositionsView(details)

  const footer = formatProgressMenu(view)
  if (warning) return `${warning}\n${body}\n${footer}`
  return `${body}\n${footer}`
}
