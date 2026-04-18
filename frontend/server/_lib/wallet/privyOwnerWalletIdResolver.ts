/**
 * Architecture B Phase 2 — Privy owner wallet-id resolver helpers.
 *
 * Pure helpers that traverse every wallet-bearing surface of a Privy user
 * payload and surface the server wallet id for a target owner EOA. Mirrors
 * `classifyLinkedAccounts` in this directory: walks `user.wallet`,
 * `user.wallets`, `user.linkedAccounts`, `user.linked_accounts`, and nested
 * `smartWallets`/`smart_wallets`/`embeddedWallets`/`embedded_wallets` arrays
 * on each linked-account entry; accepts camelCase and snake_case field
 * names (`chainType`/`chain_type`, `walletClientType`/`wallet_client_type`,
 * `id`/`wallet_id`, etc.).
 *
 * Used by:
 *   - `frontend/scripts/arch-b-find-privy-owner-wallet-id.ts` (operator CLI)
 *   - tests in this directory
 *
 * Not used on the hot path — this only drives operator provisioning for
 * `command_issuer_execution_context`.
 */

export type WalletCandidate = {
  address: string
  id: string | null
  chainType: string | null
  walletClientType: string | null
  hdWalletIndex: number | null
  delegated: boolean | null
  rawType: string | null
}

export function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  // Accept `0x` and `0X` prefixes — upstream surfaces occasionally shout-case
  // the whole string, and downstream consumers always compare lowercase.
  return /^0x[a-fA-F0-9]{40}$/i.test(raw) ? raw.toLowerCase() : null
}

export function nestedWalletEntries(raw: any): any[] {
  const smartWallets = Array.isArray(raw?.smartWallets)
    ? raw.smartWallets
    : Array.isArray(raw?.smart_wallets)
      ? raw.smart_wallets
      : []
  const embeddedWallets = Array.isArray(raw?.embeddedWallets)
    ? raw.embeddedWallets
    : Array.isArray(raw?.embedded_wallets)
      ? raw.embedded_wallets
      : []
  return [...smartWallets, ...embeddedWallets]
}

export function collectWalletCandidates(user: any): any[] {
  const linkedAccounts = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const linkedAccountsSnake = Array.isArray(user?.linked_accounts) ? user.linked_accounts : []
  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const nested = [...linkedAccounts, ...linkedAccountsSnake].flatMap((raw) => nestedWalletEntries(raw))
  return [...primaryWallet, ...wallets, ...linkedAccounts, ...linkedAccountsSnake, ...nested]
}

function extractChainType(raw: any): string | null {
  const v = raw?.chainType ?? raw?.chain_type ?? raw?.chain ?? raw?.network
  return typeof v === 'string' ? v.toLowerCase() : null
}

function extractClientType(raw: any): string | null {
  const v =
    raw?.walletClientType ??
    raw?.wallet_client_type ??
    raw?.walletType ??
    raw?.wallet_type ??
    raw?.connectorType ??
    raw?.connector_type ??
    raw?.clientType ??
    raw?.client_type ??
    raw?.provider
  return typeof v === 'string' ? v.toLowerCase() : null
}

function extractId(raw: any): string | null {
  // Privy exposes `id` on unified-stack / delegated embedded wallets; some
  // surfaces use snake_case `wallet_id`. Treat both as equivalent.
  const v = raw?.id ?? raw?.wallet_id
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed ? trimmed : null
}

function extractHdIndex(raw: any): number | null {
  const v = raw?.hdWalletIndex ?? raw?.hd_wallet_index
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function extractDelegated(raw: any): boolean | null {
  const v = raw?.delegated
  if (typeof v === 'boolean') return v
  return null
}

function extractRawType(raw: any): string | null {
  const v = raw?.type
  return typeof v === 'string' ? v.toLowerCase() : null
}

export function toCandidate(raw: any): WalletCandidate | null {
  const address = normalizeAddress(raw?.address ?? raw?.walletAddress ?? raw?.wallet_address)
  if (!address) return null
  return {
    address,
    id: extractId(raw),
    chainType: extractChainType(raw),
    walletClientType: extractClientType(raw),
    hdWalletIndex: extractHdIndex(raw),
    delegated: extractDelegated(raw),
    rawType: extractRawType(raw),
  }
}

/**
 * Merge candidates for the same address. Prefer entries that carry a server
 * id or richer metadata — this avoids picking a sparse snake_case shim over
 * a fuller camelCase record for the same wallet.
 */
export function mergeByAddress(entries: WalletCandidate[]): WalletCandidate[] {
  const byAddress = new Map<string, WalletCandidate>()
  for (const entry of entries) {
    const current = byAddress.get(entry.address)
    if (!current) {
      byAddress.set(entry.address, entry)
      continue
    }
    const merged: WalletCandidate = {
      address: entry.address,
      id: current.id ?? entry.id,
      chainType: current.chainType ?? entry.chainType,
      walletClientType: current.walletClientType ?? entry.walletClientType,
      hdWalletIndex: current.hdWalletIndex ?? entry.hdWalletIndex,
      delegated: current.delegated ?? entry.delegated,
      rawType: current.rawType ?? entry.rawType,
    }
    byAddress.set(entry.address, merged)
  }
  return Array.from(byAddress.values())
}

export type ResolveOwnerWalletIdOutcome =
  | { status: 'ready'; candidate: WalletCandidate }
  | { status: 'no_server_id'; matches: WalletCandidate[] }
  | { status: 'no_match'; inspected: WalletCandidate[] }

/**
 * End-to-end: walk every wallet surface on `user`, dedupe by address,
 * return the entry for `ownerEoa` plus a status indicating whether the
 * caller has a usable server wallet id.
 */
export function resolveOwnerWalletId(user: unknown, ownerEoa: string): ResolveOwnerWalletIdOutcome {
  const target = normalizeAddress(ownerEoa)
  const candidates = collectWalletCandidates(user)
  const mapped: WalletCandidate[] = []
  for (const raw of candidates) {
    const c = toCandidate(raw)
    if (c) mapped.push(c)
  }
  const merged = mergeByAddress(mapped)
  if (!target) return { status: 'no_match', inspected: merged }
  const matches = merged.filter((w) => w.address === target)
  if (matches.length === 0) return { status: 'no_match', inspected: merged }
  const withId = matches.find((w) => w.id)
  if (!withId) return { status: 'no_server_id', matches }
  return { status: 'ready', candidate: withId }
}
