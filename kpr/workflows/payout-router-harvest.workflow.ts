/**
 * KPR Workflow: Payout Router Harvest
 *
 * Schedule: Every 5 minutes
 * Pattern: cron -> read router balances -> conditional writes
 *
 * Actions:
 *   1. (Optional) claim protocol rewards into payout router
 *   2. convertAndQueue creatorCoin balances
 *   3. convertAndQueue ZORA balances
 *   4. (Optional) convertAndQueue WETH balances
 */

import { executePayoutRouterHarvest } from '../actions/payout-router-harvest.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'payout-router-harvest';

export async function handler(): Promise<void> {
  try {
    const result = await executePayoutRouterHarvest();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        totalVaults: result.totalVaults,
        processed: result.processed,
        claimedVaults: result.claimedVaults,
        converted: result.converted,
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
  schedule: '*/5 * * * *',
  handler,
};

export default workflow;
