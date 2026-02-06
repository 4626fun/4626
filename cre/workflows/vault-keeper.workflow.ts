/**
 * CRE Workflow: Vault Keeper
 *
 * Schedule: Every 5 minutes
 * Pattern:  cron → onchain read → conditional onchain write
 *
 * Actions:
 *   1. Read vault state (coinBalance, deploymentThreshold, minimumTotalIdle,
 *      totalStrategyWeight, lastReport)
 *   2. If idle funds exceed threshold → call tend()
 *   3. If >24 h since last report → call report()
 *
 * Prerequisites:
 *   - Keeper wallet must be authorized via setKeeper(keeperAddress) on the vault
 *   - KEEPR_PRIVATE_KEY set in CRE secrets
 *   - VAULT_ADDRESS set in CRE secrets
 *
 * Revenue impact: HIGH
 *   - Un-deployed funds = lost yield
 *   - Unreported profits = uncollected performance fees
 */

import { executeKeeper } from '../actions/vault-keeper.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'vault-keeper';

/**
 * CRE entrypoint — called on each cron trigger.
 */
export async function handler(): Promise<void> {
  try {
    const result = await executeKeeper();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        totalVaults: result.totalVaults,
        processed: result.processed,
        tended: result.tended,
        reported: result.reported,
        skipped: result.skipped,
        errors: result.errors,
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
  schedule: '*/5 * * * *', // Every 5 minutes
  handler,
};

export default workflow;
