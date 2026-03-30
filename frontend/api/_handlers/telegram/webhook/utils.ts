import type { VercelRequest } from '@vercel/node'
import { formatUnits } from 'viem'

import {
  getCommandHead as getSharedCommandHead,
  isKnownTelegramCommandHead,
  matchesCommandFamily,
} from '../../../../server/commands/registry.js'
import { SUPPORTED_METADATA_URI_PREFIXES, TELEGRAM_COMMAND_HEADS_PATTERN, TELEGRAM_COMMAND_MICRO_HINTS } from './constants.js'

export function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeTelegramMenuButtonText(value: unknown, fallbackValue = ''): string {
  const trimmed = asTrimmed(value)
  if (!trimmed) return fallbackValue

  const withoutVersion = trimmed.replace(/\b(4626(?:\.fun)?)\s+v\d+\b/gi, '$1')
  if (/^open(?:\s+4626(?:\.fun)?)?$/i.test(withoutVersion)) {
    return 'Connect'
  }
  return withoutVersion
}

export function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  const raw = asTrimmed(value).toLowerCase()
  if (!raw) return defaultValue
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return defaultValue
}

export function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function parseJsonObject(raw: string | undefined): Record<string, unknown> {
  const source = asTrimmed(raw ?? '')
  if (!source) return {}
  try {
    const parsed = JSON.parse(source) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function parseOptionalPositiveInteger(value: unknown): number | null {
  const raw = asTrimmed(value)
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export function readTelegramUserId(value: unknown): string | null {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : asTrimmed(value)
  if (!/^\d+$/.test(raw)) return null
  return raw
}

export function readTelegramChatId(value: unknown): string | null {
  const raw = typeof value === 'number' ? String(Math.trunc(value)) : asTrimmed(value)
  if (!/^-?\d+$/.test(raw)) return null
  return raw
}

export function resolveTelegramLinkErrorStatusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (lower.includes('privy') || lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('jwt')) {
    return 401
  }
  if (lower.includes('canonical') || lower.includes('no privy')) {
    return 409
  }
  if (lower.includes('recovery required')) {
    return 409
  }
  if (lower.includes('not configured')) return 503
  return 500
}

export function readQueryString(req: Pick<VercelRequest, 'query'>, key: string): string | null {
  const value = req.query?.[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim()
  return null
}

export function parseWindowHours(raw: string | null, fallback = 24): number {
  const parsed = Number(raw ?? '')
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export function parseDelimitedSet(value: string): Set<string> {
  return new Set(
    value
      .split(/[\s,]+/g)
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

export function splitTelegramMessage(text: string, maxLen = 3500): string[] {
  const value = asTrimmed(text)
  if (!value) return []
  if (value.length <= maxLen) return [value]

  const parts: string[] = []
  let cursor = 0
  while (cursor < value.length) {
    const end = Math.min(cursor + maxLen, value.length)
    parts.push(value.slice(cursor, end))
    cursor = end
  }
  return parts
}

export function isTwitterCommand(rawText: string): boolean {
  return matchesCommandFamily(rawText, 'twitter')
}

export function isHelpCommand(rawText: string): boolean {
  const text = asTrimmed(rawText)
  return /^\/?help(?:\s+\S+)?\s*$/i.test(text) || /^\/?keepr\s+help(?:\s+\S+)?\s*$/i.test(text)
}

export function isHelpCategoryCommand(rawText: string): boolean {
  const text = asTrimmed(rawText)
  return /^\/?help\s+\S+\s*$/i.test(text) || /^\/?keepr\s+help\s+\S+\s*$/i.test(text)
}

export function wrapCommandListingsWithBackticks(text: string): string {
  const splitCommandSuffix = (command: string): { commandPart: string; suffix: string } => {
    const separators = [' — ', ' – ', ' - ', ' | ', ' -> ']
    let hitIndex = -1
    for (const separator of separators) {
      const idx = command.indexOf(separator)
      if (idx > 0 && (hitIndex < 0 || idx < hitIndex)) {
        hitIndex = idx
      }
    }
    if (hitIndex <= 0) return { commandPart: command, suffix: '' }
    return {
      commandPart: command.slice(0, hitIndex).trimEnd(),
      suffix: command.slice(hitIndex),
    }
  }

  const formatCommandForBackticks = (rawCommand: string): string => {
    const command = asTrimmed(rawCommand)
    if (!command || command.includes('`')) return command
    const { commandPart, suffix } = splitCommandSuffix(command)
    const tokens = commandPart.split(/\s+/g).filter(Boolean)
    if (tokens.length === 0) return command

    const hasPlaceholder = tokens.some((token) => /^<[^>]+>$/.test(token) || /^\$<[^>]+>$/.test(token))
    if (!hasPlaceholder) return `\`${commandPart}\`${suffix}`

    const head: string[] = []
    for (const token of tokens) {
      if (head.length === 0) {
        head.push(token)
        continue
      }
      if (/^<[^>]+>$/.test(token) || /^\$<[^>]+>$/.test(token)) break
      if (/^--/.test(token)) break
      if (/^0x[a-fA-F0-9]{6,}$/.test(token)) break
      if (/^\d+(?:\.\d+)?$/.test(token)) break
      if (/^\$\d+(?:\.\d+)?$/.test(token)) break
      if (head.length >= 2) break
      head.push(token)
    }

    const remainder = tokens.slice(head.length).join(' ')
    if (head.length === 0) return `\`${commandPart}\`${suffix}`
    const formatted = remainder ? `\`${head.join(' ')}\` ${remainder}` : `\`${head.join(' ')}\``
    return `${formatted}${suffix}`
  }

  const bulletCommandPattern = new RegExp(`^(\\s*[-*]\\s*)(\\/(?:${TELEGRAM_COMMAND_HEADS_PATTERN})\\b.*)$`, 'i')
  const commandAfterColonPattern = new RegExp(`^(.*?:\\s+)(\\/(?:${TELEGRAM_COMMAND_HEADS_PATTERN})\\b.*)$`, 'i')
  const inlineCommandPattern = new RegExp(
    `(^|\\s)(\\/(?:${TELEGRAM_COMMAND_HEADS_PATTERN})\\b(?:\\s+[a-z0-9_<>$:./-]+(?:\\s+[a-z0-9_<>$:./-]+)*)?)`,
    'gi',
  )

  return text
    .split('\n')
    .map((line) => {
      if (!line || line.includes('`')) return line
      const bulletMatch = line.match(bulletCommandPattern)
      if (bulletMatch) {
        return `${bulletMatch[1]}${formatCommandForBackticks(bulletMatch[2])}`
      }
      const colonMatch = line.match(commandAfterColonPattern)
      if (colonMatch) {
        return `${colonMatch[1]}${formatCommandForBackticks(colonMatch[2])}`
      }
      return line.replace(inlineCommandPattern, (_full, prefix: string, cmd: string) => {
        return `${prefix}${formatCommandForBackticks(String(cmd))}`
      })
    })
    .join('\n')
}

export function appendCommandMicroHints(text: string): string {
  const lines = text.split('\n')
  const nextLines = lines.slice(1)
  const output: string[] = []
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx] ?? ''
    output.push(line)
    if (!line) continue
    const nextLine = nextLines[idx] ?? ''
    if (nextLine.includes('↳')) continue
    for (const rule of TELEGRAM_COMMAND_MICRO_HINTS) {
      if (rule.pattern.test(line)) {
        output.push(`  ↳ ${rule.hint}`)
        break
      }
    }
  }
  return output.join('\n')
}

export function tokenizeTelegramCommand(rawText: string): string[] {
  const raw = asTrimmed(rawText)
  const tokenized: string[] = []
  const regex = /"([^"]+)"|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    tokenized.push(asTrimmed(match[1] ?? match[2] ?? ''))
  }
  return tokenized.filter(Boolean)
}

export function normalizeDeploySymbol(raw: string): string {
  return asTrimmed(raw).toUpperCase()
}

export function isSupportedMetadataUri(raw: string): boolean {
  const uri = asTrimmed(raw)
  if (!uri) return false
  return SUPPORTED_METADATA_URI_PREFIXES.some((prefix) => uri.startsWith(prefix))
}

export function buildDefaultCoinMetadataUri(params: { coinType: 'content' | 'creator'; name: string; symbol: string }): string {
  const payload = {
    name: params.name,
    symbol: params.symbol,
    description: `${params.name} (${params.symbol}) launched via 4626 Telegram ${params.coinType} deploy wizard.`,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  return `data:application/json;base64,${encoded}`
}

export function getCommandHead(rawText: string): string {
  return getSharedCommandHead(rawText)
}

export function isLikelyCommandText(rawText: string): boolean {
  return isKnownTelegramCommandHead(getCommandHead(rawText))
}

export function normalizeTelegramCommand(rawText: string): string {
  return asTrimmed(rawText).replace(/^\/([a-z0-9_]+)@[\w_]+(?=\s|$)/i, '/$1')
}

export function formatAmount(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

export function applyBps(value: bigint, bps: bigint): bigint {
  return (value * bps) / 10_000n
}

export function q96ToCurrencyPerTokenBaseUnits(priceQ96: bigint, tokenDecimals: number): bigint {
  const scale = 10n ** BigInt(tokenDecimals)
  return (priceQ96 * scale) / (2n ** 96n)
}

export function formatEthPerToken(weiPerToken: bigint, tokenSymbol: string): string {
  const eth = Number(formatUnits(weiPerToken, 18))
  return `${formatAmount(eth, 8)} ETH/${tokenSymbol}`
}

export function toBigIntStrict(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
  if (typeof value === 'string' && value.trim()) return BigInt(value.trim())
  throw new Error('Expected bigint-compatible value')
}

export function formatBpsPercentLabel(percentBps: number): string {
  return `${(percentBps / 100).toFixed(percentBps % 100 === 0 ? 0 : 2).replace(/\.?0+$/, '')}%`
}

export function formatUnitsCompact(value: bigint, decimals: number, maxFractionDigits = 8): string {
  const full = formatUnits(value, decimals)
  const [whole, fraction = ''] = full.split('.')
  if (!fraction) return whole
  const clipped = fraction.slice(0, Math.max(0, maxFractionDigits)).replace(/0+$/, '')
  return clipped ? `${whole}.${clipped}` : whole
}

export function parsePercentInputToBps(rawText: string): number | null {
  const normalized = asTrimmed(rawText).replace(/%/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  if (parsed <= 0 || parsed > 100) return null
  return Math.round(parsed * 100)
}

export function truncateAddress(value: string): string {
  const input = asTrimmed(value)
  if (!input) return ''
  if (!/^0x[a-fA-F0-9]{8,}$/.test(input)) return input
  return `${input.slice(0, 6)}…${input.slice(-4)}`
}
