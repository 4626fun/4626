/**
 * CRE Workflow: Strategy Signal Listener
 *
 * Always-on process (no finite cron cycle): subscribes to Base v3 Swap events,
 * evaluates Ajna/Charm thresholds, and enqueues strategy actions.
 */

import { startStrategySignalListener } from '../actions/strategy-signal-listener.action.js';

const WORKFLOW_NAME = 'strategy-signal-listener';

export async function handler(): Promise<void> {
  await startStrategySignalListener();
}

export const workflow = {
  name: WORKFLOW_NAME,
  schedule: '* * * * *',
  handler,
};

export default workflow;

