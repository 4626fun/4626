/**
 * CRE Bridge Integrity Monitor
 *
 * Monitors bridge integration safety from 4626-owned control points:
 * - signer-set overlap drift (config snapshot based)
 * - canonical route drift (mint -> token mapping)
 * - scalar anomalies (0/mismatch)
 * - bridge liveness freshness from deploy infra status
 *
 * This action is intentionally integration-layer only and does not mutate
 * external protocol contracts.
 */

import { readContract } from '../utils/onchain.js';
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js';

const WORKFLOW_NAME = 'bridge-integrity-monitor';
const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as const;
const DEFAULT_BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as const;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/;

const SOLANA_BRIDGE_ADAPTER_VIEW_ABI = [
  {
    type: 'function',
    name: 'solanaMintToToken',
    stateMutability: 'view',
    inputs: [{ name: 'mint', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const;

const BASE_SOLANA_BRIDGE_VIEW_ABI = [
  {
    type: 'function',
    name: 'scalars',
    stateMutability: 'view',
    inputs: [
      { name: 'localToken', type: 'address' },
      { name: 'remoteToken', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

type SolanaInfraStatusData = {
  canonicalBridgeTokenAllowlistConfigured?: boolean;
  canonicalBridgeTokenAllowlistRequired?: boolean;
  defaultRouteBridgeTokenAllowlisted?: boolean | null;
  bridgeLivenessEnforced?: boolean;
  bridgeLivenessHealthy?: boolean | null;
  bridgeLivenessHealthAgeSeconds?: number | null;
  bridgeLivenessMaxHealthAgeSeconds?: number | null;
  bridgeLivenessBlockers?: string[];
  defaultMintConfigured?: boolean;
  defaultMintBytes32?: string | null;
  defaultMintMappedToken?: string | null;
  defaultMintRouteScalar?: string | null;
  defaultRouteBridgeToken?: string | null;
  batcherAdapter?: string | null;
};

type SolanaInfraStatusResponse = {
  success: boolean;
  data?: SolanaInfraStatusData;
  error?: string;
};

type RouteExpectation = {
  mint: `0x${string}`;
  bridgeToken: `0x${string}`;
  mappedToken: `0x${string}` | null;
  scalar: bigint | null;
};

type RouteCheckDetail = {
  mint: `0x${string}`;
  bridgeToken: `0x${string}`;
  expectedMappedToken: `0x${string}` | null;
  actualMappedToken: `0x${string}` | null;
  expectedScalar: string | null;
  actualScalar: string | null;
};

export interface BridgeIntegrityMonitorResult {
  status: 'ok' | 'warning' | 'critical' | 'skipped';
  checksRun: number;
  monitoredRoutes: number;
  signerOverlapCount: number;
  criticalFindings: string[];
  warningFindings: string[];
  routeChecks: RouteCheckDetail[];
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const raw = String(value ?? '').trim();
  if (!ADDRESS_RE.test(raw)) return null;
  return raw.toLowerCase() as `0x${string}`;
}

function normalizeBytes32(value: unknown): `0x${string}` | null {
  const raw = String(value ?? '').trim();
  if (!BYTES32_RE.test(raw)) return null;
  return raw.toLowerCase() as `0x${string}`;
}

function parseAddressSet(raw: string): Set<`0x${string}`> {
  const out = new Set<`0x${string}`>();
  for (const piece of raw.split(/[\s,]+/g)) {
    const normalized = normalizeAddress(piece);
    if (normalized) out.add(normalized);
  }
  return out;
}

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!/^[0-9]+$/.test(text)) return null;
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseOptionalBigInt(raw: unknown): bigint | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || !/^[0-9]+$/.test(text)) return null;
  try {
    return BigInt(text);
  } catch {
    return null;
  }
}

function readCanonicalAllowlistFromEnv(): Set<`0x${string}`> {
  const explicit = String(process.env.SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST ?? '').trim();
  if (!explicit) return new Set<`0x${string}>();
  return parseAddressSet(explicit);
}

function parseRouteExpectations(raw: string): RouteExpectation[] {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SOLANA_BRIDGE_MONITOR_ROUTES_JSON is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SOLANA_BRIDGE_MONITOR_ROUTES_JSON must be an object keyed by mint bytes32.');
  }

  const out: RouteExpectation[] = [];
  for (const [mintRaw, configRaw] of Object.entries(parsed as Record<string, unknown>)) {
    const mint = normalizeBytes32(mintRaw);
    if (!mint) {
      throw new Error(`Invalid mint key in SOLANA_BRIDGE_MONITOR_ROUTES_JSON: ${mintRaw}`);
    }
    if (!configRaw || typeof configRaw !== 'object' || Array.isArray(configRaw)) {
      throw new Error(`Route config for mint ${mintRaw} must be an object.`);
    }
    const cfg = configRaw as Record<string, unknown>;
    const bridgeToken = normalizeAddress(cfg.bridgeToken);
    if (!bridgeToken) {
      throw new Error(`Route ${mintRaw} is missing a valid bridgeToken.`);
    }
    const mappedToken = cfg.mappedToken == null ? null : normalizeAddress(cfg.mappedToken);
    if (cfg.mappedToken != null && !mappedToken) {
      throw new Error(`Route ${mintRaw} has invalid mappedToken.`);
    }
    const scalar = parseOptionalBigInt(cfg.scalar);
    out.push({ mint, bridgeToken, mappedToken, scalar });
  }
  return out;
}

function parseSignerOverlapFindings(): { critical: string[]; warnings: string[]; overlapCount: number } {
  const baseSet = parseAddressSet(String(process.env.SOLANA_BRIDGE_BASE_ORACLE_SIGNERS ?? ''));
  const partnerSet = parseAddressSet(String(process.env.SOLANA_BRIDGE_PARTNER_ORACLE_SIGNERS ?? ''));

  const warnings: string[] = [];
  const critical: string[] = [];

  if (baseSet.size === 0 && partnerSet.size === 0) {
    warnings.push(
      'Signer-overlap monitor is not configured (set SOLANA_BRIDGE_BASE_ORACLE_SIGNERS and SOLANA_BRIDGE_PARTNER_ORACLE_SIGNERS).',
    );
    return { critical, warnings, overlapCount: 0 };
  }
  if (baseSet.size === 0 || partnerSet.size === 0) {
    warnings.push('Signer-overlap monitor is partially configured; both signer sets are required for overlap detection.');
    return { critical, warnings, overlapCount: 0 };
  }

  let overlapCount = 0;
  const overlaps: string[] = [];
  for (const signer of baseSet) {
    if (partnerSet.has(signer)) {
      overlapCount += 1;
      overlaps.push(signer);
    }
  }

  if (overlapCount > 0) {
    critical.push(
      `Signer overlap detected between Base and partner signer sets (${overlapCount} overlaps): ${overlaps.join(', ')}`,
    );
  }

  return { critical, warnings, overlapCount };
}

async function fetchSolanaInfraStatus(): Promise<SolanaInfraStatusData> {
  const apiBaseUrl = String(process.env.KEEPR_API_BASE_URL ?? '').trim().replace(/\/$/, '');
  const apiKey = String(process.env.KEEPR_API_KEY ?? '').trim();

  const response = await fetch(`${apiBaseUrl}/deploy/solanaInfraStatus`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(12_000),
  });

  const payload = (await response.json().catch(() => null)) as SolanaInfraStatusResponse | null;
  if (!response.ok) {
    const detail = payload?.error ? String(payload.error) : `HTTP ${response.status}`;
    throw new Error(`deploy/solanaInfraStatus failed: ${detail}`);
  }
  if (!payload?.success || !payload.data) {
    throw new Error(payload?.error || 'deploy/solanaInfraStatus returned no data.');
  }
  return payload.data;
}

async function evaluateRouteChecks(params: {
  infra: SolanaInfraStatusData;
  expectations: RouteExpectation[];
  allowlist: Set<`0x${string}`>;
}): Promise<{
  critical: string[];
  warnings: string[];
  details: RouteCheckDetail[];
}> {
  const critical: string[] = [];
  const warnings: string[] = [];
  const details: RouteCheckDetail[] = [];

  const adapter = normalizeAddress(params.infra.batcherAdapter);
  if (!adapter) {
    warnings.push('Bridge adapter is not configured; route drift checks skipped.');
    return { critical, warnings, details };
  }

  const baseSolanaBridge =
    normalizeAddress(process.env.BASE_SOLANA_BRIDGE_ADDRESS) ?? DEFAULT_BASE_SOLANA_BRIDGE;

  for (const route of params.expectations) {
    let actualMappedToken: `0x${string}` | null = null;
    let scalarRaw: bigint | null = null;

    try {
      const mapped = await readContract<string>({
        address: adapter,
        abi: SOLANA_BRIDGE_ADAPTER_VIEW_ABI,
        functionName: 'solanaMintToToken',
        args: [route.mint],
      });
      actualMappedToken = normalizeAddress(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      critical.push(`Failed to read adapter mapping for mint ${route.mint}: ${message}`);
    }

    try {
      const scalar = await readContract<bigint>({
        address: baseSolanaBridge,
        abi: BASE_SOLANA_BRIDGE_VIEW_ABI,
        functionName: 'scalars',
        args: [route.bridgeToken, route.mint],
      });
      scalarRaw = BigInt(scalar);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      critical.push(`Failed to read scalar for mint ${route.mint} + bridge token ${route.bridgeToken}: ${message}`);
    }

    const detail: RouteCheckDetail = {
      mint: route.mint,
      bridgeToken: route.bridgeToken,
      expectedMappedToken: route.mappedToken,
      actualMappedToken,
      expectedScalar: route.scalar?.toString() ?? null,
      actualScalar: scalarRaw?.toString() ?? null,
    };
    details.push(detail);

    if (params.allowlist.size > 0 && !params.allowlist.has(route.bridgeToken)) {
      critical.push(
        `Expected bridge token ${route.bridgeToken} for mint ${route.mint} is not in SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST.`,
      );
    }

    if (!actualMappedToken || actualMappedToken === ZERO_ADDRESS) {
      if (route.mappedToken) {
        critical.push(`Mint ${route.mint} is not mapped to expected token ${route.mappedToken} on adapter.`);
      } else {
        warnings.push(`Mint ${route.mint} has no mapped token on adapter.`);
      }
    } else if (route.mappedToken && actualMappedToken !== route.mappedToken) {
      critical.push(
        `Mint ${route.mint} mapped token drift: expected ${route.mappedToken}, got ${actualMappedToken}.`,
      );
    }

    if (scalarRaw == null) {
      continue;
    }
    if (scalarRaw <= 0n) {
      critical.push(`Scalar anomaly for mint ${route.mint}: scalar is ${scalarRaw.toString()} (must be > 0).`);
      continue;
    }
    if (route.scalar != null && scalarRaw !== route.scalar) {
      critical.push(
        `Scalar drift for mint ${route.mint}: expected ${route.scalar.toString()}, got ${scalarRaw.toString()}.`,
      );
    }
  }

  return { critical, warnings, details };
}

export async function executeBridgeIntegrityMonitor(): Promise<BridgeIntegrityMonitorResult> {
  const criticalFindings: string[] = [];
  const warningFindings: string[] = [];
  const routeChecks: RouteCheckDetail[] = [];
  let checksRun = 0;
  let monitoredRoutes = 0;

  try {
    const apiBaseUrl = String(process.env.KEEPR_API_BASE_URL ?? '').trim();
    const apiKey = String(process.env.KEEPR_API_KEY ?? '').trim();
    if (!apiBaseUrl || !apiKey) {
      warningFindings.push(
        'Bridge integrity monitor skipped: KEEPR_API_BASE_URL and KEEPR_API_KEY are required.',
      );
      await alertWarning(WORKFLOW_NAME, 'Bridge integrity monitor skipped', {
        warningFindings,
      });
      return {
        status: 'skipped',
        checksRun: 0,
        monitoredRoutes: 0,
        signerOverlapCount: 0,
        criticalFindings,
        warningFindings,
        routeChecks,
      };
    }

    const signerFindings = parseSignerOverlapFindings();
    checksRun += 1;
    criticalFindings.push(...signerFindings.critical);
    warningFindings.push(...signerFindings.warnings);

    const infra = await fetchSolanaInfraStatus();
    checksRun += 1;

    if (infra.canonicalBridgeTokenAllowlistRequired && !infra.canonicalBridgeTokenAllowlistConfigured) {
      criticalFindings.push(
        'Canonical bridge token allowlist is required but not configured in deploy infrastructure status.',
      );
    }
    if (infra.defaultRouteBridgeTokenAllowlisted === false) {
      criticalFindings.push('Default Solana bridge route token is outside the canonical bridge token allowlist.');
    }
    if (infra.defaultMintConfigured && infra.defaultMintRouteScalar != null) {
      const defaultScalar = parseOptionalBigInt(infra.defaultMintRouteScalar);
      if (defaultScalar != null && defaultScalar <= 0n) {
        criticalFindings.push(`Default mint route scalar is non-positive (${defaultScalar.toString()}).`);
      }
    }

    if (infra.bridgeLivenessEnforced) {
      if (infra.bridgeLivenessHealthy === false) {
        const blockers = Array.isArray(infra.bridgeLivenessBlockers)
          ? infra.bridgeLivenessBlockers.join(' ')
          : 'unknown';
        criticalFindings.push(`Bridge liveness gate reports unhealthy status. ${blockers}`.trim());
      }
      const monitorMaxAge = parsePositiveInt(process.env.SOLANA_BRIDGE_MONITOR_MAX_HEALTH_AGE_SECONDS);
      if (
        monitorMaxAge !== null &&
        typeof infra.bridgeLivenessHealthAgeSeconds === 'number' &&
        infra.bridgeLivenessHealthAgeSeconds > monitorMaxAge
      ) {
        criticalFindings.push(
          `Bridge health payload is stale for monitor policy (${infra.bridgeLivenessHealthAgeSeconds}s > ${monitorMaxAge}s).`,
        );
      }
    }

    const routeExpectations = parseRouteExpectations(
      String(process.env.SOLANA_BRIDGE_MONITOR_ROUTES_JSON ?? ''),
    );
    monitoredRoutes = routeExpectations.length;
    checksRun += 1;

    if (routeExpectations.length > 0) {
      const allowlist = readCanonicalAllowlistFromEnv();
      const routeFindings = await evaluateRouteChecks({
        infra,
        expectations: routeExpectations,
        allowlist,
      });
      criticalFindings.push(...routeFindings.critical);
      warningFindings.push(...routeFindings.warnings);
      routeChecks.push(...routeFindings.details);
    } else {
      warningFindings.push(
        'No route expectations configured (set SOLANA_BRIDGE_MONITOR_ROUTES_JSON) — route drift checks skipped.',
      );
    }

    const signerOverlapCount = signerFindings.overlapCount;
    if (criticalFindings.length > 0) {
      await alertCritical(WORKFLOW_NAME, 'Bridge integrity monitor detected critical findings', {
        checksRun,
        monitoredRoutes,
        signerOverlapCount,
        criticalFindings,
        warningFindings,
      });
      return {
        status: 'critical',
        checksRun,
        monitoredRoutes,
        signerOverlapCount,
        criticalFindings,
        warningFindings,
        routeChecks,
      };
    }

    if (warningFindings.length > 0) {
      await alertWarning(WORKFLOW_NAME, 'Bridge integrity monitor completed with warnings', {
        checksRun,
        monitoredRoutes,
        signerOverlapCount,
        warningFindings,
      });
      return {
        status: 'warning',
        checksRun,
        monitoredRoutes,
        signerOverlapCount,
        criticalFindings,
        warningFindings,
        routeChecks,
      };
    }

    await alertInfo(WORKFLOW_NAME, 'Bridge integrity monitor healthy', {
      checksRun,
      monitoredRoutes,
      signerOverlapCount,
    });
    return {
      status: 'ok',
      checksRun,
      monitoredRoutes,
      signerOverlapCount,
      criticalFindings,
      warningFindings,
      routeChecks,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    criticalFindings.push(`Bridge integrity monitor execution error: ${message}`);

    await alertCritical(WORKFLOW_NAME, 'Bridge integrity monitor failed', {
      checksRun,
      monitoredRoutes,
      criticalFindings,
      warningFindings,
    });

    return {
      status: 'critical',
      checksRun,
      monitoredRoutes,
      signerOverlapCount: 0,
      criticalFindings,
      warningFindings,
      routeChecks,
    };
  }
}
