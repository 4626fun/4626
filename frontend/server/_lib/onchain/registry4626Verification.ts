import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'
import { getApiContracts } from './contracts.js'

const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org'

const REGISTRY_4626_ABI = [
  {
    type: 'function',
    name: 'isTokenActive',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getVaultForToken',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getShareOFTForToken',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
] as const

export type Registry4626ValidationReason =
  | 'invalid_input'
  | 'creator_coin_inactive'
  | 'vault_mismatch'
  | 'share_token_mismatch'
  | 'grandfathered_vault_asset_mismatch'
  | 'grandfathered_vault_not_deployed'

export type Registry4626ValidationResult =
  | { ok: true; mode?: 'registry' | 'grandfathered_onchain' }
  | { ok: false; reason: Registry4626ValidationReason }

const CREATOR_OVAULT_ASSET_ABI = [
  {
    type: 'function',
    name: 'asset',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export type Registry4626BindingInput = {
  creatorCoinAddress: string
  vaultAddress: string
  shareTokenAddress?: string | null
}

function normalizeAddress(value: string | null | undefined): Address | null {
  const raw = String(value ?? '').trim()
  if (!isAddress(raw)) return null
  return getAddress(raw)
}

function getBaseRpcUrls(): string[] {
  const urls = new Set<string>()

  for (const envKey of ['BASE_RPC_URL', 'VITE_BASE_RPC_URL']) {
    const raw = String(process.env[envKey] ?? '').trim()
    if (!raw) continue
    for (const part of raw.split(/[,\s]+/)) {
      const candidate = part.trim()
      if (!candidate) continue
      urls.add(candidate)
    }
  }

  urls.add(DEFAULT_BASE_RPC_URL)
  return [...urls]
}

function getRegistryAddress(): Address {
  const registry = normalizeAddress(getApiContracts().registry)
  if (!registry) throw new Error('registry_4626_not_configured')
  return registry
}

export async function validateRegistry4626Binding(
  input: Registry4626BindingInput,
): Promise<Registry4626ValidationResult> {
  const creatorCoin = normalizeAddress(input.creatorCoinAddress)
  const expectedVault = normalizeAddress(input.vaultAddress)
  const expectedShareToken = input.shareTokenAddress == null ? null : normalizeAddress(input.shareTokenAddress)

  if (!creatorCoin || !expectedVault || (input.shareTokenAddress != null && !expectedShareToken)) {
    return { ok: false, reason: 'invalid_input' }
  }

  const registry = getRegistryAddress()
  const rpcUrls = getBaseRpcUrls()
  let lastError: unknown = null

  for (const rpcUrl of rpcUrls) {
    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 15_000 }),
    })

    try {
      const [active, vaultFromRegistry, shareFromRegistry] = await Promise.all([
        client.readContract({
          address: registry,
          abi: REGISTRY_4626_ABI,
          functionName: 'isTokenActive',
          args: [creatorCoin],
        }) as Promise<boolean>,
        client.readContract({
          address: registry,
          abi: REGISTRY_4626_ABI,
          functionName: 'getVaultForToken',
          args: [creatorCoin],
        }) as Promise<Address>,
        client.readContract({
          address: registry,
          abi: REGISTRY_4626_ABI,
          functionName: 'getShareOFTForToken',
          args: [creatorCoin],
        }) as Promise<Address>,
      ])

      if (!active) return { ok: false, reason: 'creator_coin_inactive' }
      if (getAddress(vaultFromRegistry) !== expectedVault) return { ok: false, reason: 'vault_mismatch' }
      if (expectedShareToken && getAddress(shareFromRegistry) !== expectedShareToken) {
        return { ok: false, reason: 'share_token_mismatch' }
      }

      return { ok: true, mode: 'registry' }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new Error('registry_4626_unreachable')
}

function isGrandfatheredKeeperListingEnabled(): boolean {
  const flag = String(process.env.KEEPER_ALLOW_GRANDFATHERED_VAULTS ?? '1').trim().toLowerCase()
  return !['0', 'false', 'no'].includes(flag)
}

async function validateGrandfatheredVaultBinding(
  input: Registry4626BindingInput,
): Promise<Registry4626ValidationResult> {
  const creatorCoin = normalizeAddress(input.creatorCoinAddress)
  const expectedVault = normalizeAddress(input.vaultAddress)
  const expectedShareToken = input.shareTokenAddress == null ? null : normalizeAddress(input.shareTokenAddress)

  if (!creatorCoin || !expectedVault || (input.shareTokenAddress != null && !expectedShareToken)) {
    return { ok: false, reason: 'invalid_input' }
  }

  const rpcUrls = getBaseRpcUrls()
  let lastError: unknown = null

  for (const rpcUrl of rpcUrls) {
    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 15_000 }),
    })

    try {
      const vaultBytecode = await client.getBytecode({ address: expectedVault })

      if (!vaultBytecode || vaultBytecode === '0x') {
        return { ok: false, reason: 'grandfathered_vault_not_deployed' }
      }

      let assetRaw: Address | null = null
      try {
        assetRaw = (await client.readContract({
          address: expectedVault,
          abi: CREATOR_OVAULT_ASSET_ABI,
          functionName: 'asset',
        })) as Address
      } catch {
        return { ok: false, reason: 'grandfathered_vault_not_deployed' }
      }

      const asset = normalizeAddress(assetRaw)
      if (!asset || getAddress(asset) !== creatorCoin) {
        return { ok: false, reason: 'grandfathered_vault_asset_mismatch' }
      }

      // Stale or undeployed share_token_address in DB must not block grandfathered
      // keeper listing when vault.asset() already binds the creator coin.
      return { ok: true, mode: 'grandfathered_onchain' }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new Error('grandfathered_vault_verification_unreachable')
}

/** Strict registry reasons that may still pass via on-chain vault.asset() binding. */
export function shouldAttemptGrandfatheredKeeperFallback(
  reason: Registry4626ValidationReason,
): boolean {
  return (
    reason === 'creator_coin_inactive'
    || reason === 'vault_mismatch'
    || reason === 'share_token_mismatch'
  )
}

/**
 * Keeper listing validation: strict Registry4626 binding first, then on-chain
 * grandfathered fallback for pre-registry vaults (for example AKITA).
 */
export async function validateKeeperVaultListing(
  input: Registry4626BindingInput,
): Promise<Registry4626ValidationResult> {
  const strict = await validateRegistry4626Binding(input)
  if (strict.ok) return strict
  if (!isGrandfatheredKeeperListingEnabled()) return strict

  if (shouldAttemptGrandfatheredKeeperFallback(strict.reason)) {
    const grandfathered = await validateGrandfatheredVaultBinding(input)
    if (grandfathered.ok) return grandfathered
  }

  return strict
}
