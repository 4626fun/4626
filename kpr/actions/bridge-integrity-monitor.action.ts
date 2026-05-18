/**
 * KPR Bridge Integrity Monitor
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
// FIX: LOW-07 — Log a warning when using the hardcoded default; prefer env override
const DEFAULT_BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as const;
if (!process.env.BASE_SOLANA_BRIDGE_ADDRESS) {
  console.warn('[KPR] WARNING: BASE_SOLANA_BRIDGE_ADDRESS not set — using hardcoded default. Set this env var explicitly for production.');
}
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

const BASE_SOLANA_BRIDGE_VALIDATOR_VIEW_ABI = [
  {
    type: 'function',
    name: 'BRIDGE_VALIDATOR',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

const BRIDGE_VALIDATOR_VIEW_ABI = [
  {
    type: 'function',
    name: 'PARTNER_VALIDATORS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'isBaseValidator',
    stateMutability: 'view',
    inputs: [{ name: 'validator', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

const SIGNER_REGISTRY_VIEW_ABI = [
  {
    type: 'function',
    name: 'getSigners',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'evmAddress', type: 'address' },
          { name: 'newEVMAddress', type: 'address' },
        ],
      },
    ],
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

type RegisterSolanaBridgeBuildOnlyResponse = {
  success: boolean;
  data?: {
    bridgeToken?: string | null;
    adapter?: string | null;
    solanaMint?: string | null;
  };
  error?: string;
};

type InfraFetchMode = 'infra-status' | 'register-build-fallback';

type ProvisionerHealthProbe = {
  reachable: boolean;
  statusCode: number | null;
  healthOk: boolean | null;
  payerHealthy: boolean | null;
  reportedAtMs: number | null;
};

type SignerRecord = {
  evmAddress?: string;
  newEVMAddress?: string;
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

function parseEnvBool(raw: string | undefined): boolean {
  const text = String(raw ?? '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function parseIsoTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
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
  if (!explicit) return new Set<`0x${string}`>();
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

async function parseSignerOverlapFromChain(): Promise<{
  critical: string[];
  warnings: string[];
  overlapCount: number;
}> {
  const critical: string[] = [];
  const warnings: string[] = [];
  const bridgeAddress = normalizeAddress(process.env.BASE_SOLANA_BRIDGE_ADDRESS) ?? DEFAULT_BASE_SOLANA_BRIDGE;

  try {
    const bridgeValidatorRaw = await readContract<string>({
      address: bridgeAddress,
      abi: BASE_SOLANA_BRIDGE_VALIDATOR_VIEW_ABI,
      functionName: 'BRIDGE_VALIDATOR',
    });
    const bridgeValidator = normalizeAddress(bridgeValidatorRaw);
    if (!bridgeValidator || bridgeValidator === ZERO_ADDRESS) {
      warnings.push('Onchain signer-overlap monitor unavailable: BRIDGE_VALIDATOR is unset.');
      return { critical, warnings, overlapCount: 0 };
    }

    const partnerRegistryRaw = await readContract<string>({
      address: bridgeValidator,
      abi: BRIDGE_VALIDATOR_VIEW_ABI,
      functionName: 'PARTNER_VALIDATORS',
    });
    const partnerRegistry = normalizeAddress(partnerRegistryRaw);
    if (!partnerRegistry || partnerRegistry === ZERO_ADDRESS) {
      warnings.push('Onchain signer-overlap monitor unavailable: PARTNER_VALIDATORS is unset.');
      return { critical, warnings, overlapCount: 0 };
    }

    const signerRowsRaw = await readContract<SignerRecord[]>({
      address: partnerRegistry,
      abi: SIGNER_REGISTRY_VIEW_ABI,
      functionName: 'getSigners',
    });
    const signerRows = Array.isArray(signerRowsRaw) ? signerRowsRaw : [];
    if (signerRows.length === 0) {
      warnings.push('Onchain signer-overlap monitor: partner signer registry is empty.');
      return { critical, warnings, overlapCount: 0 };
    }

    const partnerCandidates: string[] = [];
    const seenCandidates = new Set<string>();
    for (const row of signerRows) {
      const evmAddress = normalizeAddress(row?.evmAddress);
      if (evmAddress && evmAddress !== ZERO_ADDRESS && !seenCandidates.has(evmAddress)) {
        seenCandidates.add(evmAddress);
        partnerCandidates.push(evmAddress);
      }
      const rotatedAddress = normalizeAddress(row?.newEVMAddress);
      if (rotatedAddress && rotatedAddress !== ZERO_ADDRESS && !seenCandidates.has(rotatedAddress)) {
        seenCandidates.add(rotatedAddress);
        partnerCandidates.push(rotatedAddress);
      }
    }

    let overlapCount = 0;
    const overlaps: string[] = [];
    for (const candidate of partnerCandidates) {
      const isBase = await readContract<boolean>({
        address: bridgeValidator,
        abi: BRIDGE_VALIDATOR_VIEW_ABI,
        functionName: 'isBaseValidator',
        args: [candidate as `0x${string}`],
      }).catch(() => false);
      if (isBase) {
        overlapCount += 1;
        overlaps.push(candidate);
      }
    }

    if (overlapCount > 0) {
      critical.push(
        `Signer overlap detected onchain between Base validator set and partner signer registry (${overlapCount} overlaps): ${overlaps.join(', ')}`,
      );
    }
    return { critical, warnings, overlapCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(
      `Onchain signer-overlap monitor unavailable (falling back to env-based config): ${message}`,
    );
    return { critical, warnings, overlapCount: 0 };
  }
}

async function parseSignerOverlapFindings(): Promise<{
  critical: string[];
  warnings: string[];
  overlapCount: number;
}> {
  const baseSet = parseAddressSet(String(process.env.SOLANA_BRIDGE_BASE_ORACLE_SIGNERS ?? ''));
  const partnerSet = parseAddressSet(String(process.env.SOLANA_BRIDGE_PARTNER_ORACLE_SIGNERS ?? ''));

  const warnings: string[] = [];
  const critical: string[] = [];

  if (baseSet.size === 0 && partnerSet.size === 0) {
    const onchain = await parseSignerOverlapFromChain();
    warnings.push(...onchain.warnings);
    return {
      critical: [...critical, ...onchain.critical],
      warnings,
      overlapCount: onchain.overlapCount,
    };
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

async function fetchSolanaInfraStatusWithFallback(params: {
  fallbackBridgeToken: `0x${string}` | null;
}): Promise<{ infra: SolanaInfraStatusData; mode: InfraFetchMode }> {
  const apiBaseUrl = String(process.env.KPR_API_BASE_URL ?? '').trim().replace(/\/$/, '');
  const apiKey = String(process.env.KPR_API_KEY ?? '').trim();
  const internalSecret = String(
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET ??
      process.env.SOLANA_REGISTRATION_INTERNAL_SECRET ??
      '',
  ).trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (internalSecret) headers['x-cv-solana-registration-secret'] = internalSecret;

  const statusResponse = await fetch(`${apiBaseUrl}/deploy/solanaInfraStatus`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(12_000),
  });
  const statusPayload = (await statusResponse.json().catch(() => null)) as SolanaInfraStatusResponse | null;
  if (statusResponse.ok && statusPayload?.success && statusPayload.data) {
    return { infra: statusPayload.data, mode: 'infra-status' };
  }

  if (statusResponse.status !== 401 && statusResponse.status !== 403) {
    const statusDetail = statusPayload?.error ? String(statusPayload.error) : `HTTP ${statusResponse.status}`;
    throw new Error(`deploy/solanaInfraStatus failed: ${statusDetail}`);
  }

  if (!params.fallbackBridgeToken) {
    const statusDetail = statusPayload?.error ? String(statusPayload.error) : `HTTP ${statusResponse.status}`;
    throw new Error(`deploy/solanaInfraStatus failed: ${statusDetail} (no fallback bridge token configured)`);
  }

  const registerResponse = await fetch(`${apiBaseUrl}/deploy/registerSolanaBridgeToken`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      buildOnly: true,
      bridgeToken: params.fallbackBridgeToken,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const registerPayload = (await registerResponse
    .json()
    .catch(() => null)) as RegisterSolanaBridgeBuildOnlyResponse | null;
  if (!registerResponse.ok || !registerPayload?.success || !registerPayload.data) {
    const statusDetail = statusPayload?.error ? String(statusPayload.error) : `HTTP ${statusResponse.status}`;
    const registerDetail = registerPayload?.error
      ? String(registerPayload.error)
      : `HTTP ${registerResponse.status}`;
    throw new Error(
      `deploy/solanaInfraStatus failed (${statusDetail}) and registerSolanaBridgeToken fallback failed (${registerDetail}).`,
    );
  }

  const fallbackBridgeToken =
    normalizeAddress(registerPayload.data.bridgeToken) ?? params.fallbackBridgeToken;
  const fallbackAdapter = normalizeAddress(registerPayload.data.adapter);
  const fallbackMint = normalizeBytes32(registerPayload.data.solanaMint);
  return {
    mode: 'register-build-fallback',
    infra: {
      batcherAdapter: fallbackAdapter,
      defaultRouteBridgeToken: fallbackBridgeToken,
      defaultMintConfigured: !!fallbackMint,
      defaultMintBytes32: fallbackMint,
      defaultRouteBridgeTokenAllowlisted: null,
      defaultMintRouteScalar: null,
    },
  };
}

async function probeProvisionerHealthDirect(params: {
  healthUrl: string | null;
  secret: string | null;
}): Promise<ProvisionerHealthProbe> {
  const healthUrl = String(params.healthUrl ?? '').trim();
  if (!healthUrl) {
    return {
      reachable: false,
      statusCode: null,
      healthOk: null,
      payerHealthy: null,
      reportedAtMs: null,
    };
  }
  const secret = String(params.secret ?? '').trim();
  const headers: Record<string, string> = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const reportedAtMs = parseIsoTimestampMs(payload?.now);
    return {
      reachable: true,
      statusCode: response.status,
      healthOk: typeof payload?.ok === 'boolean' ? payload.ok : null,
      payerHealthy: typeof payload?.payerHealthy === 'boolean' ? payload.payerHealthy : null,
      reportedAtMs,
    };
  } catch {
    return {
      reachable: false,
      statusCode: null,
      healthOk: null,
      payerHealthy: null,
      reportedAtMs: null,
    };
  }
}

function evaluateProvisionerLivenessDirect(params: {
  enforced: boolean;
  maxHealthAgeSeconds: number;
  probe: ProvisionerHealthProbe;
}): { healthy: boolean; blockers: string[] } {
  if (!params.enforced) return { healthy: true, blockers: [] };
  const blockers: string[] = [];
  const { probe } = params;
  if (!probe.reachable) {
    blockers.push('Direct provisioner health check is unreachable in fallback mode.');
    return { healthy: false, blockers };
  }
  if (probe.statusCode !== null && probe.statusCode >= 400) {
    blockers.push(`Direct provisioner health returned HTTP ${probe.statusCode} in fallback mode.`);
  }
  if (probe.healthOk === false) {
    blockers.push('Direct provisioner health reported ok=false in fallback mode.');
  }
  if (probe.payerHealthy === false) {
    blockers.push('Direct provisioner payer balance is below minimum in fallback mode.');
  }
  if (probe.reportedAtMs === null) {
    blockers.push('Direct provisioner health payload missing timestamp in fallback mode.');
  } else {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - probe.reportedAtMs) / 1000));
    if (ageSeconds > params.maxHealthAgeSeconds) {
      blockers.push(
        `Direct provisioner health payload is stale in fallback mode (${ageSeconds}s > ${params.maxHealthAgeSeconds}s).`,
      );
    }
  }
  return { healthy: blockers.length === 0, blockers };
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
    const apiBaseUrl = String(process.env.KPR_API_BASE_URL ?? '').trim();
    const apiKey = String(process.env.KPR_API_KEY ?? '').trim();
    const internalSecret = String(
      process.env.DEPLOY_SOLANA_REGISTRATION_SECRET ??
        process.env.SOLANA_REGISTRATION_INTERNAL_SECRET ??
        '',
    ).trim();
    if (!apiBaseUrl || (!apiKey && !internalSecret)) {
      warningFindings.push(
        'Bridge integrity monitor skipped: KPR_API_BASE_URL and at least one auth secret are required.',
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

    const signerFindings = await parseSignerOverlapFindings();
    checksRun += 1;
    criticalFindings.push(...signerFindings.critical);
    warningFindings.push(...signerFindings.warnings);

    const routeExpectations = parseRouteExpectations(
      String(process.env.SOLANA_BRIDGE_MONITOR_ROUTES_JSON ?? ''),
    );
    monitoredRoutes = routeExpectations.length;
    checksRun += 1;

    const canonicalAllowlist = readCanonicalAllowlistFromEnv();
    const [firstAllowlistedBridgeToken] = Array.from(canonicalAllowlist);
    const fallbackBridgeToken =
      normalizeAddress(process.env.SOLANA_DEFAULT_BRIDGE_TOKEN) ??
      routeExpectations[0]?.bridgeToken ??
      firstAllowlistedBridgeToken ??
      null;
    const infraFetch = await fetchSolanaInfraStatusWithFallback({ fallbackBridgeToken });
    const infra = infraFetch.infra;
    checksRun += 1;
    if (infraFetch.mode === 'register-build-fallback') {
      // FIX: HGH-07 — Log CRITICAL alert (not just warning) when auth failure degrades monitor
      criticalFindings.push(
        'deploy/solanaInfraStatus auth failed (401/403) — degraded to registerSolanaBridgeToken build-only fallback with reduced liveness and allowlist checks.',
      );
    }

    const canonicalAllowlistRequired = parseEnvBool(
      process.env.SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST_REQUIRED,
    );
    if (canonicalAllowlistRequired && canonicalAllowlist.size === 0) {
      criticalFindings.push(
        'Canonical bridge token allowlist is required but empty (SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST_REQUIRED=1).',
      );
    }
    if (infra.defaultRouteBridgeTokenAllowlisted === false) {
      criticalFindings.push('Default Solana bridge route token is outside the canonical bridge token allowlist.');
    } else {
      const defaultRouteBridgeToken = normalizeAddress(infra.defaultRouteBridgeToken);
      if (defaultRouteBridgeToken && canonicalAllowlist.size > 0 && !canonicalAllowlist.has(defaultRouteBridgeToken)) {
        criticalFindings.push(
          `Default Solana bridge route token ${defaultRouteBridgeToken} is outside SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST.`,
        );
      }
    }
    if (infra.defaultMintConfigured && infra.defaultMintRouteScalar != null) {
      const defaultScalar = parseOptionalBigInt(infra.defaultMintRouteScalar);
      if (defaultScalar != null && defaultScalar <= 0n) {
        criticalFindings.push(`Default mint route scalar is non-positive (${defaultScalar.toString()}).`);
      }
    }

    if (infraFetch.mode === 'infra-status' && infra.bridgeLivenessEnforced) {
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
    } else if (infraFetch.mode === 'register-build-fallback') {
      const livenessEnforced = parseEnvBool(process.env.SOLANA_BRIDGE_LIVENESS_ENFORCED);
      if (livenessEnforced) {
        const maxHealthAgeSeconds =
          parsePositiveInt(process.env.SOLANA_BRIDGE_LIVENESS_MAX_HEALTH_AGE_SECONDS) ?? 180;
        const healthUrl = String(
          process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL ??
            process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL ??
            '',
        ).trim();
        const provisionerSecret = String(process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET ?? '').trim();
        const probe = await probeProvisionerHealthDirect({
          healthUrl: healthUrl || null,
          secret: provisionerSecret || null,
        });
        const directLiveness = evaluateProvisionerLivenessDirect({
          enforced: true,
          maxHealthAgeSeconds,
          probe,
        });
        if (!directLiveness.healthy) {
          for (const blocker of directLiveness.blockers) {
            criticalFindings.push(`Bridge liveness (fallback direct): ${blocker}`);
          }
        }
      }
    }

    if (routeExpectations.length > 0) {
      const routeFindings = await evaluateRouteChecks({
        infra,
        expectations: routeExpectations,
        allowlist: canonicalAllowlist,
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
