import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'
import { getApiContracts } from './contracts.js'

const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org'

const CREATOR_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'isCreatorCoinActive',
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

type CreatorRegistryValidationReason =
  | 'invalid_input'
  | 'creator_coin_inactive'
  | 'vault_mismatch'
  | 'share_token_mismatch'

export type CreatorRegistryValidationResult =
  | { ok: true }
  | { ok: false; reason: CreatorRegistryValidationReason }

export type CreatorRegistryBindingInput = {
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
  if (!registry) throw new Error('creator_registry_not_configured')
  return registry
}

export async function validateCreatorRegistryBinding(
  input: CreatorRegistryBindingInput,
): Promise<CreatorRegistryValidationResult> {
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
          abi: CREATOR_REGISTRY_ABI,
          functionName: 'isCreatorCoinActive',
          args: [creatorCoin],
        }) as Promise<boolean>,
        client.readContract({
          address: registry,
          abi: CREATOR_REGISTRY_ABI,
          functionName: 'getVaultForToken',
          args: [creatorCoin],
        }) as Promise<Address>,
        client.readContract({
          address: registry,
          abi: CREATOR_REGISTRY_ABI,
          functionName: 'getShareOFTForToken',
          args: [creatorCoin],
        }) as Promise<Address>,
      ])

      if (!active) return { ok: false, reason: 'creator_coin_inactive' }
      if (getAddress(vaultFromRegistry) !== expectedVault) return { ok: false, reason: 'vault_mismatch' }
      if (expectedShareToken && getAddress(shareFromRegistry) !== expectedShareToken) {
        return { ok: false, reason: 'share_token_mismatch' }
      }

      return { ok: true }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new Error('creator_registry_unreachable')
}
