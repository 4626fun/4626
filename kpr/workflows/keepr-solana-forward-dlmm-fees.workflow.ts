/**
 * KPR Workflow: Solana DLMM fee forward (claim → swap ■ → LZ → Base gauge)
 *
 * Schedule: Every 30 minutes (ops-tuned)
 * Mirrors keepr-remote-fee-flush for the Solana spoke.
 */

import { executeSolanaDlmmFeeForward } from '../actions/keepr-solana-forward-dlmm-fees.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-forward-dlmm-fees';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaDlmmFeeForward();
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
  schedule: '*/30 * * * *',
  handler,
};

export default workflow;
