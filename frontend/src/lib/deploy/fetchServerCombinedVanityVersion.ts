import { apiFetch } from '@/lib/api/apiBase'
import type { Address, Hex } from 'viem'

import { COMBINED_SALT_DISABLED_SERVER_MAX_TRIES } from '@/pages/deploy/deployVaultHelpers'

export type FetchServerCombinedVanityParams = {
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  chainId: number
  baseVersion: string
  vaultPrefix: string
  shareSuffix: string
  startAttempt: number
  maxAttempts?: number
  vaultInitCode: Hex
  shareOftInitCode: Hex
  shareSymbol: string
}

export async function fetchServerCombinedVanityVersion(
  params: FetchServerCombinedVanityParams,
): Promise<string | null> {
  const res = await apiFetch('/api/deploy/vanity/per-vault-version', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      create2Deployer: params.create2Deployer,
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      baseVersion: params.baseVersion,
      vaultPrefix: params.vaultPrefix,
      shareSuffix: params.shareSuffix,
      startAttempt: params.startAttempt,
      maxAttempts: params.maxAttempts ?? COMBINED_SALT_DISABLED_SERVER_MAX_TRIES,
      vaultInitCode: params.vaultInitCode,
      shareOftInitCode: params.shareOftInitCode,
      shareSymbol: params.shareSymbol,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Combined vanity search failed (${res.status})`)
  }
  const json = (await res.json()) as {
    success?: boolean
    data?: { version?: string | null }
    error?: string
  }
  if (!json.success) {
    throw new Error(json.error || 'Combined vanity search failed')
  }
  const version = json.data?.version
  return typeof version === 'string' && version.trim() ? version.trim() : null
}
