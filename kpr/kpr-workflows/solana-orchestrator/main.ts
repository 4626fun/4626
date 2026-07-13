import {
  executeSolanaOrchestratorAction,
  normalizeSolanaOrchestratorAction,
  type SolanaOrchestratorAction,
} from '../../solana-keeper-orchestrator.js'

type SolanaOrchestratorResult = {
  workflow: string
  attempts: number
  completed: number
  failed: number
  skipped: number
  checkpoints: string[]
  errors: string[]
  triggerPlane: 'local_cron' | 'disabled'
}

function parseActions(raw: string | undefined): SolanaOrchestratorAction[] {
  const values = (raw ?? '')
    .split(',')
    .map((value) => normalizeSolanaOrchestratorAction(value))
    .filter((value): value is SolanaOrchestratorAction => value !== null)
  return values.length > 0 ? values : ['settle_fees', 'graduation', 'price_monitor']
}

/**
 * M2-09 — local KPR cron is opt-in.
 * Canonical production plane is Vercel enqueue → Vultr sidecar POST /reconcile.
 * Set SOLANA_ORCHESTRATOR_LOCAL_CRON_ENABLED=1 only when intentionally running
 * the in-process cron path (and keep Vercel reconcile disabled).
 */
function localCronEnabled(): boolean {
  const raw = String(process.env.SOLANA_ORCHESTRATOR_LOCAL_CRON_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export async function main() {
  const workflow = process.env.KPR_WORKFLOW_NAME?.trim() || 'solana-orchestrator'

  if (!localCronEnabled()) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        workflow,
        attempts: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        checkpoints: [],
        errors: [],
        triggerPlane: 'disabled',
        reason:
          'local_cron_disabled (M2-09): set SOLANA_ORCHESTRATOR_LOCAL_CRON_ENABLED=1 only if this is the sole trigger plane',
      }),
    )
    return
  }

  const actions = parseActions(process.env.KPR_SOLANA_ORCHESTRATOR_ACTIONS)
  const checkpointSeed = Math.floor(Date.now() / 1000).toString()

  const result: SolanaOrchestratorResult = {
    workflow,
    attempts: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    checkpoints: [],
    errors: [],
    triggerPlane: 'local_cron',
  }

  for (const action of actions) {
    const checkpointKey = `${action}:slot:${checkpointSeed}`
    result.attempts += 1
    result.checkpoints.push(checkpointKey)
    try {
      const outcome = await executeSolanaOrchestratorAction({
        workflow,
        action,
        checkpointKey,
      })
      const skipped =
        outcome.result &&
        typeof outcome.result === 'object' &&
        (outcome.result as { skipped?: boolean }).skipped === true
      if (skipped) result.skipped += 1
      else result.completed += 1
    } catch (error) {
      result.failed += 1
      result.errors.push(`${action}:${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...result,
    }),
  )
}
