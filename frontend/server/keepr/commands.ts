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
import { handleTwitterCommand } from '../twitter/commands.js'
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

type KeeprHelpTopic = 'quick' | 'all' | 'core' | 'coin' | 'market' | 'social' | 'ops' | 'bankr' | 'wallet'

function formatKeeprHelpTopics(): string[] {
  return [
    'Need more?',
    '- /help core | coin | market | social | ops | bankr | wallet',
    '- /help all — full command list',
  ]
}

function formatKeeprHelpFull(): string {
  return [
    '<b>Keepr — Full Command Guide</b>',
    '',
    '<blockquote>Use <code>/help</code> for the short version, or <code>/help &lt;topic&gt;</code> for focused help.</blockquote>',
    '',
    '<u>Start here</u>',
    '<code>/help</code> — show the command list',
    '<code>/keepr status</code> — view vault status and config',
    '<code>/ai &lt;question&gt;</code> — ask Keepr in plain English',
    '',
    '<u>Core Keepr</u>',
    '<code>keepr help</code> — show Keepr help',
    '<code>keepr status</code> — view current vault status',
    '<code>keepr rules</code> — show active operating rules',
    '<code>keepr check</code> — run a vault health check',
    '<code>keepr check 0x...</code> — inspect a specific address <i>(ADMIN/OWNER)</i>',
    '<code>keepr lock</code> — lock vault actions <i>(OWNER)</i>',
    '<code>keepr unlock</code> — unlock vault actions <i>(OWNER)</i>',
    '<code>keepr sync</code> — sync vault state and config <i>(ADMIN/OWNER)</i>',
    '',
    '<u>Transfers</u>',
    '<code>/send &lt;amount&gt; USDC to &lt;address&gt;</code> — send USDC <i>(ADMIN/OWNER)</i>',
    '<code>/send &lt;amount&gt; ETH to &lt;address&gt;</code> — send ETH <i>(ADMIN/OWNER)</i>',
    '<blockquote>Example: <code>/send 25 USDC to 0xabc...123</code></blockquote>',
    '',
    '<u>Zora Coin</u>',
    '<code>/coin help</code> — show all coin commands',
    '<code>/coin create &lt;name&gt; &lt;symbol&gt; &lt;uri&gt;</code> — create a Content Coin',
    '<code>/coin buy &lt;address&gt; &lt;eth-amount&gt;</code> — buy a coin with ETH',
    '<code>/coin sell &lt;address&gt; &lt;amount&gt;</code> — sell a coin for ETH',
    '<code>/coin balance</code> — view agent wallet balance',
    '<code>/coin info &lt;address&gt;</code> — view coin details',
    '<code>/coin trend check &lt;ticker&gt;</code> — run trend preflight checks',
    '<code>/coin trend reserve &lt;ticker&gt;</code> — deploy a trend coin',
    '<code>/coin trend status &lt;ticker&gt;</code> — view trend operation status',
    '<code>/coin trend funnel &lt;ticker&gt; &lt;eth-amount&gt;</code> — run guarded flywheel action',
    '<blockquote><b>Create requirements</b>\nname: 1–24 chars\nsymbol: 2–6 chars\nuri: full <code>https://...</code> URL</blockquote>',
    '',
    '<u>AI</u>',
    '<code>/ai &lt;question&gt;</code> — ask the vault assistant',
    '<code>@keepr &lt;question&gt;</code> — same as <code>/ai</code> in chat',
    '<blockquote>Example: <code>/ai what changed in vault health today?</code></blockquote>',
    '',
    '<u>Market Data</u>',
    '<code>/mkt quote &lt;symbol&gt;</code> — latest quote',
    '<code>/mkt news &lt;symbol&gt; [limit]</code> — recent headlines',
    '<code>/mkt ratios &lt;symbol&gt;</code> — fundamentals ratios',
    '<code>/mkt calendar [today|week|YYYY-MM-DD..YYYY-MM-DD]</code> — macro event calendar',
    '<code>/mkt chart &lt;symbol&gt; &lt;range&gt;</code> — price history summary',
    '<blockquote>Ranges: <code>1w</code>, <code>1m</code>, <code>3m</code>, <code>1y</code>, or <code>YYYY-MM-DD..YYYY-MM-DD</code></blockquote>',
    '',
    '<u>X / Twitter</u>',
    '<code>/x help</code> — show all X commands',
    '<code>/x status</code> — check X integration status',
    '<code>/x post &lt;message&gt; --confirm</code> — publish a post <i>(ADMIN/OWNER)</i>',
    '<code>/tweet &lt;message&gt; --confirm</code> — alias for posting <i>(ADMIN/OWNER)</i>',
    '',
    '<u>CRE Keeper</u>',
    '<code>/cre help</code> — show CRE commands',
    '<code>/cre status</code> — view vault keeper states',
    '<code>/cre auction</code> — view CCA auction states',
    '<code>/cre solana</code> — Solana price and health',
    '<code>/cre health</code> — combined health check',
    '<code>/cre tend vault</code> — deploy idle funds',
    '<code>/cre report vault</code> — harvest yields',
    '<code>/cre flush-fees</code> — flush Solana fees',
    '',
    '<u>Bankr</u>',
    '<code>/bankr status</code> — show Bankr status',
    '<code>/bankr me</code> — show your Bankr profile',
    '<code>/bankr balances base,solana</code> — check balances by chain',
    '<code>/bankr ask &lt;question&gt;</code> — ask Bankr',
    '<code>/bankr exec &lt;instruction&gt; --confirm</code> — execute an instruction <i>(ADMIN/OWNER)</i>',
    '',
    '<u>Wallet &amp; Reputation</u>',
    '<code>/whois &lt;address&gt;</code> — resolve ENS / Basename identity',
    '<code>/intel &lt;address&gt;</code> — wallet intelligence report',
    '<code>/reputation &lt;agentId&gt;</code> — ERC-8004 reputation graph',
    '<code>/feedback &lt;agentId&gt;</code> — feedback summary',
    '',
    '<u>Permissions</u>',
    '<blockquote><b>OWNER</b> — highest privilege\n<b>ADMIN</b> — management actions\nSome commands are restricted and will fail without the required role.</blockquote>',
    '',
    '<u>Help by topic</u>',
    '<code>/help coin</code> — Zora Coin commands',
    '<code>/help mkt</code> — market data commands',
    '<code>/help x</code> — X / Twitter commands',
    '<code>/help cre</code> — CRE Keeper commands',
    '<code>/help bankr</code> — Bankr commands',
    '',
    '<blockquote>Tip: keep the short help in group chats, and use the full help in DMs or private admin flows.</blockquote>',
  ].join('\n');
}

function formatKeeprQuickHelp(unknownTopic: string | null = null): string {
  const lines: string[] = ['Keepr quick help', '']
  if (unknownTopic) {
    lines.push(`Unknown help topic: ${unknownTopic}`)
    lines.push('')
  }
  lines.push(
    'Start here (30 seconds):',
    '',
    '1) /link — connect Telegram to your wallet',
    '2) /buy | /sell | /bid — pick vault -> size -> Accept',
    '3) /portfolio — check your positions',
    '',
    'Most used:',
    '- /keepr status — vault status and config',
    '- /ai <question> — ask in plain English',
    '- /mkt quote <symbol>',
    '- /coin trend check <ticker>',
    '- /x post <message> --confirm (ADMIN/OWNER)',
    '  ↳ symbol example: BTC',
    '',
    ...formatKeeprHelpTopics(),
  )
  return lines.join('\n')
}

function resolveKeeprHelpTopic(rawTopic: string | null | undefined): { topic: KeeprHelpTopic; unknownTopic: string | null } {
  const token = String(rawTopic ?? '').trim().toLowerCase().split(/\s+/g)[0] ?? ''
  if (!token) return { topic: 'quick', unknownTopic: null }

  switch (token) {
    case 'quick':
    case 'start':
    case 'starter':
      return { topic: 'quick', unknownTopic: null }
    case 'all':
    case 'full':
    case 'everything':
    case 'commands':
      return { topic: 'all', unknownTopic: null }
    case 'core':
    case 'vault':
      return { topic: 'core', unknownTopic: null }
    case 'coin':
    case 'coins':
    case 'zora':
      return { topic: 'coin', unknownTopic: null }
    case 'market':
    case 'mkt':
      return { topic: 'market', unknownTopic: null }
    case 'social':
    case 'x':
    case 'twitter':
      return { topic: 'social', unknownTopic: null }
    case 'ops':
    case 'cre':
    case 'keeper':
      return { topic: 'ops', unknownTopic: null }
    case 'bankr':
      return { topic: 'bankr', unknownTopic: null }
    case 'wallet':
    case 'identity':
    case 'reputation':
      return { topic: 'wallet', unknownTopic: null }
    default:
      return { topic: 'quick', unknownTopic: token }
  }
}

function formatKeeprHelp(rawTopic: string | null = null): string {
  const { topic, unknownTopic } = resolveKeeprHelpTopic(rawTopic)
  if (topic === 'all') return formatKeeprHelpFull()
  if (topic === 'quick') return formatKeeprQuickHelp(unknownTopic)

  if (topic === 'core') {
    return [
      'Keepr help - core',
      '',
      '- /keepr status',
      '- /keepr rules',
      '- /keepr check',
      '- /keepr check 0x... (ADMIN/OWNER)',
      '- /keepr lock (OWNER)',
      '- /keepr unlock (OWNER)',
      '- /keepr sync (ADMIN/OWNER)',
      '',
      'Need everything? /help all',
    ].join('\n')
  }

  if (topic === 'coin') {
    return [
      'Keepr help - coin',
      '',
      '- /coin create <name> <symbol> <uri>',
      '- /coin buy <address> <eth-amount>',
      '- /coin sell <address> <amount>',
      '- /coin balance',
      '- /coin info <address>',
      '- /coin trend check <ticker>',
      '- /coin trend reserve <ticker>',
      '- /coin trend status <ticker>',
      '- /coin trend funnel <ticker> [eth-amount]',
      '',
      'Need everything? /help all',
    ].join('\n')
  }

  if (topic === 'market') {
    return [
      'Keepr help - market',
      '',
      '- /mkt quote <symbol>',
      '- /mkt news <symbol> [limit]',
      '- /mkt ratios <symbol>',
      '- /mkt calendar [today|week|YYYY-MM-DD..YYYY-MM-DD]',
      '- /mkt chart <symbol> [1w|1m|3m|1y|YYYY-MM-DD..YYYY-MM-DD]',
      '',
      'Need everything? /help all',
    ].join('\n')
  }

  if (topic === 'social') {
    return [
      'Keepr help - social',
      '',
      '- /x status',
      '- /x post <message> --confirm (ADMIN/OWNER)',
      '- /tweet <message> --confirm (ADMIN/OWNER)',
      '',
      'Need everything? /help all',
    ].join('\n')
  }

  if (topic === 'ops') {
    return [
      'Keepr help - ops',
      '',
      '- /cre status',
      '- /cre auction',
      '- /cre solana',
      '- /cre health',
      '- /cre tend [vault]',
      '- /cre report [vault]',
      '- /cre flush-fees',
      '',
      'Need everything? /help all',
    ].join('\n')
  }

  if (topic === 'bankr') {
    return [
      'Keepr help - bankr',
      '',
      '- /bankr status',
      '- /bankr me',
      '- /bankr balances [base,solana]',
      '- /bankr ask <question>',
      '- /bankr exec <instruction> --confirm (ADMIN/OWNER)',
      '',
      'Need everything? /help all',
    ].join('\n')
  }

  return [
    'Keepr help - wallet',
    '',
    '- /send <amount> USDC to <address> (ADMIN/OWNER)',
    '- /send <amount> ETH to <address> (ADMIN/OWNER)',
    '- /whois <address>',
    '- /intel <address>',
    '- /reputation [agentId]',
    '- /feedback [agentId]',
    '',
    'Need everything? /help all',
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
    return { error: 'Usage: /mkt calendar [today|week|YYYY-MM-DD..YYYY-MM-DD]' }
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
    return { error: 'Usage: /mkt chart <symbol> [1w|1m|3m|1y|YYYY-MM-DD..YYYY-MM-DD]' }
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
    if (!symbol) return { ok: false, response: 'Usage: /mkt quote <symbol>' }
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
    if (!symbol) return { ok: false, response: 'Usage: /mkt news <symbol> [limit]' }
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
    if (!symbol) return { ok: false, response: 'Usage: /mkt ratios <symbol>' }
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
    if (!symbol) return { ok: false, response: 'Usage: /mkt chart <symbol> [1w|1m|3m|1y|YYYY-MM-DD..YYYY-MM-DD]' }
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
      intro: 'Unknown /mkt command. Try /mkt help.',
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
    const globalHelpMatch = raw.match(/^\/?help(?:\s+(\S+))?\s*$/i)
    if (globalHelpMatch) {
      return { ok: true, response: formatKeeprHelp(globalHelpMatch[1] ?? null) }
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

  // Handle Twitter/X commands (/x, x, /tweet, tweet)
  const looksLikeX = /^(\/x|x)(\s|$)/.test(rawLower) || /^(\/tweet|tweet)(\s|$)/.test(rawLower)
  if (looksLikeX) {
    const v = await getKeeprVaultByGroupId(params.groupId)
    let role: KeeprRole = 'MEMBER'
    if (v) {
      const owner = v.canonicalOwnerAddress
      const admins = Array.isArray(v.config?.roles?.admins) ? v.config.roles.admins : []
      const adminsLc = admins.filter(isAddressLike).map((a) => a.toLowerCase() as Address)
      role = roleForWallet({ wallet: params.senderWallet, owner, admins: adminsLc })
    }
    return handleTwitterCommand({
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
    const arg0 = looksLikeKeepr ? (parts0[2] ? String(parts0[2]) : null) : null
    if (cmd0 === 'help') {
      return { ok: true, response: formatKeeprHelp(arg0) }
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
      response: formatKeeprHelp(arg),
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
        intro: 'Unknown command. Try /keepr help.',
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
