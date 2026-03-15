import { isDeployCurrencyInput, mapDeployCurrencyToCommandCurrency } from '../parsers/deploy.js'
import { asTrimmed, isSupportedMetadataUri, normalizeDeploySymbol } from '../utils.js'

export function buildDeployCommandFromIntent(intent: Record<string, unknown>): {
  commandText: string
  deployLabel: string
  detailLines: string[]
} | null {
  const deployType = asTrimmed(intent.deployType ?? '').toLowerCase()
  if (deployType === 'trend') {
    const ticker = asTrimmed(intent.ticker ?? '').toUpperCase()
    if (!/^[A-Z0-9._-]{2,24}$/.test(ticker)) return null
    return {
      commandText: `/coin trend reserve ${ticker}`,
      deployLabel: 'TREND',
      detailLines: [`- Ticker: ${ticker}`],
    }
  }

  if (deployType === 'content' || deployType === 'creator') {
    const name = asTrimmed(intent.name ?? '').replace(/"/g, '')
    const symbol = normalizeDeploySymbol(asTrimmed(intent.symbol ?? ''))
    const metadataUri = asTrimmed(intent.metadataUri ?? '')
    const currencyInputRaw = asTrimmed(intent.currencyInput ?? '').toUpperCase()
    if (!name || !/^[A-Z0-9_]{2,10}$/.test(symbol) || !isSupportedMetadataUri(metadataUri) || !isDeployCurrencyInput(currencyInputRaw)) {
      return null
    }
    const commandCurrency = mapDeployCurrencyToCommandCurrency(currencyInputRaw)
    return {
      commandText: `/coin create "${name}" ${symbol} ${metadataUri} ${commandCurrency}`,
      deployLabel: deployType === 'content' ? 'CONTENT_COIN' : 'CREATOR_COIN',
      detailLines: [
        `- Name: ${name}`,
        `- Symbol: ${symbol}`,
        `- Metadata URI: ${metadataUri}`,
        `- Currency label: ${currencyInputRaw}`,
        `- Command currency: ${commandCurrency}`,
      ],
    }
  }
  return null
}

export function formatDeployTokenFailure(reason: 'not_found' | 'expired' | 'consumed' | 'scope_mismatch'): string {
  if (reason === 'expired') return 'Deploy confirmation expired. Start a new `/deploy` preview.'
  if (reason === 'consumed') return 'This deploy preview was already confirmed or cancelled.'
  if (reason === 'scope_mismatch') return 'Deploy confirmation scope mismatch. Use a fresh preview from this chat.'
  return 'Deploy confirmation token not found. Start a new `/deploy` preview.'
}
