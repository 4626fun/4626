import { startStrategySignalListener } from '../../actions/strategy-signal-listener.action.js'

export async function main() {
  await startStrategySignalListener()
}
