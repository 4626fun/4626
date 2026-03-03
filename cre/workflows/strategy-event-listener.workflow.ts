/**
 * CRE Workflow: Strategy Event Listener
 *
 * Always-on process (no finite cron cycle): subscribes to Base v3 Swap events,
 * evaluates Ajna/Charm thresholds, and enqueues strategy actions.
 */

import { startStrategyEventListener } from '../actions/strategy-event-listener.action.js';

const WORKFLOW_NAME = 'strategy-event-listener';

export async function handler(): Promise<void> {
  await startStrategyEventListener();
}

export const workflow = {
  name: WORKFLOW_NAME,
  schedule: '* * * * *',
  handler,
};

export default workflow;

