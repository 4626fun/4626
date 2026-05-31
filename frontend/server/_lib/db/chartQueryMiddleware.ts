import type { VercelRequest } from '@vercel/node';
import type { DbPool } from './postgres.js';
import { withChartQuery } from './withChartQuery.js';

/**
 * Extracts a reasonable chart identifier from the request path.
 * You can customize the logic here.
 */
function getChartNameFromRequest(req: VercelRequest): string {
  const path = (req.url || '').split('?')[0];
  
  // Common patterns
  if (path.includes('/explore')) return 'explore';
  if (path.includes('/leaderboard')) return 'leaderboard';
  if (path.includes('/metrics')) return 'metrics';
  if (path.includes('/ethos')) return 'ethos';
  
  // Fallback to last path segment
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'unknown-chart';
}

/**
 * Returns a tagged DbPool based on the incoming request.
 * Use this in API handlers that serve chart data.
 *
 * Example:
 *   const db = await getDb();
 *   const chartDb = withChartTaggingFromRequest(db, req);
 */
export function withChartTaggingFromRequest(db: DbPool, req: VercelRequest): DbPool {
  const chartName = getChartNameFromRequest(req);
  return withChartQuery(db, chartName);
}
