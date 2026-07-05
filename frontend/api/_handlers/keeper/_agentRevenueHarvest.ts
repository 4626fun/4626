import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Keeper: agent-revenue-harvest (V2 agent tax lane).
 * Delegates to KPR action when machine auth is configured.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(501).json({
    ok: false,
    workflow: 'agent-revenue-harvest',
    message: 'Use Railway KPR runner or enqueue via /api/keeper/jobs/enqueueActiveVaults',
  });
}
