/**
 * KPR Workflow: Vault Strategy Reallocator
 *
 * Schedule: Every 15 minutes
 * Pattern: cron → onchain read → conditional rebalanceStrategies()
 */

import { executeVaultStrategyReallocator } from '../actions/vault-strategy-reallocator.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'vault-strategy-reallocator';

export async function handler(): Promise<void> {
  try {
    const result = await executeVaultStrategyReallocator();
    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        totalVaults: result.totalVaults,
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
  schedule: '*/15 * * * *',
  handler,
};

export default workflow;
