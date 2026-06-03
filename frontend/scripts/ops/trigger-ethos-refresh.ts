#!/usr/bin/env tsx
/**
 * CLI tool for operators to manually trigger Ethos chart data refreshes.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/trigger-ethos-refresh.ts
 *   pnpm -C frontend exec tsx scripts/ops/trigger-ethos-refresh.ts --all
 *   pnpm -C frontend exec tsx scripts/ops/trigger-ethos-refresh.ts --distribution
 */

import { getDb } from '../server/_lib/db/postgres.js';

async function main() {
  const args = process.argv.slice(2);
  const doAll = args.includes('--all') || args.length === 0;
  const doDistribution = args.includes('--distribution') || doAll;
  const doDaily = args.includes('--daily') || doAll;
  const doHourly = args.includes('--hourly') || doAll;

  const db = await getDb();
  if (!db) {
    console.error('No database connection available');
    process.exit(1);
  }

  console.log('Triggering Ethos chart data refresh...\n');

  if (doDistribution) {
    console.log('→ Refreshing distribution table...');
    await db.sql`SELECT public.refresh_creator_ethos_distribution();`;
    console.log('   ✓ Done');
  }

  if (doDaily) {
    console.log('→ Snapshotting daily data...');
    await db.sql`SELECT public.snapshot_creator_ethos_daily();`;
    console.log('   ✓ Done');
  }

  if (doHourly) {
    console.log('→ Snapshotting hourly data...');
    await db.sql`SELECT public.snapshot_creator_ethos_hourly();`;
    console.log('   ✓ Done');
  }

  console.log('\n✅ All requested refreshes completed.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
