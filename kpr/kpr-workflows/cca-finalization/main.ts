import { executeCanonicalCcaFinalization } from '../../actions/cca-finalization-canonical.action.js'

export async function main() {
  const result = await executeCanonicalCcaFinalization()
  console.log(
    JSON.stringify({
      workflow: 'cca-finalization',
      timestamp: new Date().toISOString(),
      totalStrategies: result.totalStrategies,
      processed: result.processed,
      settled: result.settled,
      skipped: result.skipped,
      errors: result.errors,
      results: result.results,
    }),
  )
}
