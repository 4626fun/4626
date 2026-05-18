/**
 * Ported KPR workflow entrypoint (legacy SDK removed).
 *
 * This keeps the `kpr/kpr-workflows` command surface alive while delegating
 * execution to the custom KPR action implementation.
 */

import { executeKeeprActionQueue } from '../../actions/keepr-action-queue.action.js'

export async function main() {
  const result = await executeKeeprActionQueue()
  console.log(
    JSON.stringify({
      workflow: 'keepr-action-queue',
      timestamp: new Date().toISOString(),
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      retried: result.retried,
      actions: result.actions,
    }),
  )
}
