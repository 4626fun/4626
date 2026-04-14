/**
 * Vault registry client — fetches active vaults from the API.
 */

import { getAddress, isAddress, type Address } from 'viem';
import { requireEnv } from '../config.js';
import { readContract } from './onchain.js';

export interface VaultConfig {
  vaultAddress: `0x${string}`;
  chainId: number;
  creatorCoinAddress: `0x${string}`;
  shareTokenAddress?: `0x${string}`;
  ccaStrategyAddress?: `0x${string}`;
  oracleAddress?: `0x${string}`;
  vrfHubAddress?: `0x${string}`;
  burnStreamAddress?: `0x${string}`;
  payoutRouterAddress?: `0x${string}`;
  groupId: string;
  extra?: Record<string, unknown>;
}

interface RegistryVerificationResult {
  verified: boolean;
  reason?: string;
}

const DEFAULT_CREATOR_REGISTRY = '0x888506B92181c57A2fD06516FFFb6F375b7A4626' as const;
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
] as const;

function normalizeAddress(value: string | null | undefined): Address | null {
  const raw = String(value ?? '').trim();
  if (!isAddress(raw)) return null;
  return getAddress(raw);
}

function getCreatorRegistryAddress(): Address {
  const configured = String(process.env.CREATOR_REGISTRY ?? '').trim();
  const candidate = configured || DEFAULT_CREATOR_REGISTRY;
  if (!isAddress(candidate)) {
    throw new Error('CREATOR_REGISTRY is not a valid address');
  }
  return getAddress(candidate);
}

export async function verifyVaultRegistryBinding(vault: VaultConfig): Promise<RegistryVerificationResult> {
  const creatorCoin = normalizeAddress(vault.creatorCoinAddress);
  const expectedVault = normalizeAddress(vault.vaultAddress);
  const expectedShare = vault.shareTokenAddress ? normalizeAddress(vault.shareTokenAddress) : null;

  if (!creatorCoin || !expectedVault || (vault.shareTokenAddress && !expectedShare)) {
    return { verified: false, reason: 'invalid_addresses' };
  }

  const registryAddress = getCreatorRegistryAddress();

  const [active, registryVault, registryShare] = await Promise.all([
    readContract<boolean>({
      address: registryAddress,
      abi: CREATOR_REGISTRY_ABI,
      functionName: 'isCreatorCoinActive',
      args: [creatorCoin],
    }),
    readContract<Address>({
      address: registryAddress,
      abi: CREATOR_REGISTRY_ABI,
      functionName: 'getVaultForToken',
      args: [creatorCoin],
    }),
    readContract<Address>({
      address: registryAddress,
      abi: CREATOR_REGISTRY_ABI,
      functionName: 'getShareOFTForToken',
      args: [creatorCoin],
    }),
  ]);

  if (!active) return { verified: false, reason: 'creator_coin_inactive' };
  if (getAddress(registryVault) !== expectedVault) return { verified: false, reason: 'vault_mismatch' };
  if (expectedShare && getAddress(registryShare) !== expectedShare) {
    return { verified: false, reason: 'share_token_mismatch' };
  }

  return { verified: true };
}

interface VaultsResponse {
  success: boolean;
  data?: {
    vaults: VaultConfig[];
    count: number;
  };
  error?: string;
}

/**
 * Fetch all active vaults from the registry API.
 * @param chainId Optional chain ID filter (defaults to Base mainnet 8453)
 */
export async function fetchActiveVaults(chainId?: number): Promise<VaultConfig[]> {
  const baseUrl = process.env.KEEPR_API_BASE_URL || 'https://4626.fun/api';
  const secret = requireEnv('KEEPR_API_KEY');

  const url = new URL(`${baseUrl}/cre/vaults/active`);
  if (chainId) {
    url.searchParams.set('chainId', String(chainId));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch vaults: ${response.status} ${text}`);
  }

  const data = (await response.json()) as VaultsResponse;

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to fetch vaults');
  }

  // FIX: HGH-08 — Validate vault addresses returned from the API against on-chain registry
  const vaults = data.data.vaults;
  const verifiedVaults: VaultConfig[] = [];
  for (const vault of vaults) {
    if (!isAddress(vault.vaultAddress) || !isAddress(vault.creatorCoinAddress)) {
      console.warn(`[CRE] Skipping vault with invalid addresses: ${vault.vaultAddress}`);
      continue;
    }
    try {
      const binding = await verifyVaultRegistryBinding(vault);
      if (!binding.verified) {
        console.warn(`[CRE] Skipping unverified vault ${vault.vaultAddress}: ${binding.reason}`);
        continue;
      }
      verifiedVaults.push(vault);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CRE] Skipping vault ${vault.vaultAddress} — registry check failed: ${msg}`);
      continue;
    }
  }
  return verifiedVaults;
}

/**
 * Filter vaults that have all required addresses for a specific workflow.
 */
export function filterVaultsForWorkflow(
  vaults: VaultConfig[],
  workflow:
    | 'vault-keeper'
    | 'cca-finalization'
    | 'oracle-broadcaster'
    | 'vrf-health-monitor'
    | 'ajna-bucket-manager'
    | 'charm-rebalance-manager'
    | 'payout-router-harvest'
): VaultConfig[] {
  switch (workflow) {
    case 'vault-keeper':
      // Vault keeper only needs the vault address
      return vaults.filter((v) => v.vaultAddress);

    case 'cca-finalization':
      // CCA finalization needs CCA strategy address
      return vaults.filter((v) => v.vaultAddress && v.ccaStrategyAddress);

    case 'oracle-broadcaster':
      // Oracle broadcaster needs oracle address
      return vaults.filter((v) => v.vaultAddress && v.oracleAddress);

    case 'vrf-health-monitor':
      // VRF monitor needs VRF hub address
      return vaults.filter((v) => v.vaultAddress && v.vrfHubAddress);

    case 'ajna-bucket-manager':
      // Ajna bucket manager needs vault + oracle to compute suggested bucket.
      return vaults.filter((v) => v.vaultAddress && v.oracleAddress);

    case 'charm-rebalance-manager':
      // Charm rebalance manager needs vault + oracle for price trigger checks.
      return vaults.filter((v) => v.vaultAddress && v.oracleAddress);

    case 'payout-router-harvest':
      // Payout processor needs creator coin + router wiring.
      return vaults.filter((v) => v.creatorCoinAddress && v.payoutRouterAddress);

    default:
      return vaults;
  }
}
