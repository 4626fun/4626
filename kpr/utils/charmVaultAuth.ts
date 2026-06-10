import { getAddress, isAddress, type Address } from 'viem';

import { readContract } from './onchain.js';
import {
  isProtocolTreasuryManager,
  isProtocolAutomationManager,
  resolveCharmAutomationAuthorization,
  type CharmAutomationAuthorization,
} from './protocolTreasurySafe.js';

const CHARM_VAULT_AUTH_ABI = [
  { type: 'function', name: 'manager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'rebalanceDelegate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  { type: 'function', name: 'keeper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

function asAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null;
  return getAddress(value);
}

export type CharmVaultAuthSnapshot = {
  managerAddress: Address | null;
  delegateAddress: Address | null;
  charmKeeper: Address | null;
  charmOwner: Address | null;
};

async function readAuthField(
  charmVaultAddress: `0x${string}`,
  functionName: 'manager' | 'rebalanceDelegate' | 'keeper' | 'owner',
): Promise<unknown> {
  return readContract<unknown>({
    address: charmVaultAddress,
    abi: CHARM_VAULT_AUTH_ABI,
    functionName,
  }).catch(() => null);
}

/** Reads on-chain Charm auth slots; skips keeper/owner when manager is protocol treasury. */
export async function readCharmVaultAuthSnapshot(
  charmVaultAddress: `0x${string}`,
): Promise<CharmVaultAuthSnapshot> {
  const [managerRaw, delegateRaw] = await Promise.all([
    readAuthField(charmVaultAddress, 'manager'),
    readAuthField(charmVaultAddress, 'rebalanceDelegate'),
  ]);
  const managerAddress = asAddress(managerRaw);
  const delegateAddress = asAddress(delegateRaw);

  if (isProtocolAutomationManager(managerAddress) || isProtocolTreasuryManager(managerAddress)) {
    return { managerAddress, delegateAddress, charmKeeper: null, charmOwner: null };
  }

  const [charmKeeperRaw, charmOwnerRaw] = await Promise.all([
    readAuthField(charmVaultAddress, 'keeper'),
    readAuthField(charmVaultAddress, 'owner'),
  ]);

  return {
    managerAddress,
    delegateAddress,
    charmKeeper: asAddress(charmKeeperRaw),
    charmOwner: asAddress(charmOwnerRaw),
  };
}

export function resolveCharmKeeperAuthorization(params: {
  snapshot: CharmVaultAuthSnapshot;
  keeperAddress: Address;
}): CharmAutomationAuthorization {
  return resolveCharmAutomationAuthorization({
    ...params.snapshot,
    keeperAddress: params.keeperAddress,
  });
}
