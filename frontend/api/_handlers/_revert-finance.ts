import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../../server/_lib/logger.js';
import { handleOptions, setCors } from '../../server/auth/_shared.js'
import { fetchExternalJson } from '../../server/_lib/externalFetch.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { pool, days = '30', network = 'mainnet' } = req.query;

    if (!pool || typeof pool !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Pool address is required',
      });
    }

    const daysRaw = Array.isArray(days) ? String(days[0] ?? '') : String(days)
    const parsedDays = Number(daysRaw)
    if (!Number.isFinite(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      return res.status(400).json({
        success: false,
        error: 'days must be between 1 and 365',
      })
    }

    const networkRaw = Array.isArray(network) ? String(network[0] ?? '') : String(network)
    const normalizedNetwork = networkRaw.trim().toLowerCase()
    if (!/^[a-z0-9_-]{2,32}$/.test(normalizedNetwork)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network',
      })
    }

    // Proxy the request to Revert Finance API
    const apiUrl = new URL('https://api.revert.finance/v1/discover-pools/daily')
    apiUrl.searchParams.set('pool', pool)
    apiUrl.searchParams.set('days', String(Math.floor(parsedDays)))
    apiUrl.searchParams.set('network', normalizedNetwork)
    
    logger.info('[Revert Finance Proxy] Fetching', { apiUrl: apiUrl.toString() });

    const { data } = await fetchExternalJson<unknown>(apiUrl.toString(), {
      label: 'revert_finance_discover_pools',
      allowedHosts: ['api.revert.finance'],
      headers: {
        'Accept': 'application/json',
      },
      timeoutMs: 10_000,
      maxResponseBytes: 1_000_000,
    })

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return res.status(200).json(data);
  } catch (error: any) {
    logger.error('[Revert Finance Proxy] Error', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch data from Revert Finance',
    });
  }
}

