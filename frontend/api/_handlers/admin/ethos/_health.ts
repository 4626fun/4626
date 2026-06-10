import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getDb, getSessionAddress, isAdminAddress } from '@4626/server-core';

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
    const baseRecommendations = [
      {
        name: 'idx_creator_ethos_projection_ethos_vol_mc_created',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_ethos_vol_mc_created ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, created_at DESC) WHERE ethos_score IS NOT NULL;',
        rationale: 'Covers the primary Explore sort (ethos + volume + market cap) + ethosMin filter + recency tie-breakers used by almost all creator list modes on v_explore_creators.',
        target: 'creator_ethos_projection (single source of truth for all Explore sorts)',
        derived: false as const,
      },
      {
        name: 'idx_creator_ethos_projection_created_ethos',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_created_ethos ON public.creator_ethos_projection (created_at DESC, ethos_score DESC NULLS LAST) WHERE ethos_score IS NOT NULL;',
        rationale: 'Supports NEW_CREATORS + quality-gated recent sorts that combine recency with ethos threshold.',
        target: 'creator_ethos_projection',
        derived: false as const,
      },
      {
        name: 'idx_ethos_daily_snapshots_date_score_mc',
        definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ethos_daily_snapshots_date_score_mc ON public.creator_ethos_daily_snapshots (snapshot_date DESC, ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST);',
        rationale: 'Accelerates 30d/90d time-series and cohort panels that join snapshots on date + score + size.',
        target: 'creator_ethos_daily_snapshots',
        derived: false as const,
      },
    ];

    // Dynamically derive additional recommendations by inspecting live slow/expensive queries.
    // This is the "based on observed slow query patterns" part of the admin health surface.
    // We only ever propose indexes on the single interconnected source (projection + snapshots).
    // No new tables, no bucket tables, no fragmentation.
    const slowQueries = slowQueriesRows.rows ?? [];
    const dynamicRecommendations: any[] = [];

    const hasPattern = (sample: string, cols: string[]) =>
      cols.every((c) => sample.toLowerCase().includes(c.toLowerCase()));

    for (const q of slowQueries) {
      const sample = String(q.query_sample || '');

      // If we see expensive queries touching ethos_score + volume/market cap together
      // on the projection (very common in Explore multi-sort paths), reinforce the main composite.
      if (
        (hasPattern(sample, ['ethos_score', 'volume_24h']) || hasPattern(sample, ['ethos_score', 'market_cap'])) &&
        sample.toLowerCase().includes('creator_ethos_projection')
      ) {
        dynamicRecommendations.push({
          name: 'idx_creator_ethos_projection_ethos_vol_mc_created',
          definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_ethos_vol_mc_created ON public.creator_ethos_projection (ethos_score DESC NULLS LAST, volume_24h_usd DESC NULLS LAST, market_cap_usd DESC NULLS LAST, created_at DESC) WHERE ethos_score IS NOT NULL;',
          rationale: 'Observed in recent expensive queries involving ethos_score + volume/market_cap filters/sorts on the projection. Reinforces the primary composite for Explore + chart workloads.',
          target: 'creator_ethos_projection (single source)',
          derived: true as const,
          observedIn: q.chart_tag || 'chart-query',
        });
      }

      // Recency + ethos patterns (new creators, quality sorts)
      if (
        hasPattern(sample, ['created_at', 'ethos_score']) &&
        sample.toLowerCase().includes('creator_ethos_projection')
      ) {
        dynamicRecommendations.push({
          name: 'idx_creator_ethos_projection_created_ethos',
          definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_ethos_projection_created_ethos ON public.creator_ethos_projection (created_at DESC, ethos_score DESC NULLS LAST) WHERE ethos_score IS NOT NULL;',
          rationale: 'Seen in slow queries combining created_at recency with ethos_score thresholds (common in NEW_CREATORS / quality leaderboards).',
          target: 'creator_ethos_projection',
          derived: true as const,
          observedIn: q.chart_tag || 'chart-query',
        });
      }

      // Snapshot time-series patterns
      if (
        (hasPattern(sample, ['snapshot_date', 'ethos']) || hasPattern(sample, ['snapshot_hour', 'ethos'])) &&
        (sample.toLowerCase().includes('daily_snapshots') || sample.toLowerCase().includes('hourly_snapshots'))
      ) {
        dynamicRecommendations.push({
          name: 'idx_ethos_daily_snapshots_date_score_mc',
          definition: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ethos_daily_snapshots_date_score_mc ON public.creator_ethos_daily_snapshots (snapshot_date DESC, ethos_score DESC NULLS LAST, market_cap_usd DESC NULLS LAST);',
          rationale: 'Expensive time-series or cohort queries hitting daily/hourly snapshots with date + score predicates.',
          target: 'creator_ethos_*_snapshots',
          derived: true as const,
          observedIn: q.chart_tag || 'chart-query',
        });
      }
    }

    // Dedupe: prefer derived versions when we have live evidence, otherwise keep base
    const recByName = new Map<string, any>();
    for (const r of baseRecommendations) recByName.set(r.name, r);
    for (const d of dynamicRecommendations) {
      // If we have live evidence for a base one, mark the base as having live signal
      if (recByName.has(d.name)) {
        const existing = recByName.get(d.name)!;
        existing.derived = true;
        existing.observedIn = d.observedIn;
        existing.rationale = d.rationale; // prefer the live-observed rationale
      } else {
        recByName.set(d.name, d);
      }
    }

    const recommendedIndexes = Array.from(recByName.values());

    // Generate ready-to-apply Supabase migration snippets for every recommendation.
    // This turns the admin dashboard into a source of production-grade migration files
    // while keeping all proposed indexes strictly on the single interconnected source.
    function generateMigration(rec: any) {
      const today = new Date();
      const ymd = today.toISOString().slice(0, 10).replace(/-/g, '');
      const safeName = rec.name.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      const filename = `${ymd}000000_${safeName}.sql`;

      const observed = rec.observedIn ? `Observed in slow queries tagged: ${rec.observedIn}\n` : '';
      const evidence = rec.derived ? ' (derived from live expensive chart queries)' : '';

      const content = `-- Supabase migration generated from Ethos Chart Admin health dashboard
-- Date: ${today.toISOString()}
-- Recommendation: ${rec.name}${evidence}
-- Target (single source of truth): ${rec.target}
-- 
-- Rationale:
-- ${rec.rationale}
-- ${observed}
-- IMPORTANT: This index supports the unified Ethos model. All Explore sort modes
-- (market cap, ethos score, volume, recency, quality filters, etc.) must continue
-- to be implemented as different ORDER BY clauses against v_explore_creators /
-- creator_ethos_projection — never as separate tables or bucketed data.
--
-- Apply with: supabase db push  (or psql against the pooler)
-- The CONCURRENTLY form is safe for production (no long locks).

BEGIN;

${rec.definition}

-- For rollback (run manually if needed):
-- DROP INDEX CONCURRENTLY IF EXISTS ${rec.name};

COMMIT;
`;

      return { migrationFilename: filename, migrationContent: content.trim() };
    }

    // Attach migration artifacts to every recommendation
    for (const rec of recommendedIndexes) {
      const mig = generateMigration(rec);
      (rec as any).migrationFilename = mig.migrationFilename;
      (rec as any).migrationContent = mig.migrationContent;
    }

    return res.status(200).json({
      success: true,
      data: {
        health: healthRows.rows ?? [],
        lastRefreshes: refreshRows.rows ?? [],
        indexUsage: indexRows.rows ?? [],
        unusedIndexes: unusedRows.rows ?? [],
        slowChartQueries: slowQueriesRows.rows ?? [],
        recommendedIndexes,
        indexRecommendationsSummary: {
          total: recommendedIndexes.length,
          withLiveEvidence: recommendedIndexes.filter((r: any) => r.derived).length,
        },
        checkedAt: new Date().toISOString(),
        checkedBy: admin,
      }
    });
  } catch (err: any) {
    console.error('Ethos chart health fetch failed', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch health' });
  }
}
