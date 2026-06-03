#!/usr/bin/env tsx
/**
 * Operator script to manually refresh Ethos chart support tables.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/refresh-ethos-chart-data.ts
 *   pnpm -C frontend exec tsx scripts/ops/refresh-ethos-chart-data.ts --distribution-only
 */

import { getDb } from '../server/_lib/db/postgres.js';

async function main() {
  const args = process.argv.slice(2);
  const distributionOnly = args.includes('--distribution-only');
  const snapshotOnly = args.includes('--snapshot-only');

  const db = await getDb();
  if (!db) {
    console.error('No database connection');
    process.exit(1);
  }

  console.log('Refreshing Ethos chart support data...\n');

  if (!snapshotOnly) {
    console.log('→ Refreshing distribution table...');
    await db.sql`SELECT public.refresh_creator_ethos_distribution();`;
    console.log('   Done.');
  }

  if (!distributionOnly) {
    console.log('→ Snapshotting daily Ethos data...');
    await db.sql`SELECT public.snapshot_creator_ethos_daily();`;
    console.log('   Done.');
  }

  console.log('\n✅ Ethos chart data refreshed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
