/**
 * CRE Workflow: Bridge Integrity Monitor
 *
 * Schedule: Every 5 minutes
 * Pattern: API status + onchain read checks + alerting
 *
 * Checks:
 *   1. Signer-overlap drift (config snapshot based)
 *   2. Canonical route drift (mint -> mapped token)
 *   3. Scalar anomalies (zero/mismatch)
 *   4. Bridge liveness freshness gate from deploy infra status
 */

import { executeBridgeIntegrityMonitor } from '../actions/bridge-integrity-monitor.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'bridge-integrity-monitor';

export async function handler(): Promise<void> {
  try {
    const result = await executeBridgeIntegrityMonitor();
    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        status: result.status,
        checksRun: result.checksRun,
        monitoredRoutes: result.monitoredRoutes,
        signerOverlapCount: result.signerOverlapCount,
        criticalFindings: result.criticalFindings.length,
        warningFindings: result.warningFindings.length,
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
