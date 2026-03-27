import { getAddress, isAddress } from 'viem'

import { asTrimmed } from './utils.js'

export type TelegramApprovedInlineToken = {
  address: `0x${string}`
  symbol: string
  buyLabel: string
  queryLabel: string
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
      queryLabel: `Query $${token.symbol}`,
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
  const strippedCommandPrefix = compact.replace(/^\/?(query|analyze)/, '')
  const byCommandAddress = getTelegramApprovedInlineTokenByAddress(trimmed.replace(/^\/?(query|analyze)\s+/i, ''))
  if (byCommandAddress) return byCommandAddress
  return APPROVED_TOKEN_BY_ALIAS.get(compact) ?? null
    ?? APPROVED_TOKEN_BY_ALIAS.get(strippedCommandPrefix)
}

export function buildTelegramAnalyzeInlineDraft(token: TelegramApprovedInlineToken): string {
  return `query $${token.symbol}`
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
