import type { Address } from 'viem'

import { checkSharesEligibility } from '../_lib/keeprGating.js'
import { getKeeprVaultByGroupId, setKeeprJoinLocked } from '../_lib/keeprRegistry.js'
import {
  isOpenbbConfigured,
  openbbCompanyNews,
  openbbEconomicCalendar,
  openbbEquityHistorical,
  openbbEquityQuote,
  openbbFinancialRatios,
  type CompanyNewsData,
  type EconomicCalendarData,
  type EquityHistoricalData,
  type EquityQuoteData,
  type FinancialRatiosData,
} from '../_lib/openbbClient.js'
import { handleFarcasterCommand } from '../farcaster/commands.js'
import { handleCoinCommand } from '../zora/commands.js'
import { handleBankrCommand } from '../bankr/commands.js'
import { handleSendCommand } from './sendCommand.js'
import { handleWhoisCommand } from './whoisCommand.js'
import { generateLlmResponse } from '../ai/chat.js'
import { toAgentError, toUserFacingAgentErrorMessage } from '../agent/eliza/_errors.js'
import { formatNumberedCommandFallback } from '../_lib/chatCommandFallback.js'

export type KeeprRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type KeeprCommandResult =
  | { ok: true; response: string; action?: any }
  | { ok: false; response: string }

function formatKeeprHelp(): string {
  return [
    'Keepr commands',
    '',
    'Tip: you can type with or without a leading slash.',
    '',
    'Start here:',
    '',
    '- /help — command list',
    '- /keepr status — vault status and config',
    '- /ai <question> — ask in plain English',
    '',
    'Core Keepr commands:',
    '',
    '- keepr help',
    '- keepr status',
    '- keepr rules',
    '- keepr check',
    '- keepr check 0x... (ADMIN/OWNER)',
    '- keepr lock (OWNER)',
    '- keepr unlock (OWNER)',
    '- keepr sync (ADMIN/OWNER)',
    '',
    'Token commands:',
    '',
    '- /send <amount> USDC to <address> (ADMIN/OWNER)',
    '- /send <amount> ETH to <address> (ADMIN/OWNER)',
    '',
    'Zora Coin commands (type /coin help for more):',
    '',
    '- /coin create <name> <symbol> <uri> — create Content Coin',
    '- /coin buy <address> <eth-amount> — buy coin with ETH',
    '- /coin sell <address> <amount> — sell coin for ETH',
    '- /coin balance — agent wallet balance',
    '- /coin info <address> — coin details',
    '- /coin trend check <ticker> — trend preflight',
    '- /coin trend reserve <ticker> — deploy trend coin',
    '- /coin trend status <ticker> — trend ops status',
    '- /coin trend funnel <ticker> [eth-amount] — run guarded flywheel action',
    '',
    'AI commands:',
    '',
    '- /ai <question> — ask the vault assistant',
    '- @keepr <question> — same as /ai',
    '',
    'Market data (OpenBB):',
    '',
    '- /mkt quote <symbol> — latest quote',
    '- /mkt news <symbol> [limit] — recent headlines',
    '- /mkt ratios <symbol> — fundamentals ratios (provider dependent)',
    '- /mkt calendar [today|week|YYYY-MM-DD..YYYY-MM-DD] — macro events',
    '- /mkt chart <symbol> [1w|1m|3m|1y|YYYY-MM-DD..YYYY-MM-DD] — price history summary',
    '',
    'Farcaster commands (type /fc help for more):',
    '',
    '- /fc profile <address|fid>',
    '- /fc cast <message> (ADMIN/OWNER)',
    '- /fc gallery',
    '- /fc stats',
    '',
    'CRE Keeper commands (type /cre help for more):',
    '',
    '- /cre status — vault keeper states',
    '- /cre auction — CCA auction states',
    '- /cre solana — Solana price & health',
    '- /cre health — combined health check',
    '- /cre tend [vault] — deploy idle funds',
    '- /cre report [vault] — harvest yields',
    '- /cre flush-fees — flush Solana fees',
    '',
    'Bankr commands:',
    '',
    '- /bankr status',
    '- /bankr me',
    '- /bankr balances [base,solana]',
    '- /bankr ask <question>',
    '- /bankr exec <instruction> --confirm (ADMIN/OWNER)',
    '',
    'Wallet & Reputation:',
    '',
    '- /whois <address> — ENS + Basename identity',
    '- /intel <address> — wallet intelligence report',
    '- /reputation [agentId] — ERC-8004 reputation graph',
    '- /feedback [agentId] — feedback summary',
  ].join('\n')
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function roleForWallet(params: { wallet: Address; owner: Address; admins: Address[] }): KeeprRole {
  const w = params.wallet.toLowerCase()
  if (w === params.owner.toLowerCase()) return 'OWNER'
  if (params.admins.some((a) => a.toLowerCase() === w)) return 'ADMIN'
  return 'MEMBER'
}

function formatVaultStatus(v: Awaited<ReturnType<typeof getKeeprVaultByGroupId>>): string {
  if (!v) {
    return [
      'Keepr status',
      '',
      '- configured: no',
      '- next: ask the creator to connect this group in 4626',
    ].join('\n')
  }
  return [
    'Keepr status',
    '',
    '- configured: yes',
    '- vaultAddress: ' + v.vaultAddress,
    '- chainId: ' + String(v.chainId),
    '- groupId: ' + v.groupId,
    '- lensGroupAddress: ' + String(v.lensGroupAddress ?? 'n/a'),
    '- canonicalOwner: ' + v.canonicalOwnerAddress,
    '- gating:',
    '  - enabled: ' + String(v.gatingEnabled),
    '  - mode: ' + String(v.gatingMode),
    '  - joinLocked: ' + String(v.joinLocked),
    '  - minShares: ' + String(v.minShares ?? 'n/a'),
    '  - failClosed: ' + String(v.failClosed),
    '- configHash: ' + v.configHash,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Market data commands (/mkt) — OpenBB
// ---------------------------------------------------------------------------

const MARKET_SYMBOL_RE = /^[a-z0-9][a-z0-9.\-]{0,15}$/i
const DAY_MS = 86_400_000

function isMarketCommand(rawLower: string): boolean {
  return /^\/mkt(\s|$)/.test(rawLower) || /^mkt(\s|$)/.test(rawLower)
}

function formatMarketHelp(): string {
  return [
    'Market data commands (OpenBB)',
    '',
    '- /mkt quote AAPL',
    '- /mkt news AAPL [limit]',
    '- /mkt ratios AAPL',
    '- /mkt calendar [today|week|YYYY-MM-DD..YYYY-MM-DD]',
    '- /mkt chart AAPL [1w|1m|3m|1y|YYYY-MM-DD..YYYY-MM-DD]',
    '',
    'Notes:',
    '- Data is informational only (not financial advice).',
  ].join('\n')
}

function normalizeSymbol(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (!MARKET_SYMBOL_RE.test(raw)) return null
  return raw.toUpperCase()
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function formatSignedNumber(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}`
}

function formatPercentNormalized(value: number, decimals = 2): string {
  // OpenBB's EquityQuote.change_percent is described as a "normalized percentage".
  // Some providers return 0.0123, others return 1.23. Handle both safely.
  const pct = Math.abs(value) <= 1 ? value * 100 : value
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(decimals)}%`
}

function formatCompactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  if (abs >= 10) return value.toFixed(0)
  return value.toFixed(2)
}

function isoDateUtcFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function parseIsoDate(value: string): string | null {
  const v = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const ms = Date.parse(`${v}T00:00:00Z`)
  if (!Number.isFinite(ms)) return null
  return v
}

function parseIsoRangeToken(value: string): { startDate: string; endDate: string } | null {
  const parts = value.split('..')
  if (parts.length !== 2) return null
  const startDate = parseIsoDate(parts[0] ?? '')
  const endDate = parseIsoDate(parts[1] ?? '')
  if (!startDate || !endDate) return null
  const startMs = Date.parse(`${startDate}T00:00:00Z`)
  const endMs = Date.parse(`${endDate}T00:00:00Z`)
  if (endMs < startMs) return null
  return { startDate, endDate }
}

function daysBetween(startDate: string, endDate: string): number {
  const startMs = Date.parse(`${startDate}T00:00:00Z`)
  const endMs = Date.parse(`${endDate}T00:00:00Z`)
  return Math.floor((endMs - startMs) / DAY_MS)
}

function truncate(value: string, max = 120): string {
  const v = value.trim()
  if (v.length <= max) return v
  return v.slice(0, max - 1).trimEnd() + '…'
}

function formatMarketError(result: { error: string; message?: string }): string {
  if (result.error === 'not_configured') {
    return 'Market data is not configured. Set OPENBB_API_BASE_URL on the agent/server.'
  }
  if (result.error === 'backend_unavailable') {
    return 'Market data is temporarily unavailable (OpenBB backend unreachable).'
  }
  const msg = (result.message ?? '').trim()
  if (!msg) return 'Market data request failed.'
  return `Market data request failed: ${truncate(msg, 180)}`
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in row)) continue
    const n = toNumber((row as any)[key])
    if (n !== null) return n
  }
  return null
}

function formatMaybePercent(value: number | null): string | null {
  if (value === null) return null
  // Heuristic: treat 0..1 as a fraction; treat 1..100 as already percent.
  const pct = Math.abs(value) <= 1 ? value * 100 : value
  return `${pct.toFixed(1)}%`
}

function formatCalendarValue(value: unknown, unit: unknown): string | null {
  const v = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : ''
  if (!v) return null
  const u = typeof unit === 'string' ? unit.trim() : ''
  if (!u) return v
  if (u === '%' || u.startsWith('%')) return `${v}${u}`
  return `${v} ${u}`
}

function resolveCalendarRange(arg: string | null): { startDate: string; endDate: string } | { error: string } {
  const raw = String(arg ?? '').trim()
  const token = raw.toLowerCase()

  const today = isoDateUtcFromMs(Date.now())
  if (!token || token === 'week') {
    return { startDate: today, endDate: isoDateUtcFromMs(Date.now() + 7 * DAY_MS) }
  }
  if (token === 'today') {
    return { startDate: today, endDate: today }
  }

  const explicit = parseIsoRangeToken(raw)
  if (!explicit) {
    return { error: 'Usage: `/mkt calendar [today|week|YYYY-MM-DD..YYYY-MM-DD]`' }
  }
  if (daysBetween(explicit.startDate, explicit.endDate) > 31) {
    return { error: 'Date range too large. Limit calendar queries to 31 days.' }
  }
  return explicit
}

function resolveChartRange(arg: string | null): { startDate: string; endDate: string; label: string } | { error: string } {
  const raw = String(arg ?? '').trim()
  const token = raw.toLowerCase()

  const endDate = isoDateUtcFromMs(Date.now())
  const presets: Record<string, { days: number; label: string }> = {
    '1w': { days: 7, label: '1w' },
    week: { days: 7, label: '1w' },
    '1m': { days: 30, label: '1m' },
    '3m': { days: 90, label: '3m' },
    '1y': { days: 365, label: '1y' },
  }

  if (!token) {
    const p = presets['1m']
    return { startDate: isoDateUtcFromMs(Date.now() - p.days * DAY_MS), endDate, label: p.label }
  }

  const preset = presets[token]
  if (preset) {
    return { startDate: isoDateUtcFromMs(Date.now() - preset.days * DAY_MS), endDate, label: preset.label }
  }

  const explicit = parseIsoRangeToken(raw)
  if (!explicit) {
    return { error: 'Usage: `/mkt chart <symbol> [1w|1m|3m|1y|YYYY-MM-DD..YYYY-MM-DD]`' }
  }
  const days = daysBetween(explicit.startDate, explicit.endDate)
  if (days > 400) {
    return { error: 'Date range too large. Limit chart queries to ~400 days.' }
  }
  return { startDate: explicit.startDate, endDate: explicit.endDate, label: `${explicit.startDate}..${explicit.endDate}` }
}

async function handleMarketCommand(text: string): Promise<KeeprCommandResult> {
  const parts = text.split(/\s+/g).filter(Boolean)
  const prefix = String(parts[0] ?? '').toLowerCase()
  if (prefix !== '/mkt' && prefix !== 'mkt') {
    return { ok: false, response: '' }
  }

  const cmd = String(parts[1] ?? 'help').trim().toLowerCase()
  const arg1 = parts[2] ? String(parts[2]).trim() : null
  const arg2 = parts[3] ? String(parts[3]).trim() : null

  if (cmd === 'help') {
    return { ok: true, response: formatMarketHelp() }
  }

  if (cmd === 'quote') {
    const symbol = normalizeSymbol(arg1)
    if (!symbol) return { ok: false, response: 'Usage: `/mkt quote <symbol>`' }
    const result = await openbbEquityQuote({ symbol })
    if (!result.ok) return { ok: false, response: formatMarketError(result) }

    const envelope = result.data
    const quote = asArray<EquityQuoteData>(envelope?.results as any)[0]
    if (!quote) return { ok: false, response: `No quote data returned for ${symbol}.` }

    const last = toNumber(quote.last_price)
    const change = toNumber(quote.change)
    const changePct = toNumber(quote.change_percent)
    const volume = toNumber(quote.volume)
    const exchange = typeof quote.exchange === 'string' ? quote.exchange : null
    const name = typeof quote.name === 'string' ? quote.name : null
    const ts = typeof quote.last_timestamp === 'string' ? quote.last_timestamp : null

    const lines: string[] = []
    lines.push(`Market quote — ${quote.symbol ?? symbol}${name ? ` (${name})` : ''}`)
    if (last !== null) {
      const price = last.toFixed(2)
      const delta = change !== null ? formatSignedNumber(change, 2) : null
      const pct = changePct !== null ? formatPercentNormalized(changePct, 2) : null
      lines.push(`- last: ${price}${pct ? ` (${pct}${delta ? `, ${delta}` : ''})` : delta ? ` (${delta})` : ''}`)
    }
    const o = toNumber(quote.open)
    const h = toNumber(quote.high)
    const l = toNumber(quote.low)
    const prev = toNumber(quote.prev_close)
    const dayParts: string[] = []
    if (prev !== null) dayParts.push(`prev ${prev.toFixed(2)}`)
    if (o !== null) dayParts.push(`open ${o.toFixed(2)}`)
    if (h !== null && l !== null) dayParts.push(`H/L ${h.toFixed(2)}/${l.toFixed(2)}`)
    if (dayParts.length > 0) lines.push(`- ${dayParts.join(' | ')}`)
    const metaParts: string[] = []
    if (volume !== null) metaParts.push(`vol ${formatCompactNumber(volume)}`)
    if (exchange) metaParts.push(`exch ${exchange}`)
    if (ts) metaParts.push(`ts ${ts}`)
    if (metaParts.length > 0) lines.push(`- ${metaParts.join(' | ')}`)
    if (envelope?.provider) lines.push(`- provider: ${envelope.provider}`)
    return { ok: true, response: lines.join('\n') }
  }

  if (cmd === 'news') {
    const symbol = normalizeSymbol(arg1)
    if (!symbol) return { ok: false, response: 'Usage: `/mkt news <symbol> [limit]`' }
    const limit = arg2 ? Math.max(1, Math.min(10, Math.floor(Number(arg2)))) : 5
    const endDate = isoDateUtcFromMs(Date.now())
    const startDate = isoDateUtcFromMs(Date.now() - 7 * DAY_MS)
    const result = await openbbCompanyNews({ symbol, startDate, endDate, limit })
    if (!result.ok) return { ok: false, response: formatMarketError(result) }

    const envelope = result.data
    const items = asArray<CompanyNewsData>(envelope?.results as any)
    if (items.length === 0) return { ok: true, response: `Company news — ${symbol}\n\nNo recent articles found.` }

    const sorted = [...items].sort((a, b) => {
      const ams = Date.parse(String(a?.date ?? ''))
      const bms = Date.parse(String(b?.date ?? ''))
      return (Number.isFinite(bms) ? bms : 0) - (Number.isFinite(ams) ? ams : 0)
    })

    const lines: string[] = []
    lines.push(`Company news — ${symbol} (top ${Math.min(limit, sorted.length)})`)
    lines.push('')
    sorted.slice(0, limit).forEach((n, idx) => {
      const date = String(n.date ?? '').slice(0, 10)
      const title = truncate(String(n.title ?? 'Untitled'), 120)
      const url = String(n.url ?? '').trim()
      lines.push(`${idx + 1}) ${title}${date ? ` (${date})` : ''}${url ? ` — ${url}` : ''}`)
    })
    if (envelope?.provider) lines.push(`\nprovider: ${envelope.provider}`)
    return { ok: true, response: lines.join('\n') }
  }

  if (cmd === 'ratios') {
    const symbol = normalizeSymbol(arg1)
    if (!symbol) return { ok: false, response: 'Usage: `/mkt ratios <symbol>`' }
    const result = await openbbFinancialRatios({ symbol, limit: 1 })
    if (!result.ok) {
      // Fundamentals often require paid providers; give a more actionable hint.
      if (result.error === 'bad_request' && !isOpenbbConfigured()) {
        return { ok: false, response: formatMarketError(result) }
      }
      if (result.error === 'bad_request') {
        return {
          ok: false,
          response:
            'Fundamental ratios may require provider API keys on the OpenBB server (e.g. FMP or Intrinio). ' +
            `Error: ${truncate(result.message ?? 'bad_request', 160)}`,
        }
      }
      return { ok: false, response: formatMarketError(result) }
    }

    const envelope = result.data
    const row = asArray<FinancialRatiosData>(envelope?.results as any)[0] as any
    if (!row || typeof row !== 'object') return { ok: false, response: `No ratios data returned for ${symbol}.` }

    const pe = pickNumber(row, ['price_to_earnings', 'pe_ratio'])
    const pb = pickNumber(row, ['price_to_book', 'pb_ratio'])
    const ps = pickNumber(row, ['price_to_sales', 'ps_ratio'])
    const peg = pickNumber(row, ['peg_ratio', 'peg'])
    const gross = formatMaybePercent(pickNumber(row, ['gross_profit_margin', 'gross_margin']))
    const op = formatMaybePercent(pickNumber(row, ['operating_profit_margin', 'operating_margin']))
    const net = formatMaybePercent(pickNumber(row, ['net_profit_margin', 'net_margin']))
    const current = pickNumber(row, ['current_ratio'])
    const quick = pickNumber(row, ['quick_ratio'])
    const dte = pickNumber(row, ['debt_to_equity', 'debt_equity_ratio'])
    const roe = formatMaybePercent(pickNumber(row, ['return_on_equity', 'roe']))
    const roa = formatMaybePercent(pickNumber(row, ['return_on_assets', 'roa']))

    const periodEnding = typeof row.period_ending === 'string' ? row.period_ending : null
    const lines: string[] = []
    lines.push(`Financial ratios — ${symbol}${periodEnding ? ` (period ending ${String(periodEnding).slice(0, 10)})` : ''}`)
    const valuationParts: string[] = []
    if (pe !== null) valuationParts.push(`P/E ${pe.toFixed(2)}`)
    if (pb !== null) valuationParts.push(`P/B ${pb.toFixed(2)}`)
    if (ps !== null) valuationParts.push(`P/S ${ps.toFixed(2)}`)
    if (peg !== null) valuationParts.push(`PEG ${peg.toFixed(2)}`)
    if (valuationParts.length > 0) lines.push(`- valuation: ${valuationParts.join(' | ')}`)

    const marginParts: string[] = []
    if (gross) marginParts.push(`gross ${gross}`)
    if (op) marginParts.push(`op ${op}`)
    if (net) marginParts.push(`net ${net}`)
    if (marginParts.length > 0) lines.push(`- margins: ${marginParts.join(' | ')}`)

    const balanceParts: string[] = []
    if (current !== null) balanceParts.push(`current ${current.toFixed(2)}`)
    if (quick !== null) balanceParts.push(`quick ${quick.toFixed(2)}`)
    if (dte !== null) balanceParts.push(`D/E ${dte.toFixed(2)}`)
    if (roe) balanceParts.push(`ROE ${roe}`)
    if (roa) balanceParts.push(`ROA ${roa}`)
    if (balanceParts.length > 0) lines.push(`- balance: ${balanceParts.join(' | ')}`)

    if (valuationParts.length === 0 && marginParts.length === 0 && balanceParts.length === 0) {
      const keys = Object.keys(row).slice(0, 20).join(', ')
      lines.push(`- note: ratios fetched but no known fields matched (keys: ${keys}${Object.keys(row).length > 20 ? ', …' : ''})`)
    }
    if (envelope?.provider) lines.push(`- provider: ${envelope.provider}`)
    return { ok: true, response: lines.join('\n') }
  }

  if (cmd === 'calendar') {
    const range = resolveCalendarRange(arg1)
    if ('error' in range) return { ok: false, response: range.error }
    const result = await openbbEconomicCalendar({ startDate: range.startDate, endDate: range.endDate })
    if (!result.ok) return { ok: false, response: formatMarketError(result) }

    const envelope = result.data
    const items = asArray<EconomicCalendarData>(envelope?.results as any)
    if (items.length === 0) {
      return {
        ok: true,
        response: `Macro calendar (${range.startDate}..${range.endDate})\n\nNo events found.`,
      }
    }

    const toMs = (d: unknown) => {
      const ms = Date.parse(String(d ?? ''))
      return Number.isFinite(ms) ? ms : 0
    }
    const sorted = [...items].sort((a, b) => toMs(a.date) - toMs(b.date))
    const highs = sorted.filter((e) => String(e.importance ?? '').toLowerCase().includes('high'))
    const pick = highs.length > 0 ? highs : sorted

    const lines: string[] = []
    lines.push(`Macro calendar (${range.startDate}..${range.endDate})`)
    lines.push('')
    pick.slice(0, 10).forEach((e) => {
      const date = String(e.date ?? '').replace('T', ' ').slice(0, 16)
      const country = String(e.country ?? '').trim()
      const event = String(e.event ?? '').trim()
      const importance = String(e.importance ?? '').trim()
      const actual = formatCalendarValue(e.actual, e.unit)
      const consensus = formatCalendarValue(e.consensus, e.unit)
      const previous = formatCalendarValue(e.previous, e.unit)
      const stats = [
        actual ? `actual ${actual}` : null,
        consensus ? `cons ${consensus}` : null,
        previous ? `prev ${previous}` : null,
      ].filter(Boolean)

      const left = `${date || 'date?'}${country ? ` ${country}` : ''} — ${event || 'event'}${importance ? ` (${importance})` : ''}`
      lines.push(`- ${left}${stats.length > 0 ? ` — ${stats.join(', ')}` : ''}`)
    })
    if (envelope?.provider) lines.push(`\nprovider: ${envelope.provider}`)
    return { ok: true, response: lines.join('\n') }
  }

  if (cmd === 'chart') {
    const symbol = normalizeSymbol(arg1)
    if (!symbol) return { ok: false, response: 'Usage: `/mkt chart <symbol> [1w|1m|3m|1y|YYYY-MM-DD..YYYY-MM-DD]`' }
    const range = resolveChartRange(arg2)
    if ('error' in range) return { ok: false, response: range.error }
    const result = await openbbEquityHistorical({
      symbol,
      startDate: range.startDate,
      endDate: range.endDate,
      interval: '1d',
    })
    if (!result.ok) return { ok: false, response: formatMarketError(result) }

    const envelope = result.data
    const points = asArray<EquityHistoricalData>(envelope?.results as any)
      .filter((p) => p && typeof p === 'object')
      .slice()

    if (points.length < 2) {
      return { ok: true, response: `Chart — ${symbol} (${range.label})\n\nNot enough data returned.` }
    }

    const toMs = (d: string) => {
      const ms = Date.parse(String(d ?? ''))
      return Number.isFinite(ms) ? ms : 0
    }
    points.sort((a, b) => toMs(a.date) - toMs(b.date))
    const first = points[0]!
    const last = points[points.length - 1]!
    const firstClose = toNumber(first.close)
    const lastClose = toNumber(last.close)
    const pct =
      firstClose !== null && lastClose !== null && firstClose !== 0
        ? ((lastClose - firstClose) / firstClose) * 100
        : null

    let minLow: number | null = null
    let maxHigh: number | null = null
    for (const p of points) {
      const lo = toNumber(p.low)
      const hi = toNumber(p.high)
      if (lo !== null) minLow = minLow === null ? lo : Math.min(minLow, lo)
      if (hi !== null) maxHigh = maxHigh === null ? hi : Math.max(maxHigh, hi)
    }

    const lines: string[] = []
    lines.push(`Chart — ${symbol} (${range.label})`)
    lines.push(`- points: ${points.length} | ${String(first.date).slice(0, 10)} → ${String(last.date).slice(0, 10)}`)
    if (firstClose !== null && lastClose !== null) {
      lines.push(
        `- close: ${firstClose.toFixed(2)} → ${lastClose.toFixed(2)}${pct !== null ? ` (${formatSignedNumber(pct, 2)}%)` : ''}`,
      )
    }
    if (maxHigh !== null && minLow !== null) {
      lines.push(`- range: high ${maxHigh.toFixed(2)} | low ${minLow.toFixed(2)}`)
    }
    if (envelope?.provider) lines.push(`- provider: ${envelope.provider}`)
    return { ok: true, response: lines.join('\n') }
  }

  return {
    ok: false,
    response: formatNumberedCommandFallback({
      intro: 'Unknown /mkt command. Try `/mkt help`.',
    }),
  }
}

export async function handleKeeprCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
}): Promise<KeeprCommandResult> {
  const raw = (params.text ?? '').trim()
  try {

    // Global aliases: /help and "help" should always respond (even without DB/vault config).
    const rawLower = raw.toLowerCase()
    if (rawLower === '/help' || rawLower === 'help') {
      return { ok: true, response: formatKeeprHelp() }
    }

  // Identity lookup commands should work without vault config/DB.
  const looksLikeWhois = rawLower.startsWith('/whois') || rawLower === 'whois' || rawLower.startsWith('whois ')
  if (looksLikeWhois) {
    return handleWhoisCommand({ text: raw })
  }

  // AI commands should work even when vault config/DB is unavailable.
  const looksLikeAi =
    rawLower.startsWith('/ai') ||
    rawLower.startsWith('@keepr') ||
    rawLower.startsWith('@bot')
  if (looksLikeAi) {
    const aiText = raw.replace(/^\/?ai\s*/i, '').replace(/^@(keepr|bot)\s*/i, '').trim()
    if (!aiText) {
      return { ok: true, response: 'Ask me anything about this vault or DeFi on Base.' }
    }
    const v = await getKeeprVaultByGroupId(params.groupId)
    return generateLlmResponse({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: aiText,
      vault: v,
    })
  }

  // Market data commands should work even when vault config/DB is unavailable.
  if (isMarketCommand(rawLower)) {
    return handleMarketCommand(raw)
  }

  // Handle Farcaster commands (/fc or fc)
  const looksLikeFc = raw.toLowerCase().startsWith('/fc') || raw.toLowerCase().startsWith('fc ')
  if (looksLikeFc) {
    // Determine role for Farcaster commands
    const v = await getKeeprVaultByGroupId(params.groupId)
    let role: KeeprRole = 'MEMBER'
    if (v) {
      const owner = v.canonicalOwnerAddress
      const admins = Array.isArray(v.config?.roles?.admins) ? v.config.roles.admins : []
      const adminsLc = admins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
      role = roleForWallet({ wallet: params.senderWallet, owner, admins: adminsLc })
    }
    return handleFarcasterCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      role,
    })
  }

  const looksLikeBankr = raw.toLowerCase().startsWith('/bankr') || raw.toLowerCase().startsWith('bankr ')
  if (looksLikeBankr) {
    const v = await getKeeprVaultByGroupId(params.groupId)
    let role: KeeprRole = 'MEMBER'
    let canonicalOwnerAddress: string | null = null
    if (v) {
      const owner = v.canonicalOwnerAddress
      const admins = Array.isArray(v.config?.roles?.admins) ? v.config.roles.admins : []
      const adminsLc = admins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
      role = roleForWallet({ wallet: params.senderWallet, owner, admins: adminsLc })
      canonicalOwnerAddress = owner
    }
    return handleBankrCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      role,
      canonicalOwnerAddress,
    })
  }

  // Handle /send command
  const looksLikeSend = raw.toLowerCase().startsWith('/send') || raw.toLowerCase().startsWith('send ')
  if (looksLikeSend) {
    const sv = await getKeeprVaultByGroupId(params.groupId)
    if (!sv) return { ok: false, response: 'Vault not configured. /send requires a connected vault.' }
    const sOwner = sv.canonicalOwnerAddress
    const sAdmins = Array.isArray(sv.config?.roles?.admins) ? sv.config.roles.admins : []
    const sAdminsLc = sAdmins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
    const sRole = roleForWallet({ wallet: params.senderWallet, owner: sOwner, admins: sAdminsLc })
    return handleSendCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      role: sRole,
      vault: sv,
    })
  }

  // Handle /coin command (Zora Coins)
  const looksLikeCoin = raw.toLowerCase().startsWith('/coin') || raw.toLowerCase().startsWith('coin ')
  if (looksLikeCoin) {
    const cv = await getKeeprVaultByGroupId(params.groupId)
    if (!cv) return { ok: false, response: 'Vault not configured. /coin requires a connected vault.' }
    const cOwner = cv.canonicalOwnerAddress
    const cAdmins = Array.isArray(cv.config?.roles?.admins) ? cv.config.roles.admins : []
    const cAdminsLc = cAdmins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
    const cRole = roleForWallet({ wallet: params.senderWallet, owner: cOwner, admins: cAdminsLc })
    return handleCoinCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      role: cRole,
      vault: cv,
    })
  }

  const v = await getKeeprVaultByGroupId(params.groupId)
  if (!v) {
    // Allow basic commands to explain next steps even if not configured.
    const raw0 = raw.toLowerCase()
    const looksLikeKeepr = raw0.startsWith('/keepr') || raw0.startsWith('keepr')
    const parts0 = raw0.split(/\s+/g).filter(Boolean)
    const cmd0 = looksLikeKeepr ? (parts0[1] ?? 'help') : ''
    if (cmd0 === 'help') {
      return { ok: true, response: formatKeeprHelp() }
    }
    if (cmd0 === 'status') {
      return { ok: true, response: formatVaultStatus(null) }
    }
    if (cmd0 === 'rules') {
      return {
        ok: true,
        response: [
          'Keepr rules',
          '',
          '- configured: no',
          '- next: ask the creator to connect this group in 4626',
        ].join('\n'),
      }
    }
    return {
      ok: false,
      response: formatNumberedCommandFallback({
        intro: 'Keepr is not configured for this group.',
        includeHint: 'Ask the creator to connect this group in 4626.',
      }),
    }
  }

  const owner = v.canonicalOwnerAddress
  const admins = Array.isArray(v.config?.roles?.admins) ? v.config.roles.admins : []
  const adminsLc = admins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
  const role = roleForWallet({ wallet: params.senderWallet, owner, admins: adminsLc })

  const prefix = raw.toLowerCase().startsWith('/keepr') ? '/keepr' : raw.toLowerCase().startsWith('keepr') ? 'keepr' : null
  if (!prefix) {
    // Check for /ai, @keepr, or @bot → LLM response
    const looksLikeAi =
      raw.toLowerCase().startsWith('/ai') ||
      raw.toLowerCase().startsWith('@keepr') ||
      raw.toLowerCase().startsWith('@bot')
    if (looksLikeAi) {
      const aiText = raw.replace(/^\/?ai\s*/i, '').replace(/^@(keepr|bot)\s*/i, '').trim()
      if (aiText) {
        const llmResult = await generateLlmResponse({
          groupId: params.groupId,
          senderWallet: params.senderWallet,
          text: aiText,
          vault: v,
        })
        if (llmResult.ok) return llmResult
      }
    }
    return { ok: false, response: '' }
  }
  const parts = raw.split(/\s+/g).filter(Boolean)
  const cmd = parts[0]?.toLowerCase() === prefix ? (parts[1] ? String(parts[1]).toLowerCase() : 'help') : 'help'
  const arg = parts[0]?.toLowerCase() === prefix ? (parts[2] ? String(parts[2]) : null) : null

  if (cmd === 'help') {
    return {
      ok: true,
      response: formatKeeprHelp(),
    }
  }

  if (cmd === 'status') {
    return { ok: true, response: formatVaultStatus(v) }
  }

  if (cmd === 'rules') {
    return {
      ok: true,
      response: [
        'Keepr rules',
        '',
        '- joins:',
        '  - locked: ' + String(v.joinLocked),
        '- gating:',
        '  - enabled: ' + String(v.gatingEnabled),
        '  - mode: ' + String(v.gatingMode),
        '  - minShares: ' + String(v.minShares ?? 'n/a'),
        '  - failClosed: ' + String(v.failClosed),
      ].join('\n'),
    }
  }

  if (cmd === 'lock' || cmd === 'unlock') {
    if (role !== 'OWNER') {
      return { ok: false, response: 'Denied: OWNER only.' }
    }
    const joinLocked = cmd === 'lock'
    await setKeeprJoinLocked({ vaultAddress: v.vaultAddress, joinLocked, actorWallet: params.senderWallet })
    return {
      ok: true,
      response: joinLocked ? 'Joins locked.' : 'Joins unlocked.',
      action: {
        action: joinLocked ? 'keepr.vault.lock' : 'keepr.vault.unlock',
        vaultAddress: v.vaultAddress,
        groupId: v.groupId,
        reason: 'owner_command',
        evidence: { actor: params.senderWallet },
      },
    }
  }

  if (cmd === 'check') {
    const targetWallet = arg && isAddressLike(arg) ? (arg.toLowerCase() as Address) : params.senderWallet
    if (arg && targetWallet !== params.senderWallet && role === 'MEMBER') {
      return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
    }

    if (!v.gatingEnabled || v.gatingMode === 'none') {
      return { ok: true, response: 'Eligible: yes\n- reason: gating_disabled' }
    }

    if (v.gatingMode !== 'shares') {
      return { ok: false, response: 'Unsupported gating mode.' }
    }

    const shareToken = v.shareTokenAddress
    const minShares = v.minShares
      ? (() => {
          try {
            return BigInt(v.minShares)
          } catch {
            return null
          }
        })()
      : null

    if (!shareToken || !minShares) {
      return { ok: false, response: 'Misconfigured: missing share token or minShares.' }
    }

    const r = await checkSharesEligibility({ wallet: targetWallet, shareToken, minShares })
    const eligible = r.eligible ? 'yes' : 'no'
    return {
      ok: true,
      response: [
        `Eligible: ${eligible}`,
        `- wallet: ${targetWallet}`,
        `- reason: ${r.reason}`,
        `- shareBalance: ${r.evidence.shareBalance}`,
        `- threshold: ${r.evidence.threshold}`,
        `- blockNumber: ${r.evidence.blockNumber ?? 'n/a'}`,
      ].join('\n'),
    }
  }

  if (cmd === 'sync') {
    if (role === 'MEMBER') {
      return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
    }
    // The long-lived Keepr runtime performs sync (group.members -> check -> remove).
    return { ok: true, response: 'Sync requested. The Keepr runtime will process this shortly.' }
  }

    return {
      ok: false,
      response: formatNumberedCommandFallback({
        intro: 'Unknown command. Try `/keepr help`.',
      }),
    }
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'Keepr command failed')
    return {
      ok: false,
      response: toUserFacingAgentErrorMessage(agentError),
    }
  }
}
