import type { VercelRequest } from '@vercel/node';
import type { DbPool } from './postgres.js';
import { withChartQuery } from './withChartQuery.js';

/**
 * Automatically applies chart tagging based on the request.
 * Use this at the top of chart-serving API handlers.
 *
 * Example:
 *   const db = await getDb();
 *   const chartDb = withChartTagging(db, req, 'explore-ethos-leaderboard');
 */
export function withChartTagging(db: DbPool, req: VercelRequest, explicitName?: string): DbPool {
  const chartName = explicitName || deriveChartNameFromRequest(req);
  return withChartQuery(db, chartName);
}

function deriveChartNameFromRequest(req: VercelRequest): string {
  const url = (req.url || '').split('?')[0];
  const segments = url.split('/').filter(Boolean);

  // Try to create a nice name from the path
  if (segments.includes('explore')) return 'explore';
  if (segments.includes('leaderboard')) return 'leaderboard';
  if (segments.includes('metrics')) return 'metrics';
  if (segments.includes('ethos')) return 'ethos';

  return segments[segments.length - 1] || 'unknown';
}
