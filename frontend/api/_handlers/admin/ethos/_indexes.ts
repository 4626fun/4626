import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getDb, getSessionAddress, isAdminAddress } from '@4626/server-core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  if (req.method === 'GET') {
    // Return current index health (used + unused)
    try {
      const [used, unused] = await Promise.all([
        db.sql`
          SELECT "table", "index", idx_scan, index_size 
          FROM public.ethos_index_usage 
          ORDER BY idx_scan DESC 
          LIMIT 30
        `,
        db.sql`
          SELECT "table", "index", index_size, idx_scan 
          FROM public.ethos_unused_indexes 
          ORDER BY index_size DESC
        `
      ]);

      return res.status(200).json({
        success: true,
        data: {
          used: used.rows ?? [],
          unused: unused.rows ?? [],
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { action, indexName } = req.body || {};

    if (action === 'drop' && indexName) {
      // Safety: only allow dropping indexes that appear in the unused view
      try {
        const check = await db.sql`
          SELECT 1 FROM public.ethos_unused_indexes WHERE "index" = ${indexName}
        `;

        if (!check.rows || check.rows.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'Index not found in unused list. Manual review required.' 
          });
        }

        // Safe concurrent drop
        await db.sql`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`;

        return res.status(200).json({
          success: true,
          message: `Dropped index concurrently: ${indexName}`,
        });
      } catch (err: any) {
        console.error('Failed to drop index', err);
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
