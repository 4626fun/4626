import {
  CronCapability,
  EVMClient,
  handler,
  Runner,
  type EVMLog,
  type Runtime,
  hexToBase64,
} from "@chainlink/cre-sdk"
import {
  type AjnaManagerConfig,
  evaluateAndEnqueueAjnaActions,
} from "../_shared/ajnaManager"
import {
  type CharmManagerConfig,
  evaluateAndEnqueueCharmActions,
} from "../_shared/charmManager"

type Config = AjnaManagerConfig & CharmManagerConfig & {
  schedule: string
  watchedPoolAddresses: `0x${string}`[]
}

type StrategyEventResult = {
  trigger: "cron" | "log"
  observedPool?: string
  ajnaEnqueuedActions: number
  charmEnqueuedActions: number
  errors: string[]
}

function runReconciliation(runtime: Runtime<Config>, trigger: "cron" | "log", observedPool?: string) {
  const ajna = evaluateAndEnqueueAjnaActions(runtime as unknown as Runtime<AjnaManagerConfig>)
  const charm = evaluateAndEnqueueCharmActions(runtime as unknown as Runtime<CharmManagerConfig>)

  return {
    trigger,
    ...(observedPool ? { observedPool } : {}),
    ajnaEnqueuedActions: ajna.enqueuedActions,
    charmEnqueuedActions: charm.enqueuedActions,
    errors: [...ajna.errors, ...charm.errors],
  } satisfies StrategyEventResult
}

const onCronTrigger = (runtime: Runtime<Config>): StrategyEventResult => {
  runtime.log("Strategy event listener cron backfill running")
  return runReconciliation(runtime, "cron")
}

const onLogTrigger = (runtime: Runtime<Config>, log: EVMLog): StrategyEventResult => {
  const pool = log.address ? `0x${Buffer.from(log.address).toString("hex")}` : undefined
  runtime.log(`Strategy event listener log trigger fired${pool ? ` for ${pool}` : ""}`)
  return runReconciliation(runtime, "log", pool)
}

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  const evmClient = new EVMClient(
    EVMClient.SUPPORTED_CHAIN_SELECTORS[
      config.chainName as keyof typeof EVMClient.SUPPORTED_CHAIN_SELECTORS
    ],
  )

  const cronHandler = handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)
  const addresses = config.watchedPoolAddresses.map((address) => hexToBase64(address))
  const logHandler = handler(evmClient.logTrigger({ addresses }), onLogTrigger)
  return [cronHandler, logHandler]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
