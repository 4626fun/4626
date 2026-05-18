/**
 * Bootstrap Solana-side deploy prerequisites in one command.
 *
 * Flow:
 *   1) Register bridge token route on Base/Solana (idempotent).
 *   2) Upsert creator -> Meteora Alpha Vault mapping (reuses existing script).
 *   3) Smoke-build Phase-2 Solana ix payload for deploy-session usage.
 *
 * Usage:
 *   pnpm -C kpr run solana:bootstrap-side
 *
 * Required env:
 *   DEPLOY_SOLANA_REGISTRATION_SECRET  - Internal API auth secret
 *   CREATOR_TOKEN                      - Base creator token (0x...)
 *   METEORA_ALPHA_VAULT                - Base58 pubkey (for upsert step)
 *   ALPHA_VAULT_PROGRAM_ID             - Base58 pubkey (for upsert step)
 *   DEPOSIT_ACCOUNTS_JSON              - JSON array of account metas (for upsert step)
 *
 * Optional env:
 *   DEPLOY_API_ORIGIN                  - App origin (default: https://4626.fun)
 *   CREATOR_VAULT_BATCHER              - Deployment batcher (default: mainnet batcher)
 *   EXPECTED_SOLANA_AMOUNT             - Base units for smoke ix build (default: 1000000000)
 *   SKIP_ROUTE_REGISTER                - "1" to skip step 1
 *   SKIP_METEORA_UPSERT                - "1" to skip step 2
 *   SKIP_SMOKE_BUILD                   - "1" to skip step 3
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { getAddress, isAddress, type Address } from 'viem';

import { requireEnv } from '../../../config.js';

type RegisterResponseData = {
  bridgeToken: Address;
  registered: boolean;
  txHash: string | null;
  solanaMint: string | null;
  solanaDecimals: number | null;
  meteoraAlphaVault: string | null;
  solanaIxs: Array<{
    programId: string;
    serializedAccounts: string[];
    data: string;
  }>;
};

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error?: string };

const __dirname = dirname(fileURLToPath(import.meta.url));
const KPR_ROOT = resolve(__dirname, '../../..');
const REPO_ROOT = resolve(KPR_ROOT, '..');
const DEFAULT_ORIGIN = 'https://4626.fun';
const DEFAULT_BATCHER = '0x004684670d284EF607E1B2424fcf8ccBda8ef828';
const DEFAULT_EXPECTED_SOLANA_AMOUNT = '1000000000';

function loadBootstrapEnv(): void {
  // Highest-priority files first (dotenv does not overwrite existing keys).
  const candidates = [
    resolve(REPO_ROOT, 'frontend/.env.local'),
    resolve(REPO_ROOT, 'frontend/.env'),
    resolve(REPO_ROOT, '.env'),
    resolve(KPR_ROOT, '.env'),
    resolve(KPR_ROOT, 'kpr-workflows/.env'),
  ];
  for (const envPath of candidates) {
    loadEnv({ path: envPath });
  }
}

function readFirstNonEmptyEnv(keys: string[]): string {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function requireAnyEnv(keys: string[]): string {
  const value = readFirstNonEmptyEnv(keys);
  if (!value) {
    throw new Error(`Missing required env var: ${keys.join(' or ')}`);
  }
  return value;
}

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function normalizeOrigin(raw: string): string {
  const value = raw.trim();
  if (!value) return DEFAULT_ORIGIN;
  const url = new URL(value);
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname === '/api' ? '' : pathname;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

function requireAddressEnv(key: string, fallback?: string): Address {
  const raw = String(process.env[key] ?? fallback ?? '').trim();
  if (!isAddress(raw)) {
    throw new Error(`Invalid address in ${key}: ${raw || '(empty)'}`);
  }
  return getAddress(raw);
}

function requireAddressEnvFromKeys(keys: string[], fallback?: string): Address {
  const raw = readFirstNonEmptyEnv(keys) || String(fallback ?? '').trim();
  if (!isAddress(raw)) {
    throw new Error(`Invalid address in ${keys.join(' or ')}: ${raw || '(empty)'}`);
  }
  return getAddress(raw);
}

function requirePositiveIntegerString(value: string, key: string): string {
  try {
    const parsed = BigInt(value);
    if (parsed <= 0n) throw new Error('must be > 0');
    return parsed.toString();
  } catch {
    throw new Error(`${key} must be a positive integer string. Received: ${value}`);
  }
}

async function postRegisterSolanaBridgeToken(params: {
  origin: string;
  secret: string;
  body: Record<string, unknown>;
}): Promise<RegisterResponseData> {
  const url = `${params.origin}/api/deploy/registerSolanaBridgeToken`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.secret}`,
    },
    body: JSON.stringify(params.body),
  });

  const raw = await response.text();
  let envelope: ApiEnvelope<RegisterResponseData> | null = null;
  try {
    envelope = raw ? (JSON.parse(raw) as ApiEnvelope<RegisterResponseData>) : null;
  } catch {
    envelope = null;
  }

  if (!response.ok || !envelope || envelope.success !== true) {
    const detail =
      envelope && envelope.success === false && envelope.error
        ? envelope.error
        : raw.slice(0, 600) || 'Unknown error';
    throw new Error(`registerSolanaBridgeToken failed (${response.status}): ${detail}`);
  }

  return envelope.data;
}

async function runMeteoraUpsertScript(): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      'tsx',
      ['scripts/solana/launch/register-meteora-vault.ts'],
      {
        cwd: KPR_ROOT,
        env: process.env,
        stdio: 'inherit',
      },
    );

    child.on('error', (error) => rejectPromise(error));
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`register-meteora-vault exited with code ${String(code)}`));
    });
  });
}

function ensureUpsertEnvPresent(): void {
  requireEnv('DATABASE_URL');
  requireEnv('METEORA_ALPHA_VAULT');
  requireEnv('ALPHA_VAULT_PROGRAM_ID');
  requireEnv('DEPOSIT_ACCOUNTS_JSON');
}

async function main(): Promise<void> {
  loadBootstrapEnv();

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(
      [
        'Usage: pnpm -C kpr run solana:bootstrap-side',
        '',
        'Runs:',
        '  1) registerSolanaBridgeToken (route register)',
        '  2) solana:register-meteora-vault (DB/env upsert)',
        '  3) registerSolanaBridgeToken (buildOnly smoke payload)',
        '',
        'Optional skips:',
        '  SKIP_ROUTE_REGISTER=1',
        '  SKIP_METEORA_UPSERT=1',
        '  SKIP_SMOKE_BUILD=1',
      ].join('\n'),
    );
    return;
  }

  const secret = requireAnyEnv([
    'DEPLOY_SOLANA_REGISTRATION_SECRET',
    'SOLANA_REGISTRATION_INTERNAL_SECRET',
  ]);
  const creatorToken = requireAddressEnvFromKeys([
    'CREATOR_TOKEN',
    'SOLANA_DEFAULT_BRIDGE_TOKEN',
  ]);
  const batcherAddress = requireAddressEnv('CREATOR_VAULT_BATCHER', DEFAULT_BATCHER);
  const origin = normalizeOrigin(String(process.env.DEPLOY_API_ORIGIN ?? DEFAULT_ORIGIN));
  const expectedSolanaAmount = requirePositiveIntegerString(
    String(process.env.EXPECTED_SOLANA_AMOUNT ?? DEFAULT_EXPECTED_SOLANA_AMOUNT).trim(),
    'EXPECTED_SOLANA_AMOUNT',
  );

  const skipRoute = envFlag('SKIP_ROUTE_REGISTER');
  const skipUpsert = envFlag('SKIP_METEORA_UPSERT');
  const skipSmoke = envFlag('SKIP_SMOKE_BUILD');

  console.log('=== Bootstrap Solana Side (KPR) ===');
  console.log(`Origin:                  ${origin}`);
  console.log(`Creator token:           ${creatorToken}`);
  console.log(`Batcher:                 ${batcherAddress}`);
  console.log(`Expected solana amount:  ${expectedSolanaAmount}`);
  console.log(
    `Skips:                   route=${skipRoute ? 'yes' : 'no'} upsert=${
      skipUpsert ? 'yes' : 'no'
    } smoke=${skipSmoke ? 'yes' : 'no'}`,
  );
  console.log();

  let registerStepResult: RegisterResponseData | null = null;
  let smokeStepResult: RegisterResponseData | null = null;

  if (!skipRoute) {
    console.log('[1/3] Registering bridge route...');
    registerStepResult = await postRegisterSolanaBridgeToken({
      origin,
      secret,
      body: {
        bridgeToken: creatorToken,
        batcherAddress,
        buildOnly: false,
      },
    });
    console.log(
      `      registered=${String(registerStepResult.registered)} txHash=${
        registerStepResult.txHash ?? 'null'
      }`,
    );
  } else {
    console.log('[1/3] Skipped route registration');
  }

  if (!skipUpsert) {
    console.log('[2/3] Upserting Meteora mapping...');
    ensureUpsertEnvPresent();
    await runMeteoraUpsertScript();
  } else {
    console.log('[2/3] Skipped Meteora upsert');
  }

  if (!skipSmoke) {
    console.log('[3/3] Smoke-building Solana ix payload...');
    smokeStepResult = await postRegisterSolanaBridgeToken({
      origin,
      secret,
      body: {
        bridgeToken: creatorToken,
        creatorToken,
        batcherAddress,
        expectedSolanaAmount,
        buildOnly: true,
      },
    });
    if (!Array.isArray(smokeStepResult.solanaIxs) || smokeStepResult.solanaIxs.length === 0) {
      throw new Error('Smoke build succeeded but returned empty solanaIxs.');
    }
    console.log(
      `      ixCount=${smokeStepResult.solanaIxs.length} meteoraAlphaVault=${
        smokeStepResult.meteoraAlphaVault ?? 'null'
      }`,
    );
  } else {
    console.log('[3/3] Skipped smoke build');
  }

  console.log();
  console.log(
    JSON.stringify(
      {
        success: true,
        origin,
        creatorToken,
        batcherAddress,
        routeRegistered: registerStepResult?.registered ?? null,
        routeTxHash: registerStepResult?.txHash ?? null,
        smokeIxCount: smokeStepResult?.solanaIxs?.length ?? null,
        smokeMeteoraAlphaVault: smokeStepResult?.meteoraAlphaVault ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[bootstrap-solana-side] ${message}`);
  process.exit(1);
});
