import {
  CronCapability,
  HTTPCapability,
  type HTTPPayload,
  handler,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk"
import {
  type CharmManagerConfig,
  type CharmWorkflowResult,
  evaluateAndEnqueueCharmActions,
  parseCharmManualPayload,
} from "../_shared/charmManager"
import { assertManualTriggerAuthorized } from "../_shared/manualTriggerAuth"

type Config = CharmManagerConfig & {
  schedule: string
}

const onCronTrigger = (runtime: Runtime<Config>): CharmWorkflowResult =>
  evaluateAndEnqueueCharmActions(runtime)

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): CharmWorkflowResult => {
  const manual = parseCharmManualPayload(payload.input)
  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  // SEV-001 regression guard — see cre/cre-workflows/_shared/manualTriggerAuth.ts
  // and the matching unit test in cre/tests/charm-rebalance-manager.test.ts.
  assertManualTriggerAuthorized(manual.authToken, apiKey)
  return evaluateAndEnqueueCharmActions(runtime, manual)
}

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  const httpTrigger = new HTTPCapability()
  return [
    handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
    handler(httpTrigger.trigger({}), onHttpTrigger),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
