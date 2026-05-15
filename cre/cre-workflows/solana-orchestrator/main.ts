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
import { assertManualTriggerHmac } from "../_shared/manualTriggerAuth"

type Config = {
  schedule: string
  apiBaseUrl: string
  workflowName: string
  actions: string[]
  checkpointIntervalSeconds: number
  // Allowlist of authAdmin addresses permitted to appear in manual.payload.
  // Empty list = no authAdmin-bearing payloads are accepted. See audit finding M-17 (4626-326).
  authAdminRegistry: string[]
}

type ManualPayload = {
  action?: string
  actions?: string[]
  workflowName?: string
  checkpointKey?: string
  authToken?: string
  // H-01 (audit 2026-04-25): callers must include `timestamp` (epoch ms) and
  // `nonce` (>=16 hex chars) so the webhook signature can be rebuilt as
  // hmac-sha256(secret, `${timestamp}.${nonce}.${stableJson(rest)}`).
  timestamp?: number | string
  nonce?: string
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
  const raw = Buffer.from(payload.input).toString("utf-8").trim()
  try {
    return JSON.parse(raw) as ManualPayload
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as ManualPayload
    } catch {
      throw new Error("invalid_manual_payload")
    }
  }
}

function currentCheckpoint(now: Date, intervalSeconds: number): string {
  const slot = Math.floor(now.getTime() / 1000 / Math.max(1, intervalSeconds))
  return `slot:${slot}`
}

function normalizeActionName(action: string): string {
  return action.trim().toLowerCase()
}

function normalizeAddress(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  return trimmed.toLowerCase()
}

// M-17 (4626-326): validate that any authAdmin embedded in a manual payload is
// in the workflow's configured registry of authorized admins. Without this
// check, an attacker with a leaked manual auth token could pass an arbitrary
// authAdmin/smartWallet pair through to /keeper/solana/reconcile. The
// registry is intentionally required on Config (may be empty) so that an
// unset registry is a loud deployment bug rather than a silent allow-all.
function validatePayloadAuthAdmin(
  config: Config,
  payload: Record<string, unknown>,
): void {
  const rawAuthAdmin = payload["authAdmin"]
  const rawSmartWallet = payload["smartWallet"]
  const hasAuthAdmin = rawAuthAdmin !== undefined && rawAuthAdmin !== null
  const hasSmartWallet = rawSmartWallet !== undefined && rawSmartWallet !== null
  if (!hasAuthAdmin && !hasSmartWallet) return

  const authAdmin = normalizeAddress(rawAuthAdmin)
  const smartWallet = normalizeAddress(rawSmartWallet)

  if (!authAdmin) {
    throw new Error("authAdmin_missing_or_invalid")
  }
  if (!smartWallet) {
    throw new Error("smartWallet_required_with_authAdmin")
  }

  const registry = (config.authAdminRegistry ?? []).map((entry) => entry.trim().toLowerCase())
  if (registry.length === 0 || !registry.includes(authAdmin)) {
    throw new Error("authAdmin_not_in_registry")
  }
}

function normalizeActionList(config: Config, manual?: ManualPayload): string[] {
  const fromArray =
    manual?.actions?.filter((value): value is string => typeof value === "string" && value.trim().length > 0) ??
    []
  if (fromArray.length > 0) return fromArray.map(normalizeActionName)
  if (manual?.action && manual.action.trim().length > 0) return [normalizeActionName(manual.action)]
  return config.actions.map(normalizeActionName)
}

function runReconciliation(runtime: Runtime<Config>, manual?: ManualPayload): SolanaOrchestratorResult {
  const apiKey = runtime.getSecret({ id: "KPR_API_KEY" }).result().value
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

  const payload = manual?.payload ?? {}
  // M-17 (4626-326): enforce authAdmin registry before dispatching any action.
  validatePayloadAuthAdmin(runtime.config, payload)

  for (const action of actions) {
    const checkpointKey = `${action}:${checkpointSuffix}`
    result.attempts += 1
    result.checkpoints.push(checkpointKey)

    const response = runtime.runInNodeMode(
      (nr: NodeRuntime<Config>) =>
        postJson<Config, ReconcileResponse>(
          nr,
          httpClient,
          apiKey,
          "/keeper/solana/reconcile",
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

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): SolanaOrchestratorResult => {
  const manual = parseManualPayload(payload)
  // H-01 (audit 2026-04-25): manual triggers now require an HMAC envelope.
  // The signing key is the workflow-specific HMAC secret, not KPR_API_KEY.
  // See cre/cre-workflows/_shared/manualTriggerAuth.ts for the wire format.
  const hmacSecret = runtime.getSecret({ id: "CRE_RUNTIME_WEBHOOK_HMAC_SECRET" }).result().value
  assertManualTriggerHmac(manual, hmacSecret)
  return runReconciliation(runtime, manual)
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
