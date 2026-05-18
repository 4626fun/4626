/**
 * KPR Workflow: Keepr Solana Winner Relay
 *
 * Schedule: Every 30 seconds (polled)
 * Pattern:  cron → Base event read (LotteryWinnerNotification) → Solana write (record_winner)
 *
 * Actions:
 *   1. Poll Base LotteryManager for new LotteryWinnerNotification events
 *   2. Filter for entries that originated from Solana (buyer is a Twin)
 *   3. Call record_winner on the Solana hook program
 *   4. Frontend subscribes to WinnerNotified event for "You won!" UX
 *
 * Prerequisites:
 *   - SOLANA_RPC_URL set in KPR secrets
 *   - SOLANA_KEEPER_KEYPAIR set in KPR secrets
 *   - LOTTERY_MANAGER set in KPR secrets
 *   - KPR_PRIVATE_KEY set in KPR secrets
 *
 * UX impact: MEDIUM
 *   - Without this, Solana winners won't see "You won!" notification
 *   - Prizes still land at their Twin on Base regardless
 */

import { executeSolanaWinnerRelay } from '../actions/keepr-solana-winner-relay.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-winner-relay';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaWinnerRelay();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        eventsProcessed: result.eventsProcessed,
        winnersRecorded: result.winnersRecorded,
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
