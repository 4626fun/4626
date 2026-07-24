/**
 * KPR Workflow: Base WETH→■ fee buyback (routed, private-submit)
 *
 * Schedule: ops-driven / every 15m when sell-tax WETH accumulates
 */

import { executeWethFeeBuyback } from '../actions/keepr-weth-fee-buyback.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-weth-fee-buyback';

export async function handler(): Promise<void> {
  try {
    const result = await executeWethFeeBuyback();
    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        ...result,
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
