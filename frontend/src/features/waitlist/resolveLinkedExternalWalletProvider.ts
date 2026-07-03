import { useMemo } from 'react'

import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import { useSafePrivy } from '@/lib/privy/safeHooks'

export type LinkedExternalWalletIdentity = {
  provider: string | null
  connectorId: string | null
}

function normalizeAddress(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function readWalletIdentity(record: Record<string, unknown>): LinkedExternalWalletIdentity {
  const provider = String(
    record.walletClientType ??
      record.wallet_client_type ??
      record.connectorType ??
      record.connector_type ??
      record.type ??
      '',
  ).trim()

  const connectorId = String(record.connectorId ?? record.connector_id ?? '').trim()

  return {
    provider: provider || null,
    connectorId: connectorId || null,
  }
}

export function resolveLinkedExternalWalletProvider(params: {
  linkedAddress?: string | null
  wallets?: Array<{
    address?: string
    walletClientType?: string
    wallet_client_type?: string
    connectorType?: string
    connector_type?: string
    type?: string
    connectorId?: string
    connector_id?: string
  }> | null
  privyUser?: unknown
}): LinkedExternalWalletIdentity {
  const target = normalizeAddress(params.linkedAddress)
  if (!target) return { provider: null, connectorId: null }

  for (const wallet of params.wallets ?? []) {
    if (normalizeAddress(wallet.address) !== target) continue
    return readWalletIdentity(wallet as Record<string, unknown>)
  }

  const user =
    params.privyUser && typeof params.privyUser === 'object'
      ? (params.privyUser as Record<string, unknown>)
      : null
  if (!user) return { provider: null, connectorId: null }

  const accounts = [
    ...(Array.isArray(user.linkedAccounts) ? user.linkedAccounts : []),
    ...(Array.isArray(user.linked_accounts) ? user.linked_accounts : []),
  ]

  for (const account of accounts) {
    const record = account && typeof account === 'object' ? (account as Record<string, unknown>) : null
    if (!record) continue
    if (normalizeAddress(String(record.address ?? '')) !== target) continue
    return readWalletIdentity(record)
  }

  return { provider: null, connectorId: null }
}
