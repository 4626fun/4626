#!/usr/bin/env tsx
/**
 * Operator script to manually refresh Ethos chart support tables.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/refresh-ethos-chart-data.ts
 *   pnpm -C frontend exec tsx scripts/ops/refresh-ethos-chart-data.ts --views-only
 */

import { getDb } from '../server/_lib/db/postgres.js';

async function main() {
  const args = process.argv.slice(2);
  const viewsOnly = args.includes('--views-only') || args.includes('--distribution-only');
  const snapshotOnly = args.includes('--snapshot-only');

  const db = await getDb();
  if (!db) {
    console.error('No database connection');
    process.exit(1);
  }

  console.log('Refreshing Ethos chart support data...\n');

  if (!snapshotOnly) {
    console.log('→ Refreshing unified Ethos materialized views...');
    await db.sql`SELECT public.refresh_all_ethos_chart_views();`;
    console.log('   Done.');
  }

  if (!viewsOnly) {
    console.log('→ Snapshotting daily Ethos data...');
    await db.sql`SELECT public.snapshot_creator_ethos_daily();`;
    console.log('   Done.');
  }

  if (args.includes('--hourly') || args.includes('--15min')) {
    console.log('→ High-frequency snapshots are retired (no-op).');
  }

  console.log('\n✅ Ethos chart data refreshed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
