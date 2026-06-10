/**
 * KPR Workflow: Charm Rebalance Manager
 *
 * Schedule: Every 10 minutes
 * Pattern: onchain read -> conditional onchain write
 *
 * Actions:
 *   1. Read oracle V3 TWAP tick
 *   2. Compare against current Charm base range center
 *   3. Rebalance Charm vault when implied move >= trigger (default 10%)
 */

import { executeCharmRebalanceManager } from '../actions/charm-rebalance-manager.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'charm-rebalance-manager';

function shouldRunDirectCharmRebalance(): boolean {
  const mode = String(process.env.CHARM_REBALANCE_CANONICAL_MODE ?? 'queue').trim().toLowerCase();
  return mode === 'direct';
}

export async function handler(): Promise<void> {
  if (!shouldRunDirectCharmRebalance()) {
    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        skipped: true,
        reason: 'canonical_queue_mode',
      }),
    );
    return;
  }

  try {
    const result = await executeCharmRebalanceManager();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        totalVaults: result.totalVaults,
        totalStrategies: result.totalStrategies,
        processed: result.processed,
        rebalanced: result.rebalanced,
        skipped: result.skipped,
        errors: result.errors,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Workflow failed with unhandled error', { error: message });
    throw err;
  }
}

export const workflow = {
  name: WORKFLOW_NAME,
  schedule: '*/10 * * * *',
  handler,
};

export default workflow;
