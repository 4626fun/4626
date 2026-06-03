import type { DbPool } from './postgres.js';
import { withChartQuery } from './withChartQuery.js';

/**
 * Convenience wrapper that automatically applies chart tagging
 * based on the calling context (e.g. route name or chart identifier).
 *
 * Example usage in a chart-heavy API handler:
 *
 *   const taggedDb = withAutoChartTagging(db, 'explore-ethos-top');
 *   const rows = await taggedDb.sql`SELECT ... FROM creator_ethos_projection ...`;
 */
export function withAutoChartTagging(db: DbPool, chartIdentifier: string): DbPool {
  // You can extend this later to pull chart name from headers, context, etc.
  return withChartQuery(db, chartIdentifier);
}
