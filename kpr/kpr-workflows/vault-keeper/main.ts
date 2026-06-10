/**
 * Ported KPR workflow entrypoint.
 *
 * This keeps the `kpr/kpr-workflows` command surface alive while delegating
 * execution to the custom KPR action implementation.
 */

import { executeKeeper } from '../../actions/vault-keeper.action.js'

export async function main() {
  const result = await executeKeeper()
  console.log(
    JSON.stringify({
      workflow: 'vault-keeper',
      timestamp: new Date().toISOString(),
      totalVaults: result.totalVaults,
      processed: result.processed,
      tended: result.tended,
      reported: result.reported,
      skipped: result.skipped,
      errors: result.errors,
      results: result.results,
    }),
  )
}
