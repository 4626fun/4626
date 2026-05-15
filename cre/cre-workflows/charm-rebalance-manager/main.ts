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
import { assertManualTriggerHmac } from "../_shared/manualTriggerAuth"

type Config = CharmManagerConfig & {
  schedule: string
}

const onCronTrigger = (runtime: Runtime<Config>): CharmWorkflowResult =>
  evaluateAndEnqueueCharmActions(runtime)

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): CharmWorkflowResult => {
  const manual = parseCharmManualPayload(payload.input)
  // H-01 (audit 2026-04-25): manual triggers now require an HMAC envelope.
  // The signing key is the workflow-specific HMAC secret, not KPR_API_KEY.
  const hmacSecret = runtime.getSecret({ id: "CRE_RUNTIME_WEBHOOK_HMAC_SECRET" }).result().value
  // SEV-001 regression guard — see cre/cre-workflows/_shared/manualTriggerAuth.ts
  // and the matching unit test in cre/tests/charm-rebalance-manager.test.ts.
  assertManualTriggerHmac(manual, hmacSecret)
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
