import SafeKit from '@safe-global/protocol-kit';
import { OperationType } from '@safe-global/types-kit';
import { encodeFunctionData, getAddress, isAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { PROTOCOL_TREASURY_ADDRESS } from '../config.js';
import { getPublicClient } from './onchain.js';

type SafeProtocolKit = {
  init: (config: {
    provider: string;
    signer: string;
    safeAddress: Address;
  }) => Promise<{
    createTransaction: (input: {
      transactions: Array<{
        to: Address;
        value: string;
        data: Hex;
        operation: OperationType;
      }>;
    }) => Promise<unknown>;
    executeTransaction: (
      tx: unknown,
    ) => Promise<{ hash?: `0x${string}`; transactionResponse?: { hash?: `0x${string}` } }>;
  }>;
};

const Safe = SafeKit as unknown as SafeProtocolKit;

const GNOSIS_SAFE_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const;

const CHARM_REBALANCE_ABI = [
  { type: 'function', name: 'rebalance', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

export function resolveProtocolTreasuryAddress(): Address {
  const configured = (process.env.PROTOCOL_TREASURY ?? '').trim();
  const candidate = configured && isAddress(configured) ? configured : PROTOCOL_TREASURY_ADDRESS;
  return getAddress(candidate);
}

export function resolveProtocolTreasurySafeOwnerPrivateKey(): `0x${string}` | null {
  for (const key of ['PROTOCOL_TREASURY_SAFE_OWNER_PK', 'KPR_PRIVATE_KEY', 'PRIVATE_KEY']) {
    const raw = (process.env[key] ?? '').trim();
    if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw as `0x${string}`;
  }
  return null;
}

export function isSameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return getAddress(a).toLowerCase() === getAddress(b).toLowerCase();
  } catch {
    return false;
  }
}

export function isProtocolTreasuryManager(managerAddress: string | null | undefined): boolean {
  if (!managerAddress) return false;
  return isSameAddress(managerAddress, resolveProtocolTreasuryAddress());
}

export type CharmAutomationAuthorization =
  | { authorized: true; lane: 'protocol_treasury_manager' }
  | { authorized: true; lane: 'keeper_direct' }
  | { authorized: false; reason: string };

/** Gate Charm enqueue/execute: protocol treasury manager lane, or legacy keeper/direct paths. */
export function resolveCharmAutomationAuthorization(params: {
  managerAddress: string | null | undefined;
  delegateAddress: string | null | undefined;
  charmKeeper: string | null | undefined;
  charmOwner: string | null | undefined;
  keeperAddress: string;
}): CharmAutomationAuthorization {
  if (isProtocolTreasuryManager(params.managerAddress)) {
    return { authorized: true, lane: 'protocol_treasury_manager' };
  }

  if (params.delegateAddress && isSameAddress(params.delegateAddress, params.keeperAddress)) {
    return { authorized: true, lane: 'keeper_direct' };
  }

  if (params.charmKeeper && !isSameAddress(params.charmKeeper, params.keeperAddress)) {
    return { authorized: false, reason: 'keeper_not_charm_vault_keeper' };
  }

  if (
    !params.charmKeeper &&
    params.charmOwner &&
    !isSameAddress(params.charmOwner, params.keeperAddress)
  ) {
    return { authorized: false, reason: 'keeper_not_charm_vault_owner' };
  }

  if (!params.charmKeeper && !params.charmOwner && !params.delegateAddress) {
    return { authorized: false, reason: 'charm_automation_not_configured' };
  }

  return { authorized: true, lane: 'keeper_direct' };
}

async function assertProtocolTreasurySafeOwner(params: {
  safeAddress: Address;
  ownerAddress: Address;
}): Promise<void> {
  const publicClient = getPublicClient();
  const ownersRaw = await publicClient.readContract({
    address: params.safeAddress,
    abi: GNOSIS_SAFE_ABI,
    functionName: 'getOwners',
  });
  const owners = Array.isArray(ownersRaw)
    ? ownersRaw.map((owner) => getAddress(String(owner)).toLowerCase())
    : [];
  if (!owners.includes(params.ownerAddress.toLowerCase())) {
    throw new Error(`protocol_treasury_safe_signer_not_owner:${params.ownerAddress}`);
  }
}

async function executeViaProtocolTreasurySafe(params: {
  to: Address;
  data: Hex;
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const privateKey = resolveProtocolTreasurySafeOwnerPrivateKey();
  if (!privateKey) {
    throw new Error('protocol_treasury_safe_owner_key_missing');
  }

  const rpcUrl = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org';
  const safeAddress = resolveProtocolTreasuryAddress();
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address);

  await assertProtocolTreasurySafeOwner({ safeAddress, ownerAddress: signerAddress });

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: privateKey,
    safeAddress,
  });

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [
      {
        to: params.to,
        value: '0',
        data: params.data,
        operation: OperationType.Call,
      },
    ],
  });

  const executeResponse = await protocolKit.executeTransaction(safeTransaction);
  const txHash = (executeResponse.hash ??
    (executeResponse as { transactionResponse?: { hash?: `0x${string}` } }).transactionResponse?.hash) as
    | `0x${string}`
    | undefined;
  if (!txHash) {
    throw new Error('protocol_treasury_safe_tx_hash_missing');
  }

  const publicClient = getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
  if (receipt.status !== 'success') {
    throw new Error('protocol_treasury_safe_tx_reverted');
  }

  return { txHash, safeAddress, signerAddress };
}

export async function executeCharmRebalanceViaProtocolTreasurySafe(params: {
  charmVaultAddress: Address;
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const data = encodeFunctionData({
    abi: CHARM_REBALANCE_ABI,
    functionName: 'rebalance',
    args: [],
  }) as Hex;
  return executeViaProtocolTreasurySafe({ to: params.charmVaultAddress, data });
}
