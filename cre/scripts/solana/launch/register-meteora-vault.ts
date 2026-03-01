/**
 * Register (upsert) a Meteora Alpha Vault config into the `creator_meteora_alpha_vaults`
 * Supabase table so that the `registerSolanaBridgeToken` API can build the Phase 2 Meteora ix payload.
 *
 * Run this AFTER you have:
 *   1. Wrapped the ERC-20 ShareOFT on Solana  (`solana:create-token-2022-mint` / `wrap-token`)
 *   2. Created the Meteora DLMM pool          (`pnpm solana:create-dlmm-pool`)
 *   3. Created the Meteora Alpha Vault        (`pnpm solana:create-alpha-vault`)
 *
 * Usage:
 *   pnpm solana:register-meteora-vault
 *
 * Required env:
 *   DATABASE_URL              - Postgres connection string (same as the Vercel API uses)
 *   CREATOR_TOKEN             - EVM creator token address (e.g. 0x5b67...)
 *   METEORA_ALPHA_VAULT       - Solana pubkey of the Meteora Alpha Vault
 *   ALPHA_VAULT_PROGRAM_ID    - Solana pubkey of the Alpha Vault program
 *   DEPOSIT_ACCOUNTS_JSON     - JSON array of { pubkey, isSigner, isWritable }
 *
 * Optional env:
 *   METADATA_JSON             - Arbitrary JSON metadata to store alongside the record
 *   QUOTE_MINT                - Solana quote mint for strict pair policy (default: wrapped SOL)
 *   DRY_RUN                   - If "true", prints the row but does not insert
 *   PGSSLMODE / POSTGRES_SSL_MODE
 *                             - SSL mode: disable | require | verify-ca | verify-full
 *   POSTGRES_SSL_REJECT_UNAUTHORIZED
 *                             - "true"/"false" (defaults to false for Supabase unless CA is provided)
 *   POSTGRES_SSL_CA / PGSSLROOTCERT / PGSSLROOTCERT_CONTENT
 *                             - Optional CA bundle content (or path via PGSSLROOTCERT)
 *
 * Example DEPOSIT_ACCOUNTS_JSON (single escrow account):
 *   '[{"pubkey":"<base58>","isSigner":false,"isWritable":true}]'
 */

import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAddress, isAddress } from 'viem';
import pg, { type ClientConfig } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });
const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112';

function requireEnv(key: string): string {
  const v = (process.env[key] ?? '').trim();
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

function isSolanaPubkey(value: string): boolean {
  if (!value || value.length < 32 || value.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

function parseBooleanEnv(raw: string | undefined): boolean | null {
  const normalized = String(raw ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function readOptionalCaBundle(): string | null {
  const inline = String(process.env.POSTGRES_SSL_CA ?? process.env.PGSSLROOTCERT_CONTENT ?? '').trim();
  if (inline) return inline.replace(/\\n/g, '\n');

  const certPath = String(process.env.PGSSLROOTCERT ?? '').trim();
  if (!certPath) return null;
  try {
    return readFileSync(certPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read PGSSLROOTCERT file at "${certPath}": ${message}`);
  }
}

function resolvePgSslConfig(databaseUrl: string): ClientConfig['ssl'] | undefined {
  const envSslMode = String(process.env.POSTGRES_SSL_MODE ?? process.env.PGSSLMODE ?? '')
    .trim()
    .toLowerCase();

  let urlSslMode = '';
  let isSupabaseHost = false;
  try {
    const parsed = new URL(databaseUrl);
    urlSslMode = String(parsed.searchParams.get('sslmode') ?? '').trim().toLowerCase();
    isSupabaseHost = /\.supabase\.com$/i.test(parsed.hostname);
  } catch {
    // Ignore malformed URL edge-cases; pg can still parse raw connection strings.
  }

  const sslMode = envSslMode || urlSslMode;
  if (sslMode === 'disable') return false;

  const shouldEnableSsl =
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full' ||
    isSupabaseHost;

  if (!shouldEnableSsl) return undefined;

  const ca = readOptionalCaBundle();
  const explicitRejectUnauthorized = parseBooleanEnv(
    process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED ?? process.env.PGSSLREJECTUNAUTHORIZED,
  );
  const rejectUnauthorized =
    explicitRejectUnauthorized ?? (sslMode === 'verify-ca' || sslMode === 'verify-full' || Boolean(ca));

  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}

async function main() {
  const creatorTokenRaw = requireEnv('CREATOR_TOKEN');
  if (!isAddress(creatorTokenRaw)) throw new Error(`CREATOR_TOKEN is not a valid EVM address: ${creatorTokenRaw}`);
  const creatorToken = getAddress(creatorTokenRaw).toLowerCase();

  const meteoraAlphaVault = requireEnv('METEORA_ALPHA_VAULT');
  if (!isSolanaPubkey(meteoraAlphaVault)) throw new Error(`METEORA_ALPHA_VAULT is not a valid Solana pubkey: ${meteoraAlphaVault}`);

  const alphaVaultProgramId = requireEnv('ALPHA_VAULT_PROGRAM_ID');
  if (!isSolanaPubkey(alphaVaultProgramId)) throw new Error(`ALPHA_VAULT_PROGRAM_ID is not a valid Solana pubkey: ${alphaVaultProgramId}`);

  const depositAccountsRaw = requireEnv('DEPOSIT_ACCOUNTS_JSON');
  let depositAccounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  try {
    depositAccounts = JSON.parse(depositAccountsRaw);
  } catch {
    throw new Error('DEPOSIT_ACCOUNTS_JSON is not valid JSON');
  }
  if (!Array.isArray(depositAccounts) || depositAccounts.length === 0) {
    throw new Error('DEPOSIT_ACCOUNTS_JSON must be a non-empty array');
  }
  for (const acc of depositAccounts) {
    if (!isSolanaPubkey(acc.pubkey)) throw new Error(`Invalid pubkey in DEPOSIT_ACCOUNTS_JSON: ${acc.pubkey}`);
  }

  let metadata: Record<string, unknown> | null = null;
  const metadataRaw = (process.env.METADATA_JSON ?? '').trim();
  if (metadataRaw) {
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      throw new Error('METADATA_JSON is not valid JSON');
    }
  }
  const quoteMint = (process.env.QUOTE_MINT ?? SOLANA_NATIVE_MINT).trim();
  if (!isSolanaPubkey(quoteMint)) {
    throw new Error(`QUOTE_MINT is not a valid Solana pubkey: ${quoteMint}`);
  }
  const metadataWithPair = { ...(metadata ?? {}), pair_base_mint: quoteMint };

  const dryRun = (process.env.DRY_RUN ?? '').toLowerCase() === 'true';

  const row = {
    creator_token: creatorToken,
    meteora_alpha_vault: meteoraAlphaVault,
    alpha_vault_program_id: alphaVaultProgramId,
    deposit_accounts: depositAccounts,
    enabled: true,
    metadata: metadataWithPair,
  };

  console.log('=== Register Meteora Alpha Vault ===');
  console.log(JSON.stringify(row, null, 2));
  console.log();

  if (dryRun) {
    console.log('[DRY_RUN] Skipping database upsert.');
    return;
  }

  const databaseUrl = requireEnv('DATABASE_URL');
  const ssl = resolvePgSslConfig(databaseUrl);
  const client = new pg.Client({
    connectionString: databaseUrl,
    ...(ssl !== undefined ? { ssl } : {}),
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_meteora_alpha_vaults (
        creator_token TEXT PRIMARY KEY,
        meteora_alpha_vault TEXT NOT NULL,
        alpha_vault_program_id TEXT NOT NULL,
        deposit_accounts JSONB NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `
      INSERT INTO creator_meteora_alpha_vaults
        (creator_token, meteora_alpha_vault, alpha_vault_program_id, deposit_accounts, enabled, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (creator_token) DO UPDATE SET
        meteora_alpha_vault   = EXCLUDED.meteora_alpha_vault,
        alpha_vault_program_id = EXCLUDED.alpha_vault_program_id,
        deposit_accounts      = EXCLUDED.deposit_accounts,
        enabled               = EXCLUDED.enabled,
        metadata              = EXCLUDED.metadata,
        updated_at            = NOW();
      `,
      [
        row.creator_token,
        row.meteora_alpha_vault,
        row.alpha_vault_program_id,
        JSON.stringify(row.deposit_accounts),
        row.enabled,
        row.metadata ? JSON.stringify(row.metadata) : null,
      ],
    );

    console.log(`✓ Upserted Meteora Alpha Vault config for creator token ${creatorToken}`);
    console.log('  Next step: retry the vault deployment — Phase 2 finalize should now build the Meteora ix payload.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
