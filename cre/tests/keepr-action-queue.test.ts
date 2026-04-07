import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeKeeprActionQueue } from '../actions/keepr-action-queue.action.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pendingAction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    vaultAddress: '0x00000000000000000000000000000000000000bb',
    groupId: 'group-1',
    actionType: 'xmtp.group.add_member',
    action: { action: 'xmtp.group.add_member', wallet: '0x00000000000000000000000000000000000000aa' },
    dedupeKey: null,
    status: 'pending',
    attemptCount: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('keepr action queue', () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.KEEPR_API_BASE_URL;
  const originalApiKey = process.env.KEEPR_API_KEY;
  const originalZoneFinancial = process.env.KEEPR_ZONE_KEY_FINANCIAL_EXECUTION;
  const originalZoneQueue = process.env.KEEPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KEEPR_API_BASE_URL = 'https://api.test';
    process.env.KEEPR_API_KEY = 'secret';
    delete process.env.KEEPR_ZONE_KEY_FINANCIAL_EXECUTION;
    process.env.KEEPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING = 'zone-queue-secret';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.KEEPR_API_BASE_URL = originalApiBase;
    process.env.KEEPR_API_KEY = originalApiKey;
    process.env.KEEPR_ZONE_KEY_FINANCIAL_EXECUTION = originalZoneFinancial;
    process.env.KEEPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING = originalZoneQueue;
  });

  it('marks action executed when execute endpoint succeeds', async () => {
    const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
    globalThis.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const headers = Object.fromEntries(new Headers(init?.headers ?? {}).entries());
      calls.push({ url, body, headers });

      if (url.endsWith('/keepr/actions/pending?limit=10')) {
        return jsonResponse({
          success: true,
          data: { actions: [pendingAction()], count: 1 },
        });
      }
      if (url.endsWith('/keepr/actions/execute')) {
        return jsonResponse({
          success: true,
          data: { executed: true, retryable: false, actionType: 'xmtp.group.add_member' },
        });
      }
      if (url.endsWith('/keepr/actions/updateStatus')) {
        return jsonResponse({ success: true, data: { updated: true } });
      }
      return jsonResponse({ success: false, error: 'unexpected' }, 500);
    }) as any;

    const result = await executeKeeprActionQueue();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.retried).toBe(0);
    expect(calls.some((c) => c.url.endsWith('/keepr/actions/execute'))).toBe(true);
    expect(
      calls.some(
        (c) => c.url.endsWith('/keepr/actions/updateStatus') && c.body?.status === 'executed',
      ),
    ).toBe(true);
    const executeCall = calls.find((c) => c.url.endsWith('/keepr/actions/execute'));
    expect(executeCall?.headers['x-keepr-trust-zone']).toBe('queue_messaging_monitoring');
    expect(executeCall?.headers['x-keepr-zone-key']).toBe('zone-queue-secret');
  });

  it('fails immediately on non-retryable 4xx execute errors', async () => {
    const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
    globalThis.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const headers = Object.fromEntries(new Headers(init?.headers ?? {}).entries());
      calls.push({ url, body, headers });

      if (url.endsWith('/keepr/actions/pending?limit=10')) {
        return jsonResponse({
          success: true,
          data: { actions: [pendingAction()], count: 1 },
        });
      }
      if (url.endsWith('/keepr/actions/execute')) {
        return jsonResponse(
          {
            success: false,
            error: 'creator_agent_not_configured',
            data: { executed: false, retryable: false, actionType: 'xmtp.group.add_member' },
          },
          400,
        );
      }
      if (url.endsWith('/keepr/actions/updateStatus')) {
        return jsonResponse({ success: true, data: { updated: true } });
      }
      return jsonResponse({ success: false, error: 'unexpected' }, 500);
    }) as any;

    const result = await executeKeeprActionQueue();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);
    expect(
      calls.some(
        (c) => c.url.endsWith('/keepr/actions/updateStatus') && c.body?.status === 'failed',
      ),
    ).toBe(true);
  });

  it('retries on retryable execute failures', async () => {
    const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
    globalThis.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const headers = Object.fromEntries(new Headers(init?.headers ?? {}).entries());
      calls.push({ url, body, headers });

      if (url.endsWith('/keepr/actions/pending?limit=10')) {
        return jsonResponse({
          success: true,
          data: { actions: [pendingAction({ attemptCount: 1 })], count: 1 },
        });
      }
      if (url.endsWith('/keepr/actions/execute')) {
        return jsonResponse(
          {
            success: false,
            error: 'xmtp_network_timeout',
            data: { executed: false, retryable: true, actionType: 'xmtp.group.add_member' },
          },
          503,
        );
      }
      if (url.endsWith('/keepr/actions/updateStatus')) {
        return jsonResponse({ success: true, data: { updated: true } });
      }
      return jsonResponse({ success: false, error: 'unexpected' }, 500);
    }) as any;

    const result = await executeKeeprActionQueue();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.retried).toBe(1);
    expect(
      calls.some(
        (c) =>
          c.url.endsWith('/keepr/actions/updateStatus') &&
          c.body?.status === 'retry' &&
          c.body?.retryDelaySeconds === 120,
      ),
    ).toBe(true);
  });

  it('uses the effective action payload to choose trust-zone headers', async () => {
    process.env.KEEPR_ZONE_KEY_FINANCIAL_EXECUTION = 'zone-financial-secret';

    const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
    globalThis.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const headers = Object.fromEntries(new Headers(init?.headers ?? {}).entries());
      calls.push({ url, body, headers });

      if (url.endsWith('/keepr/actions/pending?limit=10')) {
        return jsonResponse({
          success: true,
          data: {
            actions: [
              pendingAction({
                actionType: 'monitor.healthcheck',
                action: {
                  action: 'strategy.ajna.rebucket',
                  authAddress: '0x00000000000000000000000000000000000000cc',
                  targetBucket: 1200,
                },
              }),
            ],
            count: 1,
          },
        });
      }
      if (url.endsWith('/keepr/actions/execute')) {
        return jsonResponse({
          success: true,
          data: { executed: true, retryable: false, actionType: 'strategy.ajna.rebucket' },
        });
      }
      if (url.endsWith('/keepr/actions/updateStatus')) {
        return jsonResponse({ success: true, data: { updated: true } });
      }
      return jsonResponse({ success: false, error: 'unexpected' }, 500);
    }) as any;

    await executeKeeprActionQueue();

    const executeCall = calls.find((c) => c.url.endsWith('/keepr/actions/execute'));
    expect(executeCall?.headers['x-keepr-trust-zone']).toBe('financial_execution');
    expect(executeCall?.headers['x-keepr-zone-key']).toBe('zone-financial-secret');

    const updateCalls = calls.filter((c) => c.url.endsWith('/keepr/actions/updateStatus'));
    expect(updateCalls.length).toBeGreaterThan(0);
    expect(updateCalls.every((call) => call.headers['x-keepr-trust-zone'] === 'financial_execution')).toBe(
      true,
    );
    expect(updateCalls.every((call) => call.headers['x-keepr-zone-key'] === 'zone-financial-secret')).toBe(
      true,
    );
  });
});
