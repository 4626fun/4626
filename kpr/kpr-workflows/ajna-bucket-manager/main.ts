import { executeAjnaBucketManager } from '../../actions/ajna-bucket-manager.action.js'

export async function main() {
  const result = await executeAjnaBucketManager()
  console.log(
    JSON.stringify({
      workflow: 'ajna-bucket-manager',
      timestamp: new Date().toISOString(),
      totalVaults: result.totalVaults,
      totalStrategies: result.totalStrategies,
      moved: result.moved,
      skipped: result.skipped,
      errors: result.errors,
      results: result.results,
    }),
  )
}
