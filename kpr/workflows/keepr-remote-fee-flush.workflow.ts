/**
 * KPR Workflow: Remote ShareOFT Fee Flush
 *
 * Schedule: Every 5 minutes (when enabled)
 * Pattern: remote read → Privy EOA flushFees (payable) → Base CSW receiveBridgedFees UserOp
 */

import { executeRemoteShareOftFeeFlush } from '../actions/keepr-remote-fee-flush.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-remote-fee-flush';

export async function handler(): Promise<void> {
  try {
    const result = await executeRemoteShareOftFeeFlush();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        enabled: result.enabled,
        hubGauge: result.hubGauge,
        targets: result.targets,
        receiveBridgedFeesCalled: result.receiveBridgedFeesCalled,
        receiveBridgedTxHash: result.receiveBridgedTxHash,
        receiveBridgedError: result.receiveBridgedError,
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
