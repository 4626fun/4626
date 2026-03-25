import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { readContractMock, alertInfoMock, alertWarningMock, alertCriticalMock, fetchMock } = vi.hoisted(() => ({
  readContractMock: vi.fn(),
  alertInfoMock: vi.fn(async () => {}),
  alertWarningMock: vi.fn(async () => {}),
  alertCriticalMock: vi.fn(async () => {}),
  fetchMock: vi.fn(),
}));

vi.mock('../utils/onchain.js', () => ({
  readContract: readContractMock,
}));

vi.mock('../utils/alerts.js', () => ({
  alertInfo: alertInfoMock,
  alertWarning: alertWarningMock,
  alertCritical: alertCriticalMock,
}));

import { executeBridgeIntegrityMonitor } from '../actions/bridge-integrity-monitor.action.js';

const ENV_KEYS = [
  'KEEPR_API_BASE_URL',
  'KEEPR_API_KEY',
  'SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST',
  'SOLANA_BRIDGE_MONITOR_ROUTES_JSON',
  'SOLANA_BRIDGE_BASE_ORACLE_SIGNERS',
  'SOLANA_BRIDGE_PARTNER_ORACLE_SIGNERS',
  'SOLANA_BRIDGE_MONITOR_MAX_HEALTH_AGE_SECONDS',
  'BASE_SOLANA_BRIDGE_ADDRESS',
  'DEPLOY_SOLANA_REGISTRATION_SECRET',
  'SOLANA_REGISTRATION_INTERNAL_SECRET',
] as const;

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])) as Record<
  string,
  string | undefined
>;

const SAMPLE_MINT = `0x${'ab'.repeat(32)}`;
const SAMPLE_ADAPTER = '0x1111111111111111111111111111111111111111';
const SAMPLE_BRIDGE_TOKEN = '0x2222222222222222222222222222222222222222';
const SAMPLE_MAPPED_TOKEN = '0x3333333333333333333333333333333333333333';

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function mockInfraStatusResponse(overrides: Record<string, unknown> = {}): void {
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        success: true,
        data: {
          canonicalBridgeTokenAllowlistConfigured: true,
          canonicalBridgeTokenAllowlistRequired: false,
          defaultRouteBridgeTokenAllowlisted: true,
          bridgeLivenessEnforced: true,
          bridgeLivenessHealthy: true,
          bridgeLivenessHealthAgeSeconds: 30,
          bridgeLivenessMaxHealthAgeSeconds: 180,
          bridgeLivenessBlockers: [],
          defaultMintConfigured: true,
          defaultMintBytes32: SAMPLE_MINT,
          defaultMintMappedToken: SAMPLE_MAPPED_TOKEN,
          defaultMintRouteScalar: '1000000000',
          defaultRouteBridgeToken: SAMPLE_BRIDGE_TOKEN,
          batcherAdapter: SAMPLE_ADAPTER,
          ...overrides,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );
}

describe('bridge integrity monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    setEnv('KEEPR_API_BASE_URL', 'https://api.test');
    setEnv('KEEPR_API_KEY', 'test-key');
    setEnv('SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST', SAMPLE_BRIDGE_TOKEN);
    setEnv('SOLANA_BRIDGE_MONITOR_ROUTES_JSON', '');
    setEnv('SOLANA_BRIDGE_BASE_ORACLE_SIGNERS', '');
    setEnv('SOLANA_BRIDGE_PARTNER_ORACLE_SIGNERS', '');
    setEnv('SOLANA_BRIDGE_MONITOR_MAX_HEALTH_AGE_SECONDS', undefined);
    setEnv('BASE_SOLANA_BRIDGE_ADDRESS', undefined);
    setEnv('DEPLOY_SOLANA_REGISTRATION_SECRET', undefined);
    setEnv('SOLANA_REGISTRATION_INTERNAL_SECRET', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) setEnv(key, ORIGINAL_ENV[key]);
  });

  it('reports critical when signer overlap drift is detected', async () => {
    setEnv(
      'SOLANA_BRIDGE_BASE_ORACLE_SIGNERS',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    setEnv(
      'SOLANA_BRIDGE_PARTNER_ORACLE_SIGNERS',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,0xcccccccccccccccccccccccccccccccccccccccc',
    );
    mockInfraStatusResponse();

    const result = await executeBridgeIntegrityMonitor();

    expect(result.status).toBe('critical');
    expect(result.signerOverlapCount).toBe(1);
    expect(result.criticalFindings.join(' ')).toContain('Signer overlap detected');
    expect(alertCriticalMock).toHaveBeenCalledTimes(1);
  });

  it('reports critical when monitored scalar is zero', async () => {
    setEnv(
      'SOLANA_BRIDGE_BASE_ORACLE_SIGNERS',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    setEnv(
      'SOLANA_BRIDGE_PARTNER_ORACLE_SIGNERS',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    setEnv(
      'SOLANA_BRIDGE_MONITOR_ROUTES_JSON',
      JSON.stringify({
        [SAMPLE_MINT]: {
          bridgeToken: SAMPLE_BRIDGE_TOKEN,
          mappedToken: SAMPLE_MAPPED_TOKEN,
          scalar: '1000000000',
        },
      }),
    );
    mockInfraStatusResponse();
    readContractMock.mockResolvedValueOnce(SAMPLE_MAPPED_TOKEN).mockResolvedValueOnce(0n);

    const result = await executeBridgeIntegrityMonitor();

    expect(result.status).toBe('critical');
    expect(result.routeChecks).toHaveLength(1);
    expect(result.criticalFindings.join(' ')).toContain('Scalar anomaly');
    expect(alertCriticalMock).toHaveBeenCalledTimes(1);
  });

  it('returns ok when signer sets, route mapping, scalar, and liveness are healthy', async () => {
    setEnv(
      'SOLANA_BRIDGE_BASE_ORACLE_SIGNERS',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    setEnv(
      'SOLANA_BRIDGE_PARTNER_ORACLE_SIGNERS',
      '0xcccccccccccccccccccccccccccccccccccccccc,0xdddddddddddddddddddddddddddddddddddddddd',
    );
    setEnv(
      'SOLANA_BRIDGE_MONITOR_ROUTES_JSON',
      JSON.stringify({
        [SAMPLE_MINT]: {
          bridgeToken: SAMPLE_BRIDGE_TOKEN,
          mappedToken: SAMPLE_MAPPED_TOKEN,
          scalar: '1000000000',
        },
      }),
    );
    mockInfraStatusResponse();
    readContractMock.mockResolvedValueOnce(SAMPLE_MAPPED_TOKEN).mockResolvedValueOnce(1000000000n);

    const result = await executeBridgeIntegrityMonitor();

    expect(result.status).toBe('ok');
    expect(result.criticalFindings).toHaveLength(0);
    expect(result.warningFindings).toHaveLength(0);
    expect(alertInfoMock).toHaveBeenCalledTimes(1);
    expect(alertCriticalMock).not.toHaveBeenCalled();
  });

  it('uses the internal registration secret header when no KEEPR_API_KEY is configured', async () => {
    setEnv('KEEPR_API_KEY', undefined);
    setEnv('DEPLOY_SOLANA_REGISTRATION_SECRET', 'internal-secret');
    mockInfraStatusResponse();

    const result = await executeBridgeIntegrityMonitor();

    expect(result.status).toBe('warning');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/deploy/solanaInfraStatus',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-cv-solana-registration-secret': 'internal-secret',
        }),
      }),
    );
    const headers = (fetchMock.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined)?.headers ?? {};
    expect(headers.Authorization).toBeUndefined();
  });

  it('skips monitoring when API credentials are missing', async () => {
    setEnv('KEEPR_API_KEY', undefined);
    setEnv('DEPLOY_SOLANA_REGISTRATION_SECRET', undefined);
    setEnv('SOLANA_REGISTRATION_INTERNAL_SECRET', undefined);

    const result = await executeBridgeIntegrityMonitor();

    expect(result.status).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(alertWarningMock).toHaveBeenCalledTimes(1);
  });
});
