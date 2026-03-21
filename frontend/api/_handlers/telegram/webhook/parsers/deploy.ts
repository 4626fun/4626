import { DEPLOY_CURRENCY_VALUES } from '../constants.js'
import type { CommandCoinCurrency, DeployCurrencyInput, DeployWizardType, ParsedTelegramDeployIntent } from '../types.js'
import { asTrimmed, buildDefaultCoinMetadataUri, isSupportedMetadataUri, normalizeDeploySymbol, tokenizeTelegramCommand } from '../utils.js'

export function isDeployCurrencyInput(raw: string): raw is DeployCurrencyInput {
  const token = asTrimmed(raw).toUpperCase()
  return DEPLOY_CURRENCY_VALUES.includes(token as DeployCurrencyInput)
}

export function mapDeployCurrencyToCommandCurrency(input: DeployCurrencyInput): CommandCoinCurrency {
  if (input === 'ETH') return 'ETH'
  if (input === 'ZORA') return 'ZORA'
  return 'CREATOR_COIN'
}

export function defaultDeployCurrency(coinType: Exclude<DeployWizardType, 'trend'>): DeployCurrencyInput {
  if (coinType === 'creator') return 'CREATOR_COIN'
  return 'CONTENT_COIN'
}

export function formatDeployUsageText(reason?: string): string {
  const lines = [
    'Deploy Wizard',
    '',
    reason ? `- ${reason}` : '- usage:',
    '- `/deploy`',
    '- `/deploy trend` <TICKER>',
    '- `/deploy content` "<NAME>" <SYMBOL> [metadataUri] [ETH|ZORA|CREATOR_COIN|CONTENT_COIN]',
    '- `/deploy creator` "<NAME>" <SYMBOL> [metadataUri] [ETH|ZORA|CREATOR_COIN|CONTENT_COIN]',
    '- `/zora`',
    '',
    'Examples:',
    '- `/deploy trend` BASEAI',
    '- `/deploy content` "Base Daily Recap" BDR',
    '- `/deploy creator` "Akita Creator Pass" AKITA https://example.com/meta.json CREATOR_COIN',
  ]
  return lines.join('\n')
}

export function parseTelegramDeployIntent(rawText: string): ParsedTelegramDeployIntent | null {
  const tokenized = tokenizeTelegramCommand(rawText)
  const prefix = asTrimmed(tokenized[0] ?? '')
    .replace(/^\//, '')
    .toLowerCase()
  if (prefix !== 'deploy') return null
  const sub = asTrimmed(tokenized[1] ?? '').toLowerCase()
  if (!sub) return { kind: 'menu' }
  if (sub === 'zora') {
    return { kind: 'zora' }
  }
  if (sub === 'trend') {
    const ticker = asTrimmed(tokenized[2] ?? '').toUpperCase()
    if (!ticker) {
      return { kind: 'usage', text: formatDeployUsageText('Missing trend ticker.') }
    }
    if (!/^[A-Z0-9._-]{2,24}$/.test(ticker)) {
      return { kind: 'usage', text: formatDeployUsageText('Ticker must be 2-24 chars: A-Z, 0-9, ., _, -.') }
    }
    return { kind: 'trend', ticker }
  }
  if (sub !== 'content' && sub !== 'creator') {
    return { kind: 'usage', text: formatDeployUsageText(`Unknown deploy target: ${sub}`) }
  }

  const coinType = sub as Exclude<DeployWizardType, 'trend'>
  const name = asTrimmed(tokenized[2] ?? '')
  const symbol = normalizeDeploySymbol(tokenized[3] ?? '')
  if (!name || !symbol) {
    return { kind: 'usage', text: formatDeployUsageText('Missing name or symbol for coin deploy.') }
  }
  if (name.length < 1 || name.length > 48) {
    return { kind: 'usage', text: formatDeployUsageText('Coin name must be between 1 and 48 characters.') }
  }
  if (!/^[A-Z0-9_]{2,10}$/.test(symbol)) {
    return { kind: 'usage', text: formatDeployUsageText('Symbol must be 2-10 chars: A-Z, 0-9, _.') }
  }

  let metadataCandidate = asTrimmed(tokenized[4] ?? '')
  let currencyCandidate = asTrimmed(tokenized[5] ?? '').toUpperCase()
  if (metadataCandidate && isDeployCurrencyInput(metadataCandidate)) {
    currencyCandidate = metadataCandidate.toUpperCase()
    metadataCandidate = ''
  }

  if (currencyCandidate && !isDeployCurrencyInput(currencyCandidate)) {
    return { kind: 'usage', text: formatDeployUsageText(`Unsupported currency: ${currencyCandidate}`) }
  }
  if (metadataCandidate && !isSupportedMetadataUri(metadataCandidate)) {
    return { kind: 'usage', text: formatDeployUsageText('metadataUri must start with https://, ipfs://, ar://, or data:.') }
  }

  const currencyInput = (currencyCandidate || defaultDeployCurrency(coinType)) as DeployCurrencyInput
  const metadataUri = metadataCandidate || buildDefaultCoinMetadataUri({ coinType, name, symbol })

  return {
    kind: 'coin',
    coinType,
    name,
    symbol,
    metadataUri,
    currencyInput,
    commandCurrency: mapDeployCurrencyToCommandCurrency(currencyInput),
  }
}

export function parseDeployCallbackData(rawData: string):
  | { kind: 'type'; deployType: DeployWizardType | 'zora' }
  | { kind: 'confirm' | 'decline'; token: string }
  | null {
  const data = asTrimmed(rawData)
  const typeMatch = data.match(/^deploy:type:(trend|content|creator|zora)$/)
  if (typeMatch) {
    const deployType = asTrimmed(typeMatch[1]).toLowerCase()
    if (deployType === 'trend' || deployType === 'content' || deployType === 'creator' || deployType === 'zora') {
      return {
        kind: 'type',
        deployType,
      }
    }
  }
  const actionMatch = data.match(/^deploy:(confirm|decline):([a-zA-Z0-9._-]+)$/)
  if (actionMatch) {
    const action = asTrimmed(actionMatch[1]).toLowerCase()
    const token = asTrimmed(actionMatch[2])
    if (!token) return null
    return {
      kind: action === 'confirm' ? 'confirm' : 'decline',
      token,
    }
  }
  return null
}
