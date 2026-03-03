import {
  CronCapability,
  HTTPCapability,
  HTTPClient,
  type HTTPPayload,
  handler,
  Runner,
  type Runtime,
  type NodeRuntime,
  consensusIdenticalAggregation,
} from "@chainlink/cre-sdk"
import { postJson } from "../_shared/http"

type Config = {
  schedule: string
  apiBaseUrl: string
  workflowName: string
  actions: string[]
  checkpointIntervalSeconds: number
}

type ManualPayload = {
  action?: string
  actions?: string[]
  workflowName?: string
  checkpointKey?: string
  payload?: Record<string, unknown>
}

type ReconcileResponse = {
  success: boolean
  data?: {
    workflow: string
    action: string
    checkpointKey: string
    status?: "already_processed" | "completed" | "failed" | "skipped_unconfigured"
    executed: boolean
    upstreamStatusCode?: number
    ok?: boolean
  }
  error?: string
}

type SolanaOrchestratorResult = {
  workflow: string
  attempts: number
  completed: number
  alreadyProcessed: number
  failed: number
  skippedUnconfigured: number
  checkpoints: string[]
  errors: string[]
  metrics: {
    retryCount: number
    requestFailures: number
    bridgeStatusByAction: Record<
      string,
      "completed" | "already_processed" | "skipped_unconfigured" | "failed" | "request_failed"
    >
  }
}

function parseManualPayload(payload: HTTPPayload): ManualPayload {
  if (!payload.input || payload.input.length === 0) return {}
  try {
    return JSON.parse(Buffer.from(payload.input).toString("utf-8")) as ManualPayload
  } catch {
    throw new Error("invalid_manual_payload")
  }
}

function currentCheckpoint(now: Date, intervalSeconds: number): string {
  const slot = Math.floor(now.getTime() / 1000 / Math.max(1, intervalSeconds))
  return `slot:${slot}`
}

function normalizeActionList(config: Config, manual?: ManualPayload): string[] {
  const fromArray =
    manual?.actions?.filter((value): value is string => typeof value === "string" && value.trim().length > 0) ??
    []
  if (fromArray.length > 0) return fromArray
  if (manual?.action && manual.action.trim().length > 0) return [manual.action.trim()]
  return config.actions
}

function runReconciliation(runtime: Runtime<Config>, manual?: ManualPayload): SolanaOrchestratorResult {
  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  const httpClient = new HTTPClient()
  const workflowName = manual?.workflowName?.trim() || runtime.config.workflowName
  const actions = normalizeActionList(runtime.config, manual)
  const checkpointSuffix =
    manual?.checkpointKey?.trim() ||
    currentCheckpoint(runtime.now(), runtime.config.checkpointIntervalSeconds)

  const result: SolanaOrchestratorResult = {
    workflow: workflowName,
    attempts: 0,
    completed: 0,
    alreadyProcessed: 0,
    failed: 0,
    skippedUnconfigured: 0,
    checkpoints: [],
    errors: [],
    metrics: {
      retryCount: 0,
      requestFailures: 0,
      bridgeStatusByAction: {},
    },
  }

  for (const action of actions) {
    const checkpointKey = `${action}:${checkpointSuffix}`
    const payload = manual?.payload ?? {}
    result.attempts += 1
    result.checkpoints.push(checkpointKey)

    const response = runtime.runInNodeMode(
      (nr: NodeRuntime<Config>) =>
        postJson<Config, ReconcileResponse>(
          nr,
          httpClient,
          apiKey,
          "/cre/keeper/solana/reconcile",
          {
            workflow: workflowName,
            action,
            checkpointKey,
            payload,
          },
        ),
      consensusIdenticalAggregation(),
    )().result()

    if (!response.success || !response.data) {
      result.failed += 1
      result.metrics.requestFailures += 1
      result.metrics.bridgeStatusByAction[action] = "request_failed"
      result.errors.push(
        `${action}:request_failed:${response.error ?? "unknown_error"}`,
      )
      continue
    }

    // Backward-compatible normalization for older bridge fixtures
    const normalizedStatus =
      response.data.status ??
      (response.data.ok === true ? "completed" : response.data.ok === false ? "failed" : undefined)
    if (!normalizedStatus) {
      result.failed += 1
      result.metrics.requestFailures += 1
      result.metrics.bridgeStatusByAction[action] = "request_failed"
      result.errors.push(`${action}:request_failed:missing_status`)
      continue
    }

    if (normalizedStatus === "completed") {
      result.completed += 1
      result.metrics.bridgeStatusByAction[action] = "completed"
      continue
    }
    if (normalizedStatus === "already_processed") {
      result.alreadyProcessed += 1
      result.metrics.bridgeStatusByAction[action] = "already_processed"
      continue
    }
    if (normalizedStatus === "skipped_unconfigured") {
      result.skippedUnconfigured += 1
      result.metrics.bridgeStatusByAction[action] = "skipped_unconfigured"
      continue
    }

    result.failed += 1
    result.metrics.bridgeStatusByAction[action] = "failed"
    result.errors.push(`${action}:status:${normalizedStatus}`)
  }

  return result
}

const onCronTrigger = (runtime: Runtime<Config>): SolanaOrchestratorResult => runReconciliation(runtime)

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): SolanaOrchestratorResult =>
  runReconciliation(runtime, parseManualPayload(payload))

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
