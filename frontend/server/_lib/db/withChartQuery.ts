import type { DbPool } from './postgres.js';
import { setApplicationName } from './postgres.js';

/**
 * Wraps a DbPool so that every query is tagged with an application_name
 * for easy filtering in Supabase Query Performance and pg_stat_statements.
 *
 * Usage in API handlers or chart endpoints:
 *   const chartDb = withChartQuery(db, 'explore-ethos-leaderboard');
 *   await chartDb.sql`SELECT ...`;
 */
export function withChartQuery(db: DbPool, chartName: string): DbPool {
  const taggedName = `supabase-chart:${chartName}`;

  return {
    ...db,
    sql: async (strings, ...values) => {
      await setApplicationName(db, taggedName);
      return db.sql(strings, ...values);
    },
    query: db.query
      ? async (text, params) => {
          await setApplicationName(db, taggedName);
          return db.query!(text, params);
        }
      : undefined,
  };
}
