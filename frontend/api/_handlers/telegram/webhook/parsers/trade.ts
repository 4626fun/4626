import type { InteractiveTradeAction, ParsedTelegramTradeIntent, ScopedVaultRow } from '../types.js'
import { asTrimmed } from '../utils.js'

export function parseTelegramTradeIntent(rawText: string): ParsedTelegramTradeIntent | null {
  const text = asTrimmed(rawText)
  if (!text) return null

  const buySell = text.match(/^\/?(buy|sell)\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)\s*(?:--confirm)?\s*$/i)
  if (buySell) {
    const action = buySell[1]?.toLowerCase()
    const identifier = asTrimmed(buySell[2] ?? '')
    const amountInput = asTrimmed(buySell[3] ?? '')
    const amount = Number(amountInput)
    if ((action === 'buy' || action === 'sell') && identifier && Number.isFinite(amount) && amount > 0) {
      return {
        actionType: action,
        identifier,
        amountInput,
        amount,
        amountUnit: action === 'buy' ? 'ETH' : 'SHARE',
      }
    }
  }

  const bid = text.match(/^\/?bid\s+(\S+)\s+\$?([0-9]+(?:\.[0-9]+)?)\s*(?:--confirm)?\s*$/i)
  if (bid) {
    const identifier = asTrimmed(bid[1] ?? '')
    const amountInput = asTrimmed(bid[2] ?? '')
    const amount = Number(amountInput)
    if (identifier && Number.isFinite(amount) && amount > 0) {
      return {
        actionType: 'bid',
        identifier,
        amountInput,
        amount,
        amountUnit: 'USD',
      }
    }
  }
  return null
}

export function commandHasArguments(rawText: string, head: InteractiveTradeAction): boolean {
  const text = asTrimmed(rawText)
  if (!text) return false
  const pattern = new RegExp(`^/?${head}(?:\\s+(.+))?$`, 'i')
  const match = text.match(pattern)
  const argTail = asTrimmed(match?.[1] ?? '')
  return Boolean(argTail)
}

export function resolveTradeTarget(scopedVaults: ScopedVaultRow[], identifier: string): ScopedVaultRow | null {
  const token = asTrimmed(identifier).toLowerCase()
  if (!token) return null
  if (scopedVaults.length === 0) return null
  if (token === 'vault' || token === 'default') return scopedVaults[0] ?? null

  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(token)
  if (isAddress) {
    const byVault = scopedVaults.find((row) => row.vaultAddress.toLowerCase() === token)
    if (byVault) return byVault
    const byCoin = scopedVaults.find((row) => row.creatorCoinAddress.toLowerCase() === token)
    if (byCoin) return byCoin
    return null
  }

  if (scopedVaults.length === 1) return scopedVaults[0]
  return null
}

export function parseTradeFlowCallbackData(rawData: string):
  | { kind: 'vault'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | { kind: 'percent'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}`; percentBps: number }
  | { kind: 'custom'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | null {
  const data = asTrimmed(rawData)
  const vaultMatch = data.match(/^tradeflow:v:(buy|sell|bid):(0x[a-fA-F0-9]{40})$/)
  if (vaultMatch) {
    return {
      kind: 'vault',
      actionType: vaultMatch[1].toLowerCase() as InteractiveTradeAction,
      vaultAddress: vaultMatch[2].toLowerCase() as `0x${string}`,
    }
  }

  const percentMatch = data.match(/^tradeflow:p:(buy|sell|bid):(0x[a-fA-F0-9]{40}):(\d{1,4})$/)
  if (percentMatch) {
    const percentBps = Number(percentMatch[3] ?? 0)
    if (!Number.isFinite(percentBps) || percentBps < 100 || percentBps > 9_999) return null
    return {
      kind: 'percent',
      actionType: percentMatch[1].toLowerCase() as InteractiveTradeAction,
      vaultAddress: percentMatch[2].toLowerCase() as `0x${string}`,
      percentBps: Math.floor(percentBps),
    }
  }

  const customMatch = data.match(/^tradeflow:c:(buy|sell|bid):(0x[a-fA-F0-9]{40})$/)
  if (customMatch) {
    return {
      kind: 'custom',
      actionType: customMatch[1].toLowerCase() as InteractiveTradeAction,
      vaultAddress: customMatch[2].toLowerCase() as `0x${string}`,
    }
  }

  return null
}

export function parseTradeCallbackData(rawData: string):
  | { kind: 'accept' | 'decline'; token: string }
  | { kind: 'edit'; actionType: 'buy' | 'sell' | 'bid' }
  | null {
  const data = asTrimmed(rawData)
  if (!data.startsWith('trade:')) return null
  const parts = data.split(':')
  const kind = asTrimmed(parts[1]).toLowerCase()
  if (kind === 'accept' || kind === 'decline') {
    const token = asTrimmed(parts[2])
    if (!token) return null
    return { kind: kind === 'accept' ? 'accept' : 'decline', token }
  }
  if (kind === 'edit') {
    const actionType = asTrimmed(parts[2]).toLowerCase()
    if (actionType === 'buy' || actionType === 'sell' || actionType === 'bid') {
      return { kind: 'edit', actionType }
    }
  }
  return null
}
