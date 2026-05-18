/**
 * KPR Workflow: Keepr Solana Relay Entries
 *
 * Schedule: Every 30 seconds
 * Pattern: cron → Solana RPC read (PendingEntries PDA) → Solana write (relay) → Base write
 */

import { executeSolanaRelayEntries } from '../actions/keepr-solana-relay-entries.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-relay-entries';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaRelayEntries();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        entriesQueued: result.entriesQueued,
        entriesRelayed: result.entriesRelayed,
        overflowCount: result.overflowCount,
        emergencyRelay: result.emergencyRelay,
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
  schedule: '*/1 * * * *',
  handler,
};

export default workflow;
