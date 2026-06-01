import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getDb } from '../../../../server/_lib/db/postgres.js';
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/auth/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Admin-only protection (consistent with other admin handlers).
  // This endpoint can trigger refreshes for the entire interconnected Ethos chart system
  // (projection snapshots + all materialized views used by the 137+ charts).
  const admin = getSessionAddress(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' });
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' });
  }

  const { type = 'all' } = req.body || {};

  const db = await getDb();
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' });
  }

  const results: string[] = [];

  try {
    if (type === 'all' || type === 'distribution') {
      await db.sql`SELECT public.refresh_creator_ethos_distribution();`;
      results.push('distribution refreshed');
    }
    if (type === 'all' || type === 'daily') {
      await db.sql`SELECT public.snapshot_creator_ethos_daily();`;
      results.push('daily snapshot created');
    }
    if (type === 'all' || type === 'hourly') {
      await db.sql`SELECT public.snapshot_creator_ethos_hourly();`;
      results.push('hourly snapshot created');
    }
    if (type === 'all' || type === '15min') {
      await db.sql`SELECT public.snapshot_creator_ethos_15min();`;
      results.push('15min snapshot created');
    }
    if (type === 'all' || type === 'views') {
      await db.sql`SELECT public.refresh_all_ethos_chart_views();`;
      results.push('unified materialized views refreshed');
    }

    return res.status(200).json({
      success: true,
      message: `Triggered: ${results.join(', ')}`,
      type,
      triggeredBy: admin,
    });
  } catch (err: any) {
    console.error('Ethos refresh admin action failed', err);
    return res.status(500).json({ success: false, error: err.message || 'Refresh failed' });
  }
}
