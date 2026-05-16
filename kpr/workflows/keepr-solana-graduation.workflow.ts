/**
 * CRE Workflow: Keepr Solana Graduation Sync
 *
 * Schedule: Every minute (during launch window only)
 * Pattern:  cron → Base event read (AuctionGraduated) → Solana write (Alpha Vault close)
 *
 * Actions:
 *   1. Check if Base CCA has graduated (isGraduated on auction contract)
 *   2. If graduated, trigger Alpha Vault close on Solana
 *   3. Hard UTC deadline fallback (~1h after expected graduation)
 *
 * Prerequisites:
 *   - SOLANA_RPC_URL set in CRE secrets
 *   - SOLANA_KEEPER_KEYPAIR set in CRE secrets
 *   - CCA_STRATEGY set in CRE secrets
 *   - ALPHA_VAULT_ADDRESS set in CRE secrets (Solana)
 *
 * Infrastructure impact: CRITICAL (during launch window)
 *   - Without this, Solana Alpha Vault stays open after Base CCA graduates
 *   - Hard deadline backstop prevents deposits from being stuck
 */

import { executeSolanaGraduation } from '../actions/keepr-solana-graduation.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-graduation';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaGraduation();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        baseCCAGraduated: result.baseCCAGraduated,
        alphaVaultClosed: result.alphaVaultClosed,
        deadlineTriggered: result.deadlineTriggered,
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
