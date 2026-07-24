/**
 * KPR Workflow: Keepr Solana DLMM fee claim
 *
 * Schedule: Every 15 minutes
 * Pattern: cron → claim Meteora position swap fees → feeOwner Token Y ATA.
 * Distinct from keepr-solana-settle-fees (Token-2022 withheld harvest).
 */

import { executeSolanaDlmmFeeClaim } from '../actions/keepr-solana-claim-dlmm-fees.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-claim-dlmm-fees';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaDlmmFeeClaim();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        poolsProcessed: result.poolsProcessed,
        positionsClaimed: result.positionsClaimed,
        quoteHarvestedAmount: result.quoteHarvestedAmount,
        harvestThresholdMet: result.harvestThresholdMet,
        signatures: result.signatures,
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
