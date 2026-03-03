import {
  CronCapability,
  HTTPCapability,
  type HTTPPayload,
  handler,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk"
import {
  type AjnaManagerConfig,
  type AjnaWorkflowResult,
  evaluateAndEnqueueAjnaActions,
  parseAjnaManualPayload,
} from "../_shared/ajnaManager"

type Config = AjnaManagerConfig & {
  schedule: string
}

const onCronTrigger = (runtime: Runtime<Config>): AjnaWorkflowResult =>
  evaluateAndEnqueueAjnaActions(runtime)

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): AjnaWorkflowResult =>
  evaluateAndEnqueueAjnaActions(runtime, parseAjnaManualPayload(payload.input))

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
