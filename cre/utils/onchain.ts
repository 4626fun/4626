/**
 * Shared viem client setup and onchain read/write helpers for CRE workflows.
 */

import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Abi,
  type Address,
  type Hex,
  type SignableMessage,
} from 'viem';
import { privateKeyToAccount, toAccount } from 'viem/accounts';
import {
  createBundlerClient,
  createPaymasterClient,
  entryPoint06Address,
  sendUserOperation,
  toCoinbaseSmartAccount,
  waitForUserOperationReceipt,
} from 'viem/account-abstraction';
import { base } from 'viem/chains';
import { requireEnv } from '../config.js';
import { secp256k1SignHash, walletRpc } from './privyWalletApi.js';

// ---------------------------------------------------------------------------
// ERC-4337 (Coinbase Smart Wallet) constants
// ---------------------------------------------------------------------------

const ENTRYPOINT_V06 = getAddress(entryPoint06Address);
const ENTRYPOINT_V06_EXPECTED = getAddress('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789');

if (ENTRYPOINT_V06 !== ENTRYPOINT_V06_EXPECTED) {
  throw new Error(
    `EntryPoint v0.6 address mismatch! Expected ${ENTRYPOINT_V06_EXPECTED}, got ${ENTRYPOINT_V06}. ` +
      'This may indicate a viem version mismatch.',
  );
}

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

type Erc4337Config = {
  smartWallet: Address;
  bundlerUrl: string;
  paymasterUrl: string;
  ownerAccount: ReturnType<typeof privateKeyToAccount> | ReturnType<typeof toAccount>;
  ownerAddress: Address;
  signerType: 'private-key' | 'privy-wallet';
  version: '1' | '1.1';
};

export const AJNA_AUTOMATION_SCOPE = 'ajna_min_bucket_only';

export interface CanonicalAjnaAutomationConfig {
  automationEnabled: boolean;
  automationScope?: string;
  canonicalCswAddress?: Address | null;
  embeddedEoaAddress?: Address | null;
  privyWalletId?: string | null;
}

export interface WriteExecutionContext {
  smartWallet: Address;
  ownerAddress: Address;
  privyWalletId: string;
  version?: '1' | '1.1';
}

function resolveExecutionContextVersion(version?: '1' | '1.1'): '1' | '1.1' {
  return version === '1.1' ? '1.1' : '1';
}

export function normalizeWriteExecutionContext(
  executionContext?: Partial<WriteExecutionContext>,
): WriteExecutionContext | null {
  if (executionContext === undefined) return null;

  const smartWalletRaw = executionContext?.smartWallet;
  const ownerAddressRaw = executionContext?.ownerAddress;
  const privyWalletId = String(executionContext?.privyWalletId ?? '').trim();

  if (!smartWalletRaw || !ownerAddressRaw || !privyWalletId) {
    throw new Error('execution_context_incomplete');
  }
  if (!isAddress(smartWalletRaw)) {
    throw new Error(`Invalid executionContext.smartWallet address: ${smartWalletRaw}`);
  }
  if (!isAddress(ownerAddressRaw)) {
    throw new Error(`Invalid executionContext.ownerAddress address: ${ownerAddressRaw}`);
  }

  return {
    smartWallet: getAddress(smartWalletRaw),
    ownerAddress: getAddress(ownerAddressRaw),
    privyWalletId,
    version: resolveExecutionContextVersion(executionContext?.version),
  };
}

export function resolveCanonicalAjnaExecutionContext(
  automation?: CanonicalAjnaAutomationConfig | null,
): WriteExecutionContext | null {
  if (!automation?.automationEnabled) return null;
  if (automation.automationScope !== AJNA_AUTOMATION_SCOPE) return null;

  const canonicalCswAddress = automation.canonicalCswAddress ?? null;
  const embeddedEoaAddress = automation.embeddedEoaAddress ?? null;
  const privyWalletId = String(automation.privyWalletId ?? '').trim();

  if (!canonicalCswAddress || !embeddedEoaAddress || !privyWalletId) {
    return null;
  }
  if (!isAddress(canonicalCswAddress) || !isAddress(embeddedEoaAddress)) {
    return null;
  }

  return {
    smartWallet: getAddress(canonicalCswAddress),
    ownerAddress: getAddress(embeddedEoaAddress),
    privyWalletId,
    version: '1',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _erc4337Config: Erc4337Config | null | undefined = undefined;

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _walletClient: any = null;

/**
 * Get a singleton public (read-only) client for Base.
 */
export function getPublicClient() {
  if (!_publicClient) {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    _publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 30_000 }),
    });
  }
  return _publicClient!;
}

/**
 * Get a singleton wallet client for onchain writes.
 * The private key is loaded from the CRE secret `KEEPR_PRIVATE_KEY`.
 */
export function getWalletClient() {
  if (!_walletClient) {
    const pk = requireEnv('KEEPR_PRIVATE_KEY');
    const account = privateKeyToAccount(pk as `0x${string}`);
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    _walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(rpcUrl, { timeout: 30_000 }),
    });
  }
  return _walletClient!;
}

/**
 * True when ERC-4337 mode is enabled for CRE.
 */
function isErc4337Enabled(): boolean {
  return process.env.CRE_ERC4337_ENABLED === 'true';
}

/**
 * Return the keeper EOA account derived from the private key.
 */
function getKeeperEoaAccount() {
  const pk = requireEnv('KEEPR_PRIVATE_KEY');
  return privateKeyToAccount(pk as `0x${string}`);
}

/**
 * Return the keeper EOA address (legacy mode).
 */
export function getKeeperEoaAddress(): Address {
  return getKeeperEoaAccount().address;
}

/**
 * Return the ERC-4337 owner account used to sign UserOperations (private key).
 */
function getErc4337OwnerAccountFromPrivateKey() {
  const pk =
    (process.env.CRE_ERC4337_OWNER_PRIVATE_KEY ?? process.env.KEEPR_PRIVATE_KEY ?? '').trim();
  if (!pk) {
    throw new Error(
      'Missing ERC-4337 signer. Set CRE_ERC4337_OWNER_PRIVATE_KEY (or KEEPR_PRIVATE_KEY fallback).',
    );
  }
  return privateKeyToAccount(pk as `0x${string}`);
}

/**
 * Return the ERC-4337 owner account backed by a Privy wallet API signer.
 */
function getErc4337OwnerAccountFromPrivy(params?: {
  walletId?: string;
  ownerAddress?: Address;
}): {
  account: ReturnType<typeof toAccount>;
  address: Address;
} {
  const walletId = (params?.walletId ?? process.env.CRE_ERC4337_PRIVY_WALLET_ID ?? '').trim();
  if (!walletId) {
    throw new Error('CRE_ERC4337_PRIVY_WALLET_ID missing');
  }
  const ownerRaw = String(params?.ownerAddress ?? process.env.CRE_ERC4337_OWNER ?? '').trim();
  if (!ownerRaw) {
    throw new Error('CRE_ERC4337_OWNER required when using CRE_ERC4337_PRIVY_WALLET_ID');
  }
  if (!isAddress(ownerRaw)) {
    throw new Error(`Invalid CRE_ERC4337_OWNER address: ${ownerRaw}`);
  }
  const ownerAddress = getAddress(ownerRaw);
  const account = toAccount({
    address: ownerAddress,
    sign: async ({ hash }: { hash: Hex }) => {
      return (await secp256k1SignHash({ walletId, hash })) as Hex;
    },
    signTransaction: async () => {
      throw new Error('privy_sign_transaction_unsupported');
    },
    signMessage: async ({ message }: { message: SignableMessage }) => {
      const msg =
        typeof message === 'string'
          ? message
          : typeof message.raw === 'string'
            ? message.raw
            : `0x${Buffer.from(message.raw).toString('hex')}`;
      const out = await walletRpc<any>({
        walletId,
        method: 'personal_sign',
        rpcParams: { message: msg, encoding: 'hex' },
      });
      const sig = String(out?.data?.signature ?? '').trim();
      if (!/^0x[0-9a-fA-F]+$/.test(sig)) {
        throw new Error('privy_personal_sign_invalid_signature');
      }
      return sig as Hex;
    },
    signTypedData: async () => {
      throw new Error('privy_sign_typed_data_unsupported');
    },
  });
  return { account, address: ownerAddress };
}

/**
 * Resolve ERC-4337 configuration from env. Returns null when disabled.
 */
function getErc4337Config(
  executionContext?: Partial<WriteExecutionContext>,
): Erc4337Config | null {
  const resolvedExecutionContext = normalizeWriteExecutionContext(executionContext);
  if (resolvedExecutionContext) {
    const bundlerUrl = requireEnv('CRE_ERC4337_BUNDLER_URL');
    const paymasterUrl =
      (process.env.CRE_ERC4337_PAYMASTER_URL ?? '').trim() || bundlerUrl;
    const privyOwner = getErc4337OwnerAccountFromPrivy({
      walletId: resolvedExecutionContext.privyWalletId,
      ownerAddress: resolvedExecutionContext.ownerAddress,
    });

    return {
      smartWallet: resolvedExecutionContext.smartWallet,
      bundlerUrl,
      paymasterUrl,
      ownerAccount: privyOwner.account,
      ownerAddress: privyOwner.address,
      signerType: 'privy-wallet',
      version: resolveExecutionContextVersion(resolvedExecutionContext.version),
    };
  }

  if (_erc4337Config !== undefined) return _erc4337Config;
  if (!isErc4337Enabled()) {
    _erc4337Config = null;
    return _erc4337Config;
  }

  const smartWalletRaw = requireEnv('CRE_ERC4337_SMART_WALLET');
  const bundlerUrl = requireEnv('CRE_ERC4337_BUNDLER_URL');
  const paymasterUrl =
    (process.env.CRE_ERC4337_PAYMASTER_URL ?? '').trim() || bundlerUrl;
  const versionRaw = (process.env.CRE_ERC4337_VERSION ?? '1').trim();
  const version: '1' | '1.1' = versionRaw === '1.1' ? '1.1' : '1';

  const privyWalletId = (process.env.CRE_ERC4337_PRIVY_WALLET_ID ?? '').trim();
  let ownerAccount: Erc4337Config['ownerAccount'];
  let ownerAddress: Address;
  let signerType: Erc4337Config['signerType'] = 'private-key';

  if (privyWalletId) {
    const privyOwner = getErc4337OwnerAccountFromPrivy();
    ownerAccount = privyOwner.account;
    ownerAddress = privyOwner.address;
    signerType = 'privy-wallet';
  } else {
    ownerAccount = getErc4337OwnerAccountFromPrivateKey();
    const ownerAddressRaw = (process.env.CRE_ERC4337_OWNER ?? ownerAccount.address).trim();
    if (!isAddress(ownerAddressRaw)) {
      throw new Error(`Invalid CRE_ERC4337_OWNER address: ${ownerAddressRaw}`);
    }
    ownerAddress = getAddress(ownerAddressRaw);
    if (ownerAddress !== getAddress(ownerAccount.address)) {
      throw new Error(
        'CRE_ERC4337_OWNER must match CRE_ERC4337_OWNER_PRIVATE_KEY address when using private-key signing.',
      );
    }
  }

  _erc4337Config = {
    smartWallet: getAddress(smartWalletRaw as Address),
    bundlerUrl,
    paymasterUrl,
    ownerAccount,
    ownerAddress,
    signerType,
    version,
  };
  return _erc4337Config;
}

/**
 * Return the active keeper address (smart wallet if ERC-4337 is enabled).
 */
export function getKeeperAddress(): Address {
  const erc4337 = getErc4337Config();
  if (erc4337) return erc4337.smartWallet;
  return getKeeperEoaAddress();
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Read a single value from a contract.
 */
export async function readContract<T = unknown>(params: {
  address: `0x${string}`;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}): Promise<T> {
  const client = getPublicClient();
  return client.readContract({
    address: params.address,
    abi: params.abi as Abi,
    functionName: params.functionName,
    args: params.args,
  }) as Promise<T>;
}

/**
 * Read the current block timestamp.
 */
export async function getBlockTimestamp(): Promise<bigint> {
  const client = getPublicClient();
  const block = await client.getBlock({ blockTag: 'latest' });
  return block.timestamp;
}

/**
 * Get the ETH balance of an address.
 */
export async function getBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  return client.getBalance({ address });
}

// ---------------------------------------------------------------------------
// ERC-4337 helpers
// ---------------------------------------------------------------------------

function asOwnerBytes(owner: Address): Hex {
  // Coinbase Smart Wallet stores owners as 32-byte left-padded address bytes.
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex;
}

async function findCoinbaseSmartWalletOwnerIndex(params: {
  publicClient: ReturnType<typeof getPublicClient>;
  smartWallet: Address;
  ownerAddress: Address;
  maxScan?: number;
}): Promise<{ ownerIndex: number | null; ownerCount: number }> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 256 } = params;
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint;
  const count = Number(countRaw);
  if (!Number.isFinite(count) || count <= 0) return { ownerIndex: null, ownerCount: 0 };

  let upperBound = count;
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint;
    const next = Number(nextRaw);
    if (Number.isFinite(next) && next > 0) upperBound = next;
  } catch {
    // ignore; fallback to ownerCount
  }

  const expected = asOwnerBytes(ownerAddress).toLowerCase();
  const limit = Math.min(upperBound, Math.max(1, maxScan));
  for (let i = 0; i < limit; i += 1) {
    const b = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(i)],
    })) as Hex;
    if (String(b).toLowerCase() === expected) return { ownerIndex: i, ownerCount: count };
  }

  return { ownerIndex: null, ownerCount: count };
}

async function verifyBundlerSupportsV06(bundlerClient: any): Promise<void> {
  try {
    const supported = await bundlerClient.request({
      method: 'eth_supportedEntryPoints',
      params: [],
    });
    const supportedList: string[] = Array.isArray(supported) ? supported : [];
    const supportsV06 = supportedList.some(
      (ep) => getAddress(ep) === ENTRYPOINT_V06,
    );
    if (!supportsV06) {
      throw new Error(
        `Bundler does not support EntryPoint v0.6 (${ENTRYPOINT_V06}). ` +
          `Supported: ${supportedList.join(', ') || 'none'}.`,
      );
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('EntryPoint v0.6')) {
      throw err;
    }
    // Network or upstream errors - warn but allow the UserOp to fail with details.
    console.warn('[CRE][ERC-4337] Unable to verify bundler EntryPoint support:', err);
  }
}

async function sendErc4337UserOperation(params: {
  address: Address;
  data: Hex;
  value?: bigint;
  erc4337: Erc4337Config | null;
}): Promise<WriteResult> {
  const erc4337 = params.erc4337;
  if (!erc4337) {
    throw new Error('ERC-4337 not enabled (set CRE_ERC4337_ENABLED=true).');
  }

  const publicClient = getPublicClient();
  const { ownerIndex } = await findCoinbaseSmartWalletOwnerIndex({
    publicClient,
    smartWallet: erc4337.smartWallet,
    ownerAddress: erc4337.ownerAddress,
  });
  if (ownerIndex === null) {
    throw new Error(
      `ERC-4337 owner (${erc4337.ownerAddress}) is not an onchain owner of ${erc4337.smartWallet}.`,
    );
  }

  const account = await toCoinbaseSmartAccount({
    client: publicClient as any,
    address: erc4337.smartWallet,
    owners: [erc4337.ownerAccount],
    ownerIndex,
    version: erc4337.version,
  });

  const bundlerClient = createBundlerClient({
    client: publicClient as any,
    transport: http(erc4337.bundlerUrl, { timeout: 30_000 }),
  });
  const paymasterClient = erc4337.paymasterUrl
    ? createPaymasterClient({
        transport: http(erc4337.paymasterUrl, { timeout: 30_000 }),
      })
    : null;

  await verifyBundlerSupportsV06(bundlerClient);

  const calls = [{ to: params.address, data: params.data, value: params.value }];

  try {
    const userOpHash = await sendUserOperation(bundlerClient, {
      account,
      calls,
      ...(paymasterClient
        ? {
            paymaster: {
              getPaymasterData: paymasterClient.getPaymasterData,
              getPaymasterStubData: paymasterClient.getPaymasterStubData,
            },
          }
        : {}),
    });

    const receipt = await waitForUserOperationReceipt(bundlerClient, {
      hash: userOpHash,
      timeout: 120_000,
    });

    const receiptAny = receipt as any;
    const txHash =
      receiptAny?.receipt?.transactionHash ??
      receiptAny?.transactionHash ??
      (userOpHash as `0x${string}`);
    const status = receiptAny?.receipt?.status;

    return {
      txHash,
      success: status ? status === 'success' : true,
      userOpHash: userOpHash as `0x${string}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      txHash: '0x0' as `0x${string}`,
      success: false,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

export interface WriteResult {
  txHash: `0x${string}`;
  success: boolean;
  error?: string;
  simulated?: boolean;
  userOpHash?: `0x${string}`;
}

/**
 * Check if dry-run mode is enabled.
 */
export function isDryRun(): boolean {
  return process.env.DRY_RUN === 'true';
}

/**
 * Write to a contract and wait for the transaction receipt.
 * In dry-run mode, simulates the transaction without sending.
 */
export async function writeContract(params: {
  address: `0x${string}`;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  executionContext?: Partial<WriteExecutionContext>;
}): Promise<WriteResult> {
  const publicClient = getPublicClient();
  try {
    // In dry-run mode, simulate the transaction
    if (isDryRun()) {
      try {
        const executionContext = normalizeWriteExecutionContext(params.executionContext);
        const account =
          executionContext?.smartWallet ??
          getErc4337Config()?.smartWallet ??
          getKeeperEoaAddress();

        await publicClient.simulateContract({
          address: params.address,
          abi: params.abi as Abi,
          functionName: params.functionName,
          args: params.args,
          value: params.value,
          account,
        });

        console.log(`[DRY RUN] ✓ ${params.functionName}() would succeed`);
        return {
          txHash: '0xdryrun' as `0x${string}`,
          success: true,
          simulated: true,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`[DRY RUN] ✗ ${params.functionName}() would fail: ${message}`);
        return {
          txHash: '0xdryrun' as `0x${string}`,
          success: false,
          error: message,
          simulated: true,
        };
      }
    }

    const erc4337 = getErc4337Config(params.executionContext);
    if (erc4337) {
      const data = encodeFunctionData({
        abi: params.abi as Abi,
        functionName: params.functionName,
        args: params.args,
      });
      return await sendErc4337UserOperation({
        address: params.address,
        data,
        value: params.value,
        erc4337,
      });
    }

    // Normal execution: send real transaction
    const wallet = getWalletClient();
    const txHash = await wallet.writeContract({
      address: params.address,
      abi: params.abi as Abi,
      functionName: params.functionName,
      args: params.args,
      value: params.value,
      chain: base,
      account: wallet.account!,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
    });

    return {
      txHash,
      success: receipt.status === 'success',
      error: receipt.status !== 'success' ? 'Transaction reverted' : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      txHash: '0x0' as `0x${string}`,
      success: false,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

/**
 * Get recent logs for a specific event.
 */
export async function getLogs(params: {
  address: `0x${string}`;
  abi: Abi | readonly unknown[];
  eventName: string;
  fromBlock?: bigint;
  toBlock?: bigint;
}) {
  const client = getPublicClient();
  const currentBlock = await client.getBlockNumber();
  return client.getLogs({
    address: params.address,
    event: (params.abi as Abi).find(
      (item: any) => item.type === 'event' && item.name === params.eventName,
    ),
    fromBlock: params.fromBlock ?? currentBlock - 1000n,
    toBlock: params.toBlock ?? currentBlock,
  });
}
