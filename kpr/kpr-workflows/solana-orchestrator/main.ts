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
  checkpoints: string[]
  errors: string[]
}

function parseActions(raw: string | undefined): SolanaOrchestratorAction[] {
  const values = (raw ?? '')
    .split(',')
    .map((value) => normalizeSolanaOrchestratorAction(value))
    .filter((value): value is SolanaOrchestratorAction => value !== null)
  return values.length > 0 ? values : ['relay_entries', 'settle_fees', 'winner_relay']
}

export async function main() {
  const workflow = process.env.KPR_WORKFLOW_NAME?.trim() || 'solana-orchestrator'
  const actions = parseActions(process.env.KPR_SOLANA_ORCHESTRATOR_ACTIONS)
  const checkpointSeed = Math.floor(Date.now() / 1000).toString()

  const result: SolanaOrchestratorResult = {
    workflow,
    attempts: 0,
    completed: 0,
    failed: 0,
    checkpoints: [],
    errors: [],
  }

  for (const action of actions) {
    const checkpointKey = `${action}:slot:${checkpointSeed}`
    result.attempts += 1
    result.checkpoints.push(checkpointKey)
    try {
      await executeSolanaOrchestratorAction({
        workflow,
        action,
        checkpointKey,
      })
      result.completed += 1
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
