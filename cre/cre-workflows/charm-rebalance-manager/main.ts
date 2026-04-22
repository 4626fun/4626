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

type Config = CharmManagerConfig & {
  schedule: string
}

const onCronTrigger = (runtime: Runtime<Config>): CharmWorkflowResult =>
  evaluateAndEnqueueCharmActions(runtime)

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): CharmWorkflowResult => {
  const manual = parseCharmManualPayload(payload.input)
  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  if (!manual.authToken || manual.authToken !== apiKey) {
    throw new Error("unauthorized_manual_trigger")
  }
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
