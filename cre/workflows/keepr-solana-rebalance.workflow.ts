/**
 * CRE Workflow: Keepr Solana Rebalance
 *
 * Schedule: Every 10 minutes (adapter -> bridge -> optional Meteora
 * Alpha Vault deposit). Non-blocking; logs plan and does not write
 * onchain until `KEEPR_SOLANA_REBALANCE_EXECUTE=1` is set.
 *
 * This workflow picks up CREATOR tokens that `SolanaStrategy.rebalanceToSolana`
 * has moved from the strategy contract into the adapter on Base, and
 * bridges them to Solana. See `keepr-solana-rebalance.action.ts` for the
 * routing policy (Meteora-aware vs plain bridge).
 */

import { executeSolanaRebalance } from '../actions/keepr-solana-rebalance.action.js'
import { alertCritical } from '../utils/alerts.js'

const WORKFLOW_NAME = 'keepr-solana-rebalance'

export async function handler(): Promise<void> {
  try {
    const result = await executeSolanaRebalance()

    console.log(
      JSON.stringify({
        workflow: WORKFLOW_NAME,
        timestamp: new Date().toISOString(),
        creatorsScanned: result.creatorsScanned,
        creatorsWithAdapterBalance: result.creatorsWithAdapterBalance,
        executed: result.executed,
        plan: result.plan,
      }),
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await alertCritical(WORKFLOW_NAME, 'Workflow failed with unhandled error', { error: message })
    throw err
  }
}

export const workflow = {
  name: WORKFLOW_NAME,
  schedule: '*/10 * * * *',
  handler,
}

export default workflow
