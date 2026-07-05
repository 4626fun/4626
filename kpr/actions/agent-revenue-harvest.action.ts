/**
 * Agent Revenue Harvest — harvests AgentTokenV4 tax balances via AgentRevenueRouter (V2).
 *
 * V1: no-op when agentRevenueRouterAddress is unset or projectTaxRecipient is not the router.
 */

import { getAddress, type Address } from 'viem';
import { alertInfo } from '../utils/alerts.js';
import {
  fetchActiveVaults,
  filterVaultsForWorkflow,
  type VaultConfig,
} from '../utils/registry.js';
import { readContract, writeContract } from '../utils/onchain.js';

const WORKFLOW_NAME = 'agent-revenue-harvest';

const AGENT_TOKEN_ABI = [
  {
    type: 'function',
    name: 'projectTaxPendingSwap',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'distributeTaxTokens',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'projectTaxRecipient',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

export interface AgentRevenueHarvestResult {
  vaultId: string;
  skipped: boolean;
  skippedReason?: string;
  distributeTxHash?: string;
}

export async function runAgentRevenueHarvest(options?: { dryRun?: boolean }): Promise<AgentRevenueHarvestResult[]> {
  const dryRun = options?.dryRun ?? false;
  const vaults = filterVaultsForWorkflow(await fetchActiveVaults(), WORKFLOW_NAME);
  const results: AgentRevenueHarvestResult[] = [];

  for (const vault of vaults) {
    results.push(await harvestVault(vault, dryRun));
  }

  if (results.length === 0) {
    await alertInfo(WORKFLOW_NAME, 'No agent vaults configured for agent-revenue-harvest');
  }

  return results;
}

async function harvestVault(vault: VaultConfig, dryRun: boolean): Promise<AgentRevenueHarvestResult> {
  const router = vault.agentRevenueRouterAddress;
  if (!router) {
    return { vaultId: vault.groupId, skipped: true, skippedReason: 'no_agent_revenue_router' };
  }

  const token = vault.creatorCoinAddress;
  if (!token) {
    return { vaultId: vault.groupId, skipped: true, skippedReason: 'no_token' };
  }

  const recipient = (await readContract({
    address: token,
    abi: AGENT_TOKEN_ABI,
    functionName: 'projectTaxRecipient',
  })) as Address;

  if (getAddress(recipient).toLowerCase() !== getAddress(router).toLowerCase()) {
    return { vaultId: vault.groupId, skipped: true, skippedReason: 'tax_recipient_not_router' };
  }

  const pending = await readContract({
    address: token,
    abi: AGENT_TOKEN_ABI,
    functionName: 'projectTaxPendingSwap',
  });

  if (pending === 0n) {
    return { vaultId: vault.groupId, skipped: true, skippedReason: 'no_pending_tax' };
  }

  if (dryRun) {
    return { vaultId: vault.groupId, skipped: true, skippedReason: 'dry_run' };
  }

  const tx = await writeContract({
    address: token,
    abi: AGENT_TOKEN_ABI,
    functionName: 'distributeTaxTokens',
  });

  return { vaultId: vault.groupId, skipped: false, distributeTxHash: tx.txHash };
}

export default runAgentRevenueHarvest;
