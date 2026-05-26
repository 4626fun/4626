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

export const KEEPER_AUTOMATION_PRIVATE_KEY_ENV = '4626_KEEPER_AUTOMATION_PRIVATE_KEY';
export const KEEPER_AUTOMATION_PUBLIC_KEY_ENV = '4626_KEEPER_AUTOMATION_PUBLIC_KEY';

const PROTOCOL_AUTOMATION_SAFE_SIGNER_PRIVATE_KEY_ENVS = [
  KEEPER_AUTOMATION_PRIVATE_KEY_ENV,
  'PROTOCOL_AUTOMATION_SAFE_OWNER_PK',
] as const;

const PROTOCOL_TREASURY_SAFE_SIGNER_PRIVATE_KEY_ENVS = [
  ...PROTOCOL_AUTOMATION_SAFE_SIGNER_PRIVATE_KEY_ENVS,
  'PROTOCOL_TREASURY_SAFE_OWNER_PK',
  'KPR_PRIVATE_KEY',
  'PRIVATE_KEY',
] as const;

function readHexPrivateKey(key: string): `0x${string}` | null {
  const raw = (process.env[key] ?? '').trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw as `0x${string}`;
  return null;
}

function readConfiguredAddress(key: string): Address | null {
  const raw = (process.env[key] ?? '').trim();
  if (!raw || !isAddress(raw)) return null;
  return getAddress(raw);
}

export function resolveProtocolTreasuryAddress(): Address {
  const configured = (process.env.PROTOCOL_TREASURY ?? '').trim();
  const candidate = configured && isAddress(configured) ? configured : PROTOCOL_TREASURY_ADDRESS;
  return getAddress(candidate);
}

export function resolveProtocolAutomationAddress(): Address | null {
  return (
    readConfiguredAddress('PROTOCOL_AUTOMATION_SAFE') ??
    readConfiguredAddress('4626_PROTOCOL_AUTOMATION_SAFE')
  );
}

export function resolveProtocolAutomationSafeOwnerPrivateKey(): `0x${string}` | null {
  for (const key of PROTOCOL_AUTOMATION_SAFE_SIGNER_PRIVATE_KEY_ENVS) {
    const pk = readHexPrivateKey(key);
    if (pk) return pk;
  }
  return null;
}

export function resolveProtocolTreasurySafeOwnerPrivateKey(): `0x${string}` | null {
  for (const key of PROTOCOL_TREASURY_SAFE_SIGNER_PRIVATE_KEY_ENVS) {
    const pk = readHexPrivateKey(key);
    if (pk) return pk;
  }
  return null;
}

export function resolveKeeperAutomationPrivateKey(): `0x${string}` | null {
  return resolveProtocolAutomationSafeOwnerPrivateKey() ?? resolveProtocolTreasurySafeOwnerPrivateKey();
}

export function resolveKeeperAutomationPublicAddress(): Address | null {
  const configured = (process.env[KEEPER_AUTOMATION_PUBLIC_KEY_ENV] ?? '').trim();
  if (configured && isAddress(configured)) return getAddress(configured);

  const automationPk = readHexPrivateKey(KEEPER_AUTOMATION_PRIVATE_KEY_ENV);
  if (automationPk) return getAddress(privateKeyToAccount(automationPk).address);
  return null;
}

/** On-chain Ajna `keeper` slot — automation EOA for liquidity moves. */
export function resolveProtocolAjnaKeeperAddress(): Address | null {
  return (
    readConfiguredAddress('PROTOCOL_AJNA_KEEPER') ??
    readConfiguredAddress('VITE_PROTOCOL_AJNA_KEEPER') ??
    resolveKeeperAutomationPublicAddress()
  );
}

export function assertKeeperAutomationKeyPair(): void {
  const configuredPublic = (process.env[KEEPER_AUTOMATION_PUBLIC_KEY_ENV] ?? '').trim();
  if (!configuredPublic) return;

  const automationPk = readHexPrivateKey(KEEPER_AUTOMATION_PRIVATE_KEY_ENV);
  if (!automationPk) {
    throw new Error('keeper_automation_public_key_without_private_key');
  }
  if (!isAddress(configuredPublic)) {
    throw new Error('keeper_automation_public_key_invalid');
  }

  const derived = getAddress(privateKeyToAccount(automationPk).address);
  if (derived.toLowerCase() !== getAddress(configuredPublic).toLowerCase()) {
    throw new Error(`keeper_automation_key_pair_mismatch:expected=${derived}`);
  }
}

export function isSameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return getAddress(a).toLowerCase() === getAddress(b).toLowerCase();
  } catch {
    return false;
  }
}

export function isProtocolAutomationManager(managerAddress: string | null | undefined): boolean {
  const automationSafe = resolveProtocolAutomationAddress();
  if (!automationSafe || !managerAddress) return false;
  return isSameAddress(managerAddress, automationSafe);
}

export function isProtocolAutomationAjnaAdmin(adminAddress: string | null | undefined): boolean {
  return isProtocolAutomationManager(adminAddress);
}

export function isProtocolTreasuryManager(managerAddress: string | null | undefined): boolean {
  if (!managerAddress) return false;
  return isSameAddress(managerAddress, resolveProtocolTreasuryAddress());
}

export type CharmAutomationAuthorization =
  | { authorized: true; lane: 'protocol_automation_manager' }
  | { authorized: true; lane: 'protocol_treasury_manager' }
  | { authorized: true; lane: 'keeper_direct' }
  | { authorized: false; reason: string };

export function resolveCharmAutomationAuthorization(params: {
  managerAddress: string | null | undefined;
  delegateAddress: string | null | undefined;
  charmKeeper: string | null | undefined;
  charmOwner: string | null | undefined;
  keeperAddress: string;
}): CharmAutomationAuthorization {
  if (isProtocolAutomationManager(params.managerAddress)) {
    return { authorized: true, lane: 'protocol_automation_manager' };
  }

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

export type AjnaRebucketAuthorization =
  | { authorized: true; lane: 'protocol_automation_admin' }
  | { authorized: true; lane: 'legacy_treasury_admin' }
  | { authorized: true; lane: 'legacy_csw_admin' }
  | { authorized: false; reason: string };

export function resolveAjnaRebucketAuthorization(params: {
  authAdmin: Address;
  canonicalCswAddress?: Address | null;
}): AjnaRebucketAuthorization {
  if (isProtocolAutomationAjnaAdmin(params.authAdmin)) {
    return { authorized: true, lane: 'protocol_automation_admin' };
  }
  if (isProtocolTreasuryManager(params.authAdmin)) {
    return { authorized: true, lane: 'legacy_treasury_admin' };
  }
  if (params.canonicalCswAddress && isSameAddress(params.authAdmin, params.canonicalCswAddress)) {
    return { authorized: true, lane: 'legacy_csw_admin' };
  }
  return { authorized: false, reason: 'ajna_auth_admin_mismatch' };
}

async function assertSafeOwner(params: {
  safeAddress: Address;
  ownerAddress: Address;
  errorPrefix: string;
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
    throw new Error(`${params.errorPrefix}:${params.ownerAddress}`);
  }
}

async function executeViaSafe(params: {
  safeAddress: Address;
  privateKey: `0x${string}`;
  to: Address;
  data: Hex;
  ownerErrorPrefix: string;
  txHashMissingError: string;
  txRevertedError: string;
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  assertKeeperAutomationKeyPair();
  const rpcUrl = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org';
  const signerAddress = getAddress(privateKeyToAccount(params.privateKey).address);

  await assertSafeOwner({
    safeAddress: params.safeAddress,
    ownerAddress: signerAddress,
    errorPrefix: params.ownerErrorPrefix,
  });

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: params.privateKey,
    safeAddress: params.safeAddress,
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
    throw new Error(params.txHashMissingError);
  }

  const publicClient = getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
  if (receipt.status !== 'success') {
    throw new Error(params.txRevertedError);
  }

  return { txHash, safeAddress: params.safeAddress, signerAddress };
}

export async function executeCharmRebalanceViaProtocolAutomationSafe(params: {
  charmVaultAddress: Address;
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const automationSafe = resolveProtocolAutomationAddress();
  if (!automationSafe) {
    throw new Error('protocol_automation_safe_not_configured');
  }

  const privateKey = resolveProtocolAutomationSafeOwnerPrivateKey();
  if (!privateKey) {
    throw new Error('protocol_automation_safe_owner_key_missing');
  }

  const data = encodeFunctionData({
    abi: CHARM_REBALANCE_ABI,
    functionName: 'rebalance',
    args: [],
  }) as Hex;

  return executeViaSafe({
    safeAddress: automationSafe,
    privateKey,
    to: params.charmVaultAddress,
    data,
    ownerErrorPrefix: 'protocol_automation_safe_signer_not_owner',
    txHashMissingError: 'protocol_automation_safe_tx_hash_missing',
    txRevertedError: 'protocol_automation_safe_tx_reverted',
  });
}

export async function executeCharmRebalanceViaProtocolTreasurySafe(params: {
  charmVaultAddress: Address;
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const privateKey = resolveProtocolTreasurySafeOwnerPrivateKey();
  if (!privateKey) {
    throw new Error('protocol_treasury_safe_owner_key_missing');
  }

  const data = encodeFunctionData({
    abi: CHARM_REBALANCE_ABI,
    functionName: 'rebalance',
    args: [],
  }) as Hex;

  return executeViaSafe({
    safeAddress: resolveProtocolTreasuryAddress(),
    privateKey,
    to: params.charmVaultAddress,
    data,
    ownerErrorPrefix: 'protocol_treasury_safe_signer_not_owner',
    txHashMissingError: 'protocol_treasury_safe_tx_hash_missing',
    txRevertedError: 'protocol_treasury_safe_tx_reverted',
  });
}

export async function executeViaProtocolAutomationSafe(params: {
  to: Address;
  data: Hex;
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const automationSafe = resolveProtocolAutomationAddress();
  if (!automationSafe) {
    throw new Error('protocol_automation_safe_not_configured');
  }

  const privateKey = resolveProtocolAutomationSafeOwnerPrivateKey();
  if (!privateKey) {
    throw new Error('protocol_automation_safe_owner_key_missing');
  }

  return executeViaSafe({
    safeAddress: automationSafe,
    privateKey,
    to: params.to,
    data: params.data,
    ownerErrorPrefix: 'protocol_automation_safe_signer_not_owner',
    txHashMissingError: 'protocol_automation_safe_tx_hash_missing',
    txRevertedError: 'protocol_automation_safe_tx_reverted',
  });
}

export async function executeViaProtocolTreasurySafe(params: {
  to: Address;
  data: Hex;
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const privateKey = resolveProtocolTreasurySafeOwnerPrivateKey();
  if (!privateKey) {
    throw new Error('protocol_treasury_safe_owner_key_missing');
  }

  return executeViaSafe({
    safeAddress: resolveProtocolTreasuryAddress(),
    privateKey,
    to: params.to,
    data: params.data,
    ownerErrorPrefix: 'protocol_treasury_safe_signer_not_owner',
    txHashMissingError: 'protocol_treasury_safe_tx_hash_missing',
    txRevertedError: 'protocol_treasury_safe_tx_reverted',
  });
}
