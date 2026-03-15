import { asTrimmed, isAddressLike } from '../utils.js'

export function extractPrivyWalletIdCandidate(raw: any): string | null {
  const candidates = [
    raw?.walletId,
    raw?.wallet_id,
    raw?.id,
    raw?.wallet?.id,
    raw?.wallet?.walletId,
    raw?.wallet?.wallet_id,
  ]
  for (const c of candidates) {
    const value = asTrimmed(c)
    if (value) return value
  }
  return null
}

export function extractPrivyWalletAddressCandidate(raw: any): `0x${string}` | null {
  const candidates = [raw?.address, raw?.walletAddress, raw?.wallet_address, raw?.wallet?.address]
  for (const c of candidates) {
    const value = asTrimmed(c)
    if (isAddressLike(value)) return value.toLowerCase() as `0x${string}`
  }
  return null
}

export function collectPrivyWalletRows(user: any): any[] {
  const roots: any[] = []
  if (user && typeof user === 'object') roots.push(user)
  if (Array.isArray(user?.wallets)) roots.push(...user.wallets)
  if (user?.wallet && typeof user.wallet === 'object') roots.push(user.wallet)
  const linked = Array.isArray(user?.linkedAccounts)
    ? user.linkedAccounts
    : Array.isArray(user?.linked_accounts)
      ? user.linked_accounts
      : []
  roots.push(...linked)
  for (const account of linked) {
    if (Array.isArray(account?.embedded_wallets)) roots.push(...account.embedded_wallets)
    if (Array.isArray(account?.embeddedWallets)) roots.push(...account.embeddedWallets)
    if (Array.isArray(account?.wallets)) roots.push(...account.wallets)
  }
  return roots
}
