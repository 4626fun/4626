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
  // FIX: M-15 (4626-324) — explicit allowlist of topic0 hashes the
  // log trigger is permitted to act on. Any log with a topic0 not in
  // this set is dropped without triggering reconciliation. See
  // config.production.json for the canonical list
  // (keccak256 of each emitting contract's event signatures).
  expectedEventSignatures?: `0x${string}`[]
}

type StrategySignalResult = {
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
  } satisfies StrategySignalResult
}

const onCronTrigger = (runtime: Runtime<Config>): StrategySignalResult => {
  runtime.log("Strategy signal listener cron backfill running")
  return runReconciliation(runtime, "cron")
}

const EMPTY_RESULT: StrategySignalResult = {
  trigger: "log",
  ajnaEnqueuedActions: 0,
  charmEnqueuedActions: 0,
  errors: [],
}

function topic0Hex(log: EVMLog): string | undefined {
  // EVM logs always place the event signature hash at topics[0]
  // (when the event is non-anonymous). Absent/empty topics means the
  // log is anonymous or malformed; reject in either case.
  const topics = (log as unknown as { topics?: Uint8Array[] }).topics
  if (!topics || topics.length === 0) return undefined
  const t0 = topics[0]
  if (!t0 || t0.length !== 32) return undefined
  return `0x${Buffer.from(t0).toString("hex")}`
}

const onLogTrigger = (runtime: Runtime<Config>, log: EVMLog): StrategySignalResult => {
  const pool = log.address ? `0x${Buffer.from(log.address).toString("hex")}` : undefined

  // FIX: M-15 (4626-324) — reject any log whose topic0 is not in the
  // configured expectedEventSignatures allowlist. Previously, any
  // contract that emitted a log from a watched pool address could
  // trigger strategy reconciliation with arbitrary data; we now
  // require an exact match of the keccak256(event signature) hash.
  const config = (runtime as unknown as { config: Config }).config
  const allowed = (config.expectedEventSignatures ?? []).map((h) => h.toLowerCase())
  if (allowed.length > 0) {
    const t0 = topic0Hex(log)?.toLowerCase()
    if (!t0 || !allowed.includes(t0)) {
      runtime.log(
        `Strategy signal listener: dropped log from ${pool ?? "unknown"} with topic0=${t0 ?? "<missing>"} (not in expectedEventSignatures)`,
      )
      return { ...EMPTY_RESULT, ...(pool ? { observedPool: pool } : {}) }
    }
  } else {
    // Safety — if the config forgot to specify an allowlist, emit a
    // loud log and still drop the event rather than process it
    // unchecked. Operators must populate expectedEventSignatures.
    runtime.log(
      "Strategy signal listener: expectedEventSignatures is empty; refusing to process log trigger. Populate the config allowlist.",
    )
    return { ...EMPTY_RESULT, ...(pool ? { observedPool: pool } : {}) }
  }

  runtime.log(`Strategy signal listener log trigger fired${pool ? ` for ${pool}` : ""}`)
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
