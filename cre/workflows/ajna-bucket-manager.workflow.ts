/**
 * CRE Workflow: Ajna Bucket Manager
 *
 * Schedule: Every 10 minutes
 * Pattern: onchain read → conditional onchain write
 *
 * Actions:
 *   1. Read oracle-suggested Ajna bucket from V3 TWAP
 *   2. Compare with strategy current bucket
 *   3. Apply threshold/max-step guardrails
 *   4. Bias target using nearby bucket liquidity
 *   5. Execute setMinBucketIndex when needed
 */

import { executeAjnaBucketManager } from '../actions/ajna-bucket-manager.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'ajna-bucket-manager';

export async function handler(): Promise<void> {
  try {
    const result = await executeAjnaBucketManager();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        totalVaults: result.totalVaults,
        totalStrategies: result.totalStrategies,
        processed: result.processed,
        moved: result.moved,
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

