/**
 * CRE Workflow: CCA Finalization
 *
 * Schedule: Every 10 minutes
 * Pattern:  cron → onchain read → conditional onchain write
 *
 * Actions:
 *   1. Read currentAuction from CCALaunchStrategy
 *   2. If auction exists, call isGraduated() on the auction contract
 *   3. If graduated → call sweepCurrency() (settles + configures oracle V4 pool)
 *   4. Then call sweepUnsoldTokens()
 *
 * Prerequisites:
 *   - KPR_PRIVATE_KEY set in CRE secrets (for gas only — no keeper role needed)
 *   - CCA_STRATEGY_ADDRESS set in CRE secrets
 *
 * Feature impact: COMPLETING
 *   - Without this, graduated auctions sit unsettled indefinitely
 *   - Oracle V4 pool never gets configured automatically
 *   - Raised currency never reaches the funds recipient
 */

import { executeCcaFinalization } from '../actions/cca-finalization.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'cca-finalization';

/**
 * CRE entrypoint — called on each cron trigger.
 */
export async function handler(): Promise<void> {
  try {
    const result = await executeCcaFinalization();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        totalStrategies: result.totalStrategies,
        processed: result.processed,
        settled: result.settled,
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
  schedule: '*/10 * * * *', // Every 10 minutes
  handler,
};

export default workflow;
