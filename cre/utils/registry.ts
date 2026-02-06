/**
 * Vault registry client — fetches active vaults from the API.
 */

import { requireEnv } from '../config.js';

export interface VaultConfig {
  vaultAddress: `0x${string}`;
  chainId: number;
  creatorCoinAddress: `0x${string}`;
  ccaStrategyAddress?: `0x${string}`;
  oracleAddress?: `0x${string}`;
  vrfHubAddress?: `0x${string}`;
  groupId: string;
  extra?: Record<string, unknown>;
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

  return data.data.vaults;
}

/**
 * Filter vaults that have all required addresses for a specific workflow.
 */
export function filterVaultsForWorkflow(
  vaults: VaultConfig[],
  workflow: 'vault-keeper' | 'auction-settlement' | 'oracle-broadcaster' | 'vrf-health-monitor'
): VaultConfig[] {
  switch (workflow) {
    case 'vault-keeper':
      // Vault keeper only needs the vault address
      return vaults.filter((v) => v.vaultAddress);

    case 'auction-settlement':
      // Auction settlement needs CCA strategy address
      return vaults.filter((v) => v.vaultAddress && v.ccaStrategyAddress);

    case 'oracle-broadcaster':
      // Oracle broadcaster needs oracle address
      return vaults.filter((v) => v.vaultAddress && v.oracleAddress);

    case 'vrf-health-monitor':
      // VRF monitor needs VRF hub address
      return vaults.filter((v) => v.vaultAddress && v.vrfHubAddress);

    default:
      return vaults;
  }
}
