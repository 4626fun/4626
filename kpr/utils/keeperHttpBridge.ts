/**
 * HTTP bridge for vault keeper writes — routes tend/report through Vercel
 * so production uses the server-configured KPR_PRIVATE_KEY (authorized keeper).
 */

import { requireEnv } from '../config.js';

export type KeeperBridgeWriteResult = {
  success: boolean;
  txHash?: string;
  error?: string;
  status?: string;
};

function resolveKeeperApiBaseUrl(): string {
  const raw = String(process.env.KPR_API_BASE_URL ?? 'https://app.4626.fun/api').trim();
  return raw.replace(/\/$/, '');
}

function resolveKeeperApiKey(): string {
  return requireEnv('KPR_API_KEY');
}

export function shouldUseKeeperHttpBridge(): boolean {
  const override = String(process.env.KPR_USE_KEEPER_HTTP_BRIDGE ?? '').trim().toLowerCase();
  if (override === '0' || override === 'false' || override === 'no') return false;
  const baseUrl = String(process.env.KPR_API_BASE_URL ?? '').trim();
  const apiKey = String(process.env.KPR_API_KEY ?? '').trim();
  return Boolean(baseUrl && apiKey);
}

async function postKeeperBridge(
  path: 'keeper/tend' | 'keeper/report' | 'keeper/rebalance-strategies',
  body: Record<string, unknown>,
): Promise<KeeperBridgeWriteResult> {
  const baseUrl = resolveKeeperApiBaseUrl();
  const apiKey = resolveKeeperApiKey();
  const url = `${baseUrl}/${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  type KeeperBridgePayload = {
    success?: boolean;
    error?: string;
    data?: { txHash?: string; status?: string };
  };
  let payload: KeeperBridgePayload | null = null;
  try {
    payload = text ? (JSON.parse(text) as KeeperBridgePayload) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return {
      success: false,
      error: payload?.error ?? `HTTP ${response.status}: ${text.slice(0, 240)}`,
    };
  }

  if (!payload?.success) {
    return {
      success: false,
      error: payload?.error ?? 'keeper bridge returned success=false',
    };
  }

  return {
    success: true,
    txHash: payload.data?.txHash,
    status: payload.data?.status,
  };
}

export async function postKeeperTend(vaultAddress: `0x${string}`): Promise<KeeperBridgeWriteResult> {
  return postKeeperBridge('keeper/tend', { vaultAddress });
}

export async function postKeeperReport(vaultAddress: `0x${string}`): Promise<KeeperBridgeWriteResult> {
  return postKeeperBridge('keeper/report', { vaultAddress });
}

export async function postKeeperRebalanceStrategies(
  vaultAddress: `0x${string}`,
  minDeviationBps: bigint,
): Promise<KeeperBridgeWriteResult> {
  return postKeeperBridge('keeper/rebalance-strategies', {
    vaultAddress,
    minDeviationBps: minDeviationBps.toString(),
  });
}
