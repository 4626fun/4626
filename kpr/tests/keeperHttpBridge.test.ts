import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  postKeeperReport,
  postKeeperRebalanceStrategies,
  postKeeperTend,
  shouldUseKeeperHttpBridge,
} from '../utils/keeperHttpBridge.js';

const ENV_KEYS = ['KPR_API_BASE_URL', 'KPR_API_KEY', 'KPR_USE_KEEPER_HTTP_BRIDGE'] as const;
const savedEnv: Record<string, string | undefined> = {};

describe('keeperHttpBridge', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
      else delete process.env[key];
    }
  });

  it('enables bridge when API base URL and key are configured', () => {
    process.env.KPR_API_BASE_URL = 'https://app.4626.fun/api';
    process.env.KPR_API_KEY = 'test-key';
    expect(shouldUseKeeperHttpBridge()).toBe(true);
  });

  it('disables bridge when explicitly opted out', () => {
    process.env.KPR_API_BASE_URL = 'https://app.4626.fun/api';
    process.env.KPR_API_KEY = 'test-key';
    process.env.KPR_USE_KEEPER_HTTP_BRIDGE = '0';
    expect(shouldUseKeeperHttpBridge()).toBe(false);
  });

  it('posts tend requests to the keeper API', async () => {
    process.env.KPR_API_BASE_URL = 'https://app.4626.fun/api';
    process.env.KPR_API_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { txHash: '0xabc', status: 'ok' } }), {
        status: 200,
      }),
    );

    const result = await postKeeperTend('0x82C06EaAE27B1Ca31fA29F22341A162A670A4471');
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xabc');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.4626.fun/api/keeper/tend',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces HTTP errors from report bridge', async () => {
    process.env.KPR_API_BASE_URL = 'https://app.4626.fun/api';
    process.env.KPR_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'unauthorized keeper' }), {
        status: 403,
      }),
    );

    const result = await postKeeperReport('0x82C06EaAE27B1Ca31fA29F22341A162A670A4471');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized keeper|403/i);
  });

  it('posts rebalance requests to the keeper API', async () => {
    process.env.KPR_API_BASE_URL = 'https://app.4626.fun/api';
    process.env.KPR_API_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { txHash: '0xdef', status: 'success' } }), {
        status: 200,
      }),
    );

    const result = await postKeeperRebalanceStrategies(
      '0x82C06EaAE27B1Ca31fA29F22341A162A670A4471',
      750n,
    );

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xdef');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.4626.fun/api/keeper/rebalance-strategies',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          vaultAddress: '0x82C06EaAE27B1Ca31fA29F22341A162A670A4471',
          minDeviationBps: '750',
        }),
      }),
    );
  });
});
