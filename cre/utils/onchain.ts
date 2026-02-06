/**
 * Shared viem client setup and onchain read/write helpers for CRE workflows.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { requireEnv } from '../config.js';

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
 * Return the keeper wallet address derived from the private key.
 */
export function getKeeperAddress(): `0x${string}` {
  const pk = requireEnv('KEEPR_PRIVATE_KEY');
  const account = privateKeyToAccount(pk as `0x${string}`);
  return account.address;
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
// Write helpers
// ---------------------------------------------------------------------------

export interface WriteResult {
  txHash: `0x${string}`;
  success: boolean;
  error?: string;
  simulated?: boolean;
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
}): Promise<WriteResult> {
  const publicClient = getPublicClient();

  // In dry-run mode, simulate the transaction
  if (isDryRun()) {
    try {
      const pk = requireEnv('KEEPR_PRIVATE_KEY');
      const account = privateKeyToAccount(pk as `0x${string}`);

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

  // Normal execution: send real transaction
  const wallet = getWalletClient();

  try {
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
