import { createPublicClient, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

import { classifyLinkedAccounts, type PrivyUserLike } from './walletMapping.js'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

const EVM_RE = /^0x[a-fA-F0-9]{40}$/
const DEFAULT_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base-mainnet.public.blastapi.io',
] as const

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!EVM_RE.test(raw)) return null
  try {
    return getAddress(raw).toLowerCase()
  } catch {
    return null
  }
}

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function getBaseRpcUrls(): string[] {
  const raw = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return [...DEFAULT_BASE_RPCS]
  const configured = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return [...new Set([...configured, ...DEFAULT_BASE_RPCS])]
}

async function hasContractBytecodeAcrossRpcs(address: string): Promise<boolean> {
  const normalized = getAddress(address as Address)
  for (const rpc of getBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 8_000 }),
      })
      const code = await client.getBytecode({ address: normalized })
      if (code && code !== '0x') return true
    } catch {
      // Try the next RPC.
    }
  }
  return false
}

async function readPersistedWalletMetadata(params: {
  db: Db
  profileId: number
  address: string
}): Promise<{
  canonicalSource: string
  walletType: string
  provider: string
} | null> {
  const result = await params.db.sql`
    SELECT
      pw.canonical_source,
      w.wallet_type,
      w.provider
    FROM profile_wallets pw
    LEFT JOIN wallets w
      ON LOWER(w.address) = LOWER(pw.address)
    WHERE pw.profile_id = ${params.profileId}
      AND LOWER(pw.address) = ${params.address}
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? null
  if (!row) return null
  return {
    canonicalSource: normalizeLower(row.canonical_source),
    walletType: normalizeLower(row.wallet_type),
    provider: normalizeLower(row.provider),
  }
}

async function readWalletSyncFallbackSubAccount(params: {
  db: Db
  profileId: number
  canonicalCswAddress: string | null
}): Promise<string | null> {
  const canonical = normalizeAddress(params.canonicalCswAddress)
  const result = await params.db.sql`
    SELECT pw.address
    FROM profile_wallets pw
    LEFT JOIN wallets w
      ON LOWER(w.address) = LOWER(pw.address)
    WHERE pw.profile_id = ${params.profileId}
      AND LOWER(COALESCE(pw.canonical_source, '')) = 'wallet_sync'
      AND LOWER(COALESCE(w.wallet_type, '')) = 'smart_wallet'
      AND (
        ${canonical}::text IS NULL
        OR LOWER(pw.address) <> ${canonical}
      )
      AND LOWER(COALESCE(w.provider, '')) NOT LIKE '%zora_readonly%'
    ORDER BY pw.updated_at DESC NULLS LAST, pw.created_at DESC NULLS LAST
    LIMIT 1;
  `
  return normalizeAddress(result.rows?.[0]?.address)
}

/**
 * Harden persisted `profiles.base_sub_account` before exposing it as an execution
 * sub-account. Rejects identity-only EOAs and stale zora_readonly candidates.
 */
export async function sanitizePersistedSubAccountAddress(params: {
  db: Db
  profileId: number
  canonicalCswAddress: string | null | undefined
  baseSubAccountAddress: string | null | undefined
  privyUser: PrivyUserLike | null
}): Promise<string | null> {
  const canonical = normalizeAddress(params.canonicalCswAddress)
  const walletSyncFallback = await readWalletSyncFallbackSubAccount({
    db: params.db,
    profileId: params.profileId,
    canonicalCswAddress: canonical,
  })

  const candidate = normalizeAddress(params.baseSubAccountAddress)
  if (!candidate) return walletSyncFallback

  // Stale/missing profiles.base_sub_account should not hide a valid wallet_sync row.
  if (canonical && candidate === canonical) return walletSyncFallback

  const metadata = await readPersistedWalletMetadata({
    db: params.db,
    profileId: params.profileId,
    address: candidate,
  })

  const isWalletSyncSmartWallet =
    metadata?.canonicalSource === 'wallet_sync' &&
    metadata.walletType === 'smart_wallet' &&
    !metadata.provider.includes('zora_readonly')
  if (isWalletSyncSmartWallet) return candidate

  if (
    metadata?.canonicalSource === 'zora_readonly' ||
    metadata?.provider.includes('zora_readonly')
  ) {
    return walletSyncFallback
  }

  if (params.privyUser) {
    const classification = classifyLinkedAccounts(params.privyUser)
    const linkedMatch = classification.allWallets.find(
      (wallet) => normalizeLower(wallet.address) === candidate,
    )
    if (linkedMatch) {
      if (linkedMatch.walletType !== 'smart_wallet') return walletSyncFallback
      if (normalizeLower(linkedMatch.provider).includes('zora_readonly')) return walletSyncFallback
    }
  }

  // Final fallback: must be a contract address to qualify as sub-account.
  if (await hasContractBytecodeAcrossRpcs(candidate)) return candidate
  return walletSyncFallback
}

