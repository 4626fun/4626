/**
 * CRE Workflow: Keepr Action Queue
 *
 * Schedule: Every 30 seconds
 * Pattern:  cron → HTTP read (poll API) → execute XMTP ops → HTTP write (update status)
 *
 * Actions:
 *   1. GET /api/keepr/actions/pending — fetch pending/retry actions
 *   2. For each action: mark executing → run XMTP operation → mark executed/failed/retry
 *   3. Exponential backoff on retries (60s → 120s → 240s → 480s)
 *   4. Max 5 attempts per action before permanent failure
 *
 * Prerequisites:
 *   - KPR_API_BASE_URL set in CRE secrets
 *   - KPR_API_KEY set in CRE secrets (shared with Vercel API)
 *   - XMTP keys configured (for actual group operations)
 *
 * Infrastructure impact: HIGH
 *   - Without this worker, enqueued actions are never consumed
 *   - Join requests, member syncs, and group messages all stall
 */

import { executeKeeprActionQueue } from '../actions/keepr-action-queue.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-action-queue';

/**
 * CRE entrypoint — called on each cron trigger.
 */
export async function handler(): Promise<void> {
  try {
    const result = await executeKeeprActionQueue();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        retried: result.retried,
        actions: result.actions,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Workflow failed with unhandled error', { error: message });
    throw err; // Let CRE retry
  }
}

// ---------------------------------------------------------------------------
// CRE workflow configuration export
// ---------------------------------------------------------------------------

export const workflow = {
  name: WORKFLOW_NAME,
  schedule: '*/1 * * * *', // Every minute (CRE minimum; action polling handles sub-minute granularity)
  handler,
};

export default workflow;
