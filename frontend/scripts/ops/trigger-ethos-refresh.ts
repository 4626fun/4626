#!/usr/bin/env tsx
/**
 * CLI tool for operators to manually trigger Ethos chart data refreshes.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/trigger-ethos-refresh.ts
 *   pnpm -C frontend exec tsx scripts/ops/trigger-ethos-refresh.ts --all
 *   pnpm -C frontend exec tsx scripts/ops/trigger-ethos-refresh.ts --views
 */

import { getDb } from '../server/_lib/db/postgres.js';

async function main() {
  const args = process.argv.slice(2);
  const doAll = args.includes('--all') || args.length === 0;
  const doViews = args.includes('--views') || args.includes('--distribution') || doAll;
  const doDaily = args.includes('--daily') || doAll;

  const db = await getDb();
  if (!db) {
    console.error('No database connection available');
    process.exit(1);
  }

  console.log('Triggering Ethos chart data refresh...\n');

  if (doViews) {
    console.log('→ Refreshing unified Ethos materialized views...');
    await db.sql`SELECT public.refresh_all_ethos_chart_views();`;
    console.log('   ✓ Done');
  }

  if (doDaily) {
    console.log('→ Snapshotting daily data...');
    await db.sql`SELECT public.snapshot_creator_ethos_daily();`;
    console.log('   ✓ Done');
  }

  if (args.includes('--hourly') || args.includes('--15min')) {
    console.log('→ High-frequency snapshots are retired (no-op).');
  }

  console.log('\n✅ All requested refreshes completed.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
