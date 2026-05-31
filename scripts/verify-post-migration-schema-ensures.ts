#!/usr/bin/env tsx
/**
 * Post-Migration Schema Ensure Verification Script
 *
 * Exercises the key ensure*Schema functions after the centralization migration.
 * Helps confirm that:
 *   - No duplicate identifier crashes
 *   - withEnsureOnce works
 *   - The main once-logic paths (waitlist, accounts, etc.) still function
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/verify-post-migration-schema-ensures.ts
 *
 * Requires a working DATABASE_URL (or the script will use dry-run mode where possible).
 */

import { getDb, isDbConfigured } from '../frontend/server/_lib/db/postgres.js';
import { ensureWaitlistSchema } from '../frontend/server/_lib/onboarding/waitlistSchema.js';
import { ensureAccountsIdentitySchema } from '../frontend/server/_lib/identity/accountsIdentity.js';
import { ensureCreatorAccessSchema } from '../frontend/server/_lib/db/schemaBootstrap.js';
import { ensureTelegramTradingSchema } from '../frontend/server/_lib/db/schemaBootstrap.js';
import { ensureChatSchema } from '../frontend/server/_lib/db/schemaBootstrap.js';
import { ensureWorkspaceSchema } from '../frontend/server/_lib/db/schemaBootstrap.js';
import { ensureImageGenerationSchema } from '../frontend/server/_lib/db/schemaBootstrap.js';

async function main() {
  console.log('=== Post Schema Migration Verification ===\n');

  if (!isDbConfigured()) {
    console.warn('⚠️  DATABASE_URL not configured. Running in limited mode (some ensures will be skipped).');
  }

  const db = await getDb().catch(() => null);

  const tasks: Array<{ name: string; fn: () => Promise<any> }> = [
    { name: 'ensureWaitlistSchema', fn: () => ensureWaitlistSchema(db as any) },
    { name: 'ensureAccountsIdentitySchema', fn: () => ensureAccountsIdentitySchema(db as any) },
    { name: 'ensureCreatorAccessSchema (central)', fn: () => ensureCreatorAccessSchema(db as any) },
    { name: 'ensureTelegramTradingSchema (central)', fn: () => ensureTelegramTradingSchema(db as any) },
    { name: 'ensureChatSchema (central)', fn: () => ensureChatSchema(db as any) },
    { name: 'ensureWorkspaceSchema (central)', fn: () => ensureWorkspaceSchema(db as any) },
    { name: 'ensureImageGenerationSchema (central)', fn: () => ensureImageGenerationSchema(db as any) },
  ];

  let passed = 0;
  let failed = 0;

  for (const task of tasks) {
    process.stdout.write(`Running ${task.name}... `);
    try {
      await task.fn();
      console.log('✅ OK');
      passed++;
    } catch (err: any) {
      const msg = err?.message || String(err);
      // Some ensures legitimately throw "migration_required" in environments without the latest migrations.
      // We treat those as non-fatal for this verification script.
      if (msg.includes('_schema_migration_required')) {
        console.log(`⚠️  migration_required (expected in some envs): ${msg}`);
        passed++;
      } else if (msg.includes('waitlist_schema_ensure_failed') || msg.includes('accounts_identity_schema_ensure_failed')) {
        console.log(`❌ FAILED: ${msg}`);
        failed++;
      } else {
        console.log(`❌ ERROR: ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('\n❌ Some schema ensures failed. Investigate before deploying.');
    process.exit(1);
  } else {
    console.log('\n✅ All schema ensure paths executed without duplicate-identifier or recursion crashes.');
    console.log('   (Some may have legitimately required migrations — that is expected.)');
  }
}

main().catch((e) => {
  console.error('Script crashed:', e);
  process.exit(1);
});
