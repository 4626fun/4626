import { getAddress, isAddress } from 'viem'

import { asTrimmed } from './utils.js'

const TELEGRAM_INLINE_QUERY_BOT_USERNAME = '@akitai_bot' as const

export type TelegramApprovedInlineToken = {
  address: `0x${string}`
  symbol: string
  buyLabel: string
  analyzeLabel: string
  aliases: string[]
}

const TELEGRAM_APPROVED_INLINE_TOKENS_RAW = [
  {
    address: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
    symbol: 'AKITA',
    aliases: ['akita', '$akita'],
  },
] as const

export const TELEGRAM_APPROVED_INLINE_TOKENS: TelegramApprovedInlineToken[] =
  TELEGRAM_APPROVED_INLINE_TOKENS_RAW.map((token) => {
    const address = getAddress(token.address).toLowerCase() as `0x${string}`
    return {
      address,
      symbol: token.symbol,
      buyLabel: `Buy $${token.symbol}`,
      analyzeLabel: `Analyze $${token.symbol}`,
      aliases: [...token.aliases],
    }
  })

const APPROVED_TOKEN_BY_ADDRESS = new Map(
  TELEGRAM_APPROVED_INLINE_TOKENS.map((token) => [token.address, token] as const),
)

const APPROVED_TOKEN_BY_ALIAS = new Map(
  TELEGRAM_APPROVED_INLINE_TOKENS.flatMap((token) =>
    [token.symbol, ...token.aliases].map((alias) => [alias.toLowerCase(), token] as const),
  ),
)

function normalizeAddressLike(value: unknown): `0x${string}` | null {
  const raw = asTrimmed(value)
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase() as `0x${string}`
}

export function getTelegramApprovedInlineTokenByAddress(value: unknown): TelegramApprovedInlineToken | null {
  const normalized = normalizeAddressLike(value)
  if (!normalized) return null
  return APPROVED_TOKEN_BY_ADDRESS.get(normalized) ?? null
}

export function resolveTelegramApprovedInlineTokenQuery(rawQuery: string): TelegramApprovedInlineToken | null {
  const trimmed = asTrimmed(rawQuery)
  if (!trimmed) return null
  const byAddress = getTelegramApprovedInlineTokenByAddress(trimmed)
  if (byAddress) return byAddress
  const compact = trimmed.replace(/\s+/g, '').toLowerCase()
  return APPROVED_TOKEN_BY_ALIAS.get(compact) ?? null
}

export function buildTelegramAnalyzeInlineDraft(token: TelegramApprovedInlineToken): string {
  return token.address
}

export function buildTelegramAnalyzeInlineCopyText(query: string): string {
  const inlineQuery = asTrimmed(query).replace(/\s+/g, ' ')
  return inlineQuery ? `${TELEGRAM_INLINE_QUERY_BOT_USERNAME} ${inlineQuery}` : TELEGRAM_INLINE_QUERY_BOT_USERNAME
}

export function buildTelegramAnalyzeInlineButtons(params: {
  label: string
  query: string
  copyLabel?: string
}): Array<Record<string, unknown>> {
  const label = asTrimmed(params.label)
  const query = asTrimmed(params.query).replace(/\s+/g, ' ')
  if (!label || !query) return []
  const copyLabel = asTrimmed(params.copyLabel) || 'Copy Query'
  return [
    { text: label, switch_inline_query_current_chat: query },
    { text: copyLabel, copy_text: { text: buildTelegramAnalyzeInlineCopyText(query) } },
  ]
}

export function filterTelegramApprovedTradeVaults<T extends { creatorCoinAddress: string }>(
  vaults: T[],
): Array<T & { approvedToken: TelegramApprovedInlineToken }> {
  const seen = new Set<string>()
  const approved: Array<T & { approvedToken: TelegramApprovedInlineToken }> = []
  for (const vault of vaults) {
    const approvedToken = getTelegramApprovedInlineTokenByAddress(vault.creatorCoinAddress)
    if (!approvedToken || seen.has(approvedToken.address)) continue
    seen.add(approvedToken.address)
    approved.push({ ...vault, approvedToken })
  }
  return approved
}
