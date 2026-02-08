/**
 * CRE Workflow: Keepr Solana Fee Flush
 *
 * Schedule: Every 5 minutes
 * Pattern:  cron → Solana RPC read (withheld fees) → Solana write (flush) → bridge → Base write (forward to gauge)
 *
 * Actions:
 *   1. Read withheld TransferFeeConfig fees from the Token-2022 mint on Solana
 *   2. If above threshold, call flush_fees on the hook program
 *   3. Bridge harvested fees to Base via the Keepr Twin
 *   4. Call SolanaBridgeAdapter.receiveFeeFromSolana() on Base
 *
 * Prerequisites:
 *   - SOLANA_RPC_URL set in CRE secrets
 *   - SOLANA_KEEPER_KEYPAIR set in CRE secrets
 *   - SOLANA_BRIDGE_ADAPTER set in CRE secrets
 *   - KEEPR_PRIVATE_KEY set in CRE secrets (for Base tx signing)
 *
 * Revenue impact: HIGH
 *   - Un-flushed Solana fees = lost gauge revenue
 */

import { executeSolanaFeeFlush } from '../actions/keepr-solana-fee-flush.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-fee-flush';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaFeeFlush();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        feesFlushed: result.feesFlushed,
        amountFlushed: result.amountFlushed,
        bridged: result.bridged,
        forwardedToGauge: result.forwardedToGauge,
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
