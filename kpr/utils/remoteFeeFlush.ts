/**
 * Remote ShareOFT fee flush helpers — multi-chain reads and Privy/EOA writes.
 */

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { parseDotenvJsonObject, requireEnv } from '../config.js';
import { walletRpc } from './privyWalletApi.js';

export type RemoteShareOftFlushTarget = {
  chainId: number;
  lzEid: number;
  shareOft: Address;
  rpcUrl: string;
  label: string;
};

function readEnv(key: string): string {
  return String(process.env[key] ?? '').trim();
}

function readFirstEnv(keys: readonly string[]): string {
  for (const key of keys) {
    const value = readEnv(key);
    if (value) return value;
  }
  return '';
}

export function isRemoteShareOftFlushEnabled(): boolean {
  return readEnv('KPR_REMOTE_SHARE_OFT_FLUSH_ENABLED') === '1';
}

export function resolveHubGaugeController(): Address | null {
  const raw = readFirstEnv(['KPR_REMOTE_FEE_HUB_GAUGE', 'KPR_HUB_GAUGE_CONTROLLER']);
  if (!raw || !isAddress(raw)) return null;
  return getAddress(raw);
}

type RawFlushTarget = {
  chainId?: number | string;
  lzEid?: number | string;
  shareOft?: string;
  rpcUrl?: string;
  rpcEnvKey?: string;
  label?: string;
};

function resolveRpcUrl(entry: RawFlushTarget): string {
  if (entry.rpcUrl && entry.rpcUrl.trim()) return entry.rpcUrl.trim();
  const envKey = String(entry.rpcEnvKey ?? '').trim();
  if (envKey) {
    const fromEnv = readEnv(envKey);
    if (fromEnv) return fromEnv;
    throw new Error(`Missing RPC env ${envKey} for remote ShareOFT flush target`);
  }
  throw new Error('Remote ShareOFT flush target requires rpcUrl or rpcEnvKey');
}

/**
 * Parse `REMOTE_SHARE_OFT_FLUSH_TARGETS` JSON array.
 *
 * Example:
 * REMOTE_SHARE_OFT_FLUSH_TARGETS='[{"chainId":42161,"rpcEnvKey":"ARBITRUM_RPC_URL","shareOft":"0x..."}]'
 */
export function parseRemoteShareOftFlushTargets(): RemoteShareOftFlushTarget[] {
  const inline = readEnv('REMOTE_SHARE_OFT_FLUSH_TARGETS');
  if (!inline) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(inline);
  } catch {
    throw new Error(
      "Invalid REMOTE_SHARE_OFT_FLUSH_TARGETS JSON. Quote-wrap in .env, e.g. REMOTE_SHARE_OFT_FLUSH_TARGETS='[{\"chainId\":42161,...}]'",
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error('REMOTE_SHARE_OFT_FLUSH_TARGETS must be a JSON array');
  }

  const out: RemoteShareOftFlushTarget[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as RawFlushTarget;
    const chainId = Number(entry.chainId);
    const lzEidRaw = entry.lzEid;
    if (lzEidRaw == null || String(lzEidRaw).trim() === '') {
      throw new Error(
        `Remote ShareOFT flush target on chain ${entry.chainId ?? '?'} missing lzEid (LayerZero endpoint id — not chain id)`,
      );
    }
    const lzEid = Number(lzEidRaw);
    const shareOftRaw = String(entry.shareOft ?? '').trim();
    if (!Number.isFinite(chainId) || chainId <= 0) {
      throw new Error('Remote ShareOFT flush target missing valid chainId');
    }
    if (!Number.isFinite(lzEid) || lzEid <= 0) {
      throw new Error(`Remote ShareOFT flush target missing valid lzEid on chain ${chainId}`);
    }
    if (!isAddress(shareOftRaw)) {
      throw new Error(`Remote ShareOFT flush target has invalid shareOft on chain ${chainId}`);
    }
    out.push({
      chainId,
      lzEid,
      shareOft: getAddress(shareOftRaw),
      rpcUrl: resolveRpcUrl(entry),
      label: String(entry.label ?? `chain-${chainId}`),
    });
  }
  return out;
}

const publicClientCache = new Map<number, PublicClient>();

export function getPublicClientForChain(chainId: number, rpcUrl: string): PublicClient {
  const cached = publicClientCache.get(chainId);
  if (cached) return cached;

  const client = createPublicClient({
    chain: {
      ...base,
      id: chainId,
      name: `chain-${chainId}`,
      nativeCurrency: base.nativeCurrency,
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl, { timeout: 30_000 }),
  }) as PublicClient;

  publicClientCache.set(chainId, client);
  return client;
}

export async function readRemoteContract<T>(params: {
  chainId: number;
  rpcUrl: string;
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}): Promise<T> {
  const client = getPublicClientForChain(params.chainId, params.rpcUrl);
  return client.readContract({
    address: params.address,
    abi: params.abi as Abi,
    functionName: params.functionName,
    args: params.args,
  }) as Promise<T>;
}

function resolveRemoteSignerWalletId(): string {
  return readFirstEnv(['KPR_ERC4337_PRIVY_WALLET_ID', 'CANONICAL_CSW_PRIVY_WALLET_ID']);
}

export async function sendRemotePayableTransaction(params: {
  chainId: number;
  rpcUrl: string;
  to: Address;
  data: Hex;
  value: bigint;
  dryRun?: boolean;
}): Promise<{ txHash: Hex; simulated: boolean }> {
  if (params.dryRun) {
    const client = getPublicClientForChain(params.chainId, params.rpcUrl);
    const ownerRaw = readFirstEnv(['KPR_ERC4337_OWNER']);
    const from = isAddress(ownerRaw)
      ? getAddress(ownerRaw)
      : privateKeyToAccount(requireEnv('KPR_PRIVATE_KEY') as `0x${string}`).address;

    await client.call({
      to: params.to,
      data: params.data,
      value: params.value,
      account: from,
    });
    return { txHash: '0xdryrun' as Hex, simulated: true };
  }

  const privyWalletId = resolveRemoteSignerWalletId();
  if (privyWalletId) {
    const caip2 = `eip155:${params.chainId}`;
    const res = await walletRpc<{ data?: { hash?: string } }>({
      walletId: privyWalletId,
      method: 'eth_sendTransaction',
      rpcParams: {
        transaction: {
          to: params.to,
          data: params.data,
          value: `0x${params.value.toString(16)}`,
        },
      },
      caip2,
    });
    const hash = String(res?.data?.hash ?? '').trim();
    if (!/^0x[0-9a-fA-F]+$/.test(hash)) {
      throw new Error('privy_eth_sendTransaction_missing_hash');
    }
    return { txHash: hash as Hex, simulated: false };
  }

  const account = privateKeyToAccount(requireEnv('KPR_PRIVATE_KEY') as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: {
      ...base,
      id: params.chainId,
      name: `chain-${params.chainId}`,
      nativeCurrency: base.nativeCurrency,
      rpcUrls: { default: { http: [params.rpcUrl] } },
    },
    transport: http(params.rpcUrl, { timeout: 30_000 }),
  });
  const txHash = await wallet.sendTransaction({
    to: params.to,
    data: params.data,
    value: params.value,
  });
  return { txHash, simulated: false };
}

export function encodeContractCall(params: {
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}): Hex {
  return encodeFunctionData({
    abi: params.abi as Abi,
    functionName: params.functionName,
    args: params.args,
  });
}

/** Optional chainId → shareOft map fallback when array env is unset. */
export function parseRemoteShareOftMapFallback(): RemoteShareOftFlushTarget[] {
  const map = parseDotenvJsonObject('REMOTE_SHARE_OFT_BY_CHAIN_ID');
  const rpcMap = parseDotenvJsonObject('REMOTE_SHARE_OFT_RPC_BY_CHAIN_ID');
  const eidMap = parseDotenvJsonObject('REMOTE_SHARE_OFT_LZ_EID_BY_CHAIN_ID');
  const out: RemoteShareOftFlushTarget[] = [];
  for (const [chainIdRaw, shareOftRaw] of Object.entries(map)) {
    const chainId = Number(chainIdRaw);
    if (!Number.isFinite(chainId) || !isAddress(shareOftRaw)) continue;
    const rpcUrl = rpcMap[chainIdRaw];
    if (!rpcUrl) continue;
    const lzEid = Number(eidMap[chainIdRaw] ?? 0);
    if (!Number.isFinite(lzEid) || lzEid <= 0) continue;
    out.push({
      chainId,
      lzEid,
      shareOft: getAddress(shareOftRaw),
      rpcUrl,
      label: `chain-${chainId}`,
    });
  }
  return out;
}
