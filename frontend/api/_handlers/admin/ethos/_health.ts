import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getDb } from '../../../../server/_lib/db/postgres.js';
import { getSessionAddress } from '../../../../server/_lib/auth/session.js';
import { isAdminAddress } from '../../../../server/_lib/wallet/adminAddresses.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const admin = getSessionAddress(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' });
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }

  const db = await getDb();
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  try {
    const [healthRows, refreshRows, indexRows, unusedRows, slowQueriesRows] = await Promise.all([
      db.sql`
        SELECT 
          table_name,
          row_count,
          last_refresh,
          retention_note
        FROM public.ethos_chart_system_health
        ORDER BY 
          CASE 
            WHEN table_name = 'creator_ethos_projection' THEN 0 
            ELSE 1 
          END,
          row_count DESC
      `,
      db.sql`
        SELECT 
          job,
          last_run
        FROM public.ethos_last_refreshes
        ORDER BY last_run DESC NULLS LAST
      `,
      db.sql`
        SELECT 
          "table",
          "index",
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          index_size
        FROM public.ethos_index_usage
        ORDER BY idx_scan DESC
        LIMIT 25
      `,
      db.sql`
        SELECT 
          "table",
          "index",
          index_size,
          idx_scan
        FROM public.ethos_unused_indexes
        ORDER BY index_size DESC
        LIMIT 15
      ` as any, // unusedRows
      db.sql`
        SELECT 
          left(query, 180) as query_sample,
          calls,
          round(mean_time::numeric, 1) as mean_ms,
          round(total_time::numeric, 1) as total_ms,
          chart_tag
        FROM public.ethos_expensive_chart_queries
        ORDER BY total_time DESC
        LIMIT 12
      ` as any
    ]);

    // Curated high-value index recommendations for the single interconnected Ethos source.
    // These target the dominant filter + multi-column ORDER BY patterns used by
    // Explore creator lists (all sort modes) and the 137+ charts.
    // All recommendations are for CREATE INDEX CONCURRENTLY and must be applied via migration
    // (or carefully in a maintenance window). Never auto-execute from the UI.
    const recommendedIndexes = [
      {
        name: 'idx_creator_ethos_projection_ethos_vol_mc_created',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_ethos_vol_mc_created ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, created_at DESC) WHERE ethos_score IS NOT NULL;',
        rationale: 'Covers the primary Explore sort (ethos + volume + market cap) + ethosMin filter + recency tie-breakers used by almost all creator list modes on v_explore_creators.',
        target: 'creator_ethos_projection (single source of truth for all Explore sorts)'
      },
      {
        name: 'idx_creator_ethos_projection_created_ethos',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_created_ethos ON public.creator_ethos_projection (created_at DESC, ethos_score DESC NULLS LAST) WHERE ethos_score IS NOT NULL;',
        rationale: 'Supports NEW_CREATORS + quality-gated recent sorts that combine recency with ethos threshold.',
        target: 'creator_ethos_projection'
      },
      {
        name: 'idx_ethos_daily_snapshots_date_score_mc',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ethos_daily_snapshots_date_score_mc ON public.creator_ethos_daily_snapshots (snapshot_date DESC, ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST);',
        rationale: 'Accelerates 30d/90d time-series and cohort panels that join snapshots on date + score + size.',
        target: 'creator_ethos_daily_snapshots'
      }
    ];

    return res.status(200).json({
      success: true,
      data: {
        health: healthRows.rows ?? [],
        lastRefreshes: refreshRows.rows ?? [],
        indexUsage: indexRows.rows ?? [],
        unusedIndexes: unusedRows.rows ?? [],
        slowChartQueries: slowQueriesRows.rows ?? [],
        recommendedIndexes,
        checkedAt: new Date().toISOString(),
        checkedBy: admin,
      }
    });
  } catch (err: any) {
    console.error('Ethos chart health fetch failed', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch health' });
  }
}
