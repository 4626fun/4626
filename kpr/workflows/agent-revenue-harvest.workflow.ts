/**
 * KPR Workflow: Agent Revenue Harvest (V2)
 *
 * Schedule: Every 15 minutes
 * Harvests AgentTokenV4 tax when projectTaxRecipient points at AgentRevenueRouter.
 */

import runAgentRevenueHarvest from '../actions/agent-revenue-harvest.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'agent-revenue-harvest';

export async function handler(): Promise<void> {
  try {
    const results = await runAgentRevenueHarvest();
    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        results,
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, `agent-revenue-harvest failed: ${msg}`);
    throw err;
  }
}

export default { handler, name: WORKFLOW_NAME };
