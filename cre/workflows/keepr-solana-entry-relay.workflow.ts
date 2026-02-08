/**
 * CRE Workflow: Keepr Solana Entry Relay
 *
 * Schedule: Every 30 seconds
 * Pattern:  cron → Solana RPC read (PendingEntries PDA) → Base write (relay entries)
 *
 * Actions:
 *   1. Read PendingEntries PDA from Solana Transfer Hook program
 *   2. If entries exist, call drain_entries on Solana
 *   3. Batch relay entries to Base via SolanaBridgeAdapter.processLotteryEntryFromSolana()
 *   4. Emergency drain if buffer > 80% full
 *
 * Prerequisites:
 *   - SOLANA_RPC_URL set in CRE secrets
 *   - SOLANA_KEEPER_KEYPAIR set in CRE secrets
 *   - SOLANA_BRIDGE_ADAPTER set in CRE secrets
 *   - KEEPR_PRIVATE_KEY set in CRE secrets (for Base tx signing)
 *
 * Infrastructure impact: HIGH
 *   - Without this worker, Solana lottery entries are never relayed to Base
 */

import { executeSolanaEntryRelay } from '../actions/keepr-solana-entry-relay.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-entry-relay';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaEntryRelay();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        entriesDrained: result.entriesDrained,
        entriesRelayed: result.entriesRelayed,
        overflowCount: result.overflowCount,
        emergencyDrain: result.emergencyDrain,
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
  schedule: '*/1 * * * *', // CRE minimum; action handles 30s interval internally
  handler,
};

export default workflow;
