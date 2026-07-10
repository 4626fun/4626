/**
 * KPR Workflow: Keepr Solana Fee Harvest
 *
 * Schedule: Every 5 minutes
 * Pattern: cron → Solana RPC read (withheld fees) → Solana harvest.
 * Base forwarding is disabled until real authenticated bridge evidence exists.
 */

import { executeSolanaFeeSettlement } from '../actions/keepr-solana-settle-fees.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-settle-fees';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaFeeSettlement();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        harvestThresholdMet: result.harvestThresholdMet,
        solanaHarvestedAmount: result.solanaHarvestedAmount,
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
