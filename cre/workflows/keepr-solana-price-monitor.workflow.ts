/**
 * CRE Workflow: Keepr Solana Price Monitor
 *
 * Schedule: Every 5 minutes (during launch window only)
 * Pattern:  cron → Solana RPC read (DLMM active bin) → conditional alert/action
 *
 * Actions:
 *   1. Read DLMM active bin price from Meteora pool on Solana
 *   2. Read CCA floor price from Base
 *   3. Compare: if >15% deviation → alert; >20% → auto-recenter; >50% → halt
 *   4. Re-centering done via Meteora SDK (remove + add liquidity around new bin)
 *
 * Prerequisites:
 *   - SOLANA_RPC_URL set in CRE secrets
 *   - DLMM_POOL_ADDRESS set in CRE secrets (Solana)
 *   - CCA_STRATEGY set in CRE secrets (Base, for floor price)
 *   - KEEPR_PRIVATE_KEY set in CRE secrets
 *
 * Market integrity impact: HIGH (during launch window)
 *   - Prevents excessive price divergence between Base and Solana
 */

import { executeSolanaPriceMonitor } from '../actions/keepr-solana-price-monitor.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-price-monitor';

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaPriceMonitor();

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        basePriceUsd: result.basePriceUsd,
        solanaPriceUsd: result.solanaPriceUsd,
        deviationBps: result.deviationBps,
        action: result.action,
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
