import { executeCharmRebalanceManager } from '../../actions/charm-rebalance-manager.action.js'

export async function main() {
  const result = await executeCharmRebalanceManager()
  console.log(
    JSON.stringify({
      workflow: 'charm-rebalance-manager',
      timestamp: new Date().toISOString(),
      totalVaults: result.totalVaults,
      totalStrategies: result.totalStrategies,
      rebalanced: result.rebalanced,
      skipped: result.skipped,
      errors: result.errors,
      results: result.results,
    }),
  )
}
