/**
 * CRE Workflow: Keepr Action Queue
 *
 * Polls the Vercel API for pending keepr_actions, executes them via the
 * API, and updates their status. This is a pure HTTP workflow — no EVM
 * reads or writes.
 *
 * CRE Quota Budget (4 HTTP calls max per execution by default):
 *   1. GET  /keepr/actions/pending?limit=1         (1 call)
 *   2. POST /keepr/actions/updateStatus (claim)    (1 call)
 *   3. POST /keepr/actions/execute                 (1 call)
 *   4. POST /keepr/actions/updateStatus (finalize) (1 call)
 *   Total: 4 calls for 1 action
 *
 * To compensate for the reduced batch size (was 10, now 1), the cron
 * schedule runs every 30 seconds instead of every 5 minutes.
 */

import {
  CronCapability,
  HTTPClient,
  handler,
  Runner,
  type Runtime,
  type NodeRuntime,
  consensusIdenticalAggregation,
} from "@chainlink/cre-sdk"
import { getJson, postJson } from "../_shared/http"

// ---------------------------------------------------------------------------
// Config (loaded from config.staging.json / config.production.json)
// ---------------------------------------------------------------------------

type Config = {
  schedule: string
  apiBaseUrl: string
  maxActionsPerExecution: number
}

// ---------------------------------------------------------------------------
// Types matching the Vercel API responses
// ---------------------------------------------------------------------------

type PendingAction = {
  id: number
  vaultAddress: string
  groupId: string
  actionType: string | null
  action: Record<string, unknown>
  dedupeKey: string | null
  status: string
  attemptCount: number
  lastError: string | null
  createdAt: string
}

type PendingActionsResponse = {
  success: boolean
  data?: { actions: PendingAction[]; count: number }
  error?: string
}

type UpdateStatusResponse = {
  success: boolean
  data?: { updated: boolean }
  error?: string
}

type ExecuteResponse = {
  success: boolean
  data?: {
    executed: boolean
    retryable: boolean
    actionType: string
    error?: string
  }
  error?: string
}

// ---------------------------------------------------------------------------
// Result type returned by the workflow
// ---------------------------------------------------------------------------

type KeeprActionQueueResult = {
  processed: number
  succeeded: number
  failed: number
  retried: number
  skipped: number
}

const QUEUE_MAX_ATTEMPTS = 5
const RETRY_BASE_SECONDS = 60
const RETRY_MAX_SECONDS = 600

// FIX: H-17 (4626-309) — claim expiry + idempotency defense. The
// previous claim-then-execute split allowed a node that died between
// `updateStatus { status: "executing" }` and `/execute` to strand an
// action forever, and allowed two nodes to each believe they were the
// sole executor under a consensus re-run. We now:
//   1. Pass `expectedStatus: <row's current status>` in every claim so
//      the backend performs optimistic concurrency and rejects a second
//      claimant. The fetch endpoint returns both `pending` and `retry`
//      rows, so we echo the row's own status rather than hardcoding
//      `"pending"` — hardcoding would strand every retry row forever
//      once the backend honors expectedStatus.
//   2. Generate a deterministic `idempotencyKey` per (workflow-run,
//      action.id) and forward it to /execute. The backend keys
//      writes by idempotencyKey, so a replay — whether from CRE
//      consensus re-run or from post-restart resume — is a no-op.
//   3. Include `claimTtlSeconds` so the backend auto-releases stale
//      claims. The actual release logic lives in the API (Sprint 7,
//      L-11 / M-31 family); this payload is forward-compatible.
const CLAIM_TTL_SECONDS = 300

function buildIdempotencyKey(
  nodeRuntime: NodeRuntime<Config>,
  action: PendingAction,
): string {
  // Deterministic within a workflow-run + action.id so consensus
  // re-runs produce the same key. The node-runtime's id() is derived
  // from the cron trigger timestamp + workflow hash and is stable
  // across the whole quorum for a single trigger.
  const triggerId = (nodeRuntime as unknown as { id?: () => string }).id?.() ?? ""
  return `keepr:${action.id}:${triggerId || action.attemptCount}`
}

function fetchPendingActions(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
): KeeprActionQueueResult {
  const limit = nodeRuntime.config.maxActionsPerExecution

  // --- Call 1: Fetch pending actions ---
  const pendingBody = getJson<Config, PendingActionsResponse>(
    nodeRuntime,
    httpClient,
    apiKey,
    `/keepr/actions/pending?limit=${limit}`,
  )

  if (!pendingBody.success || !pendingBody.data) {
    return { processed: 0, succeeded: 0, failed: 0, retried: 0, skipped: 0 }
  }

  const actions = pendingBody.data.actions
  if (actions.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, retried: 0, skipped: 0 }
  }

  const result: KeeprActionQueueResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
  }

  // Process up to maxActionsPerExecution actions
  // Each action uses 3 HTTP calls (claim + execute + finalize).
  for (const action of actions) {
    result.processed++

    // FIX: H-17 (4626-309) — deterministic idempotency key used for
    // both the claim and the execute request so a consensus re-run or
    // post-restart resume collapses to a no-op at the backend.
    const idempotencyKey = buildIdempotencyKey(nodeRuntime, action)

    // --- Call 2/4: Claim the action (optimistic concurrency) ---
    // FIX: H-17 — expectedStatus echoes the row's own current status.
    // The fetch endpoint returns rows in both `pending` and `retry`
    // states; both must be claimable or transient failures never
    // recover. Hardcoding `"pending"` here would make every retry row
    // permanently un-claimable once the backend honors expectedStatus.
    // The optimistic-concurrency property still holds: two nodes
    // observing the same row with status=S can still only have one
    // winner (the first successful `S -> executing` transition).
    const expectedStatus = action.status
    if (expectedStatus !== "pending" && expectedStatus !== "retry") {
      // Row arrived in an unexpected state — skip it and let the
      // backend surface it through the normal pending feed.
      result.skipped++
      continue
    }

    const claimBody = postJson<Config, UpdateStatusResponse>(
      nodeRuntime,
      httpClient,
      apiKey,
      "/keepr/actions/updateStatus",
      {
        id: action.id,
        status: "executing",
        // FIX: H-17 — reject the claim if another node has already
        // moved the row off its current status. Backend responds
        // updated=false without side-effects in that case.
        expectedStatus,
        // FIX: H-17 — let the backend auto-release a claim that
        // never finishes (node crash between claim and execute).
        claimTtlSeconds: CLAIM_TTL_SECONDS,
        idempotencyKey,
      },
    )

    if (!claimBody.success || !claimBody.data?.updated) {
      // Another worker claimed it, or the row is no longer pending.
      result.skipped++
      continue
    }

    // --- Call 3/5: Execute the action ---
    const execBody = postJson<Config, ExecuteResponse>(
      nodeRuntime,
      httpClient,
      apiKey,
      "/keepr/actions/execute",
      {
        id: action.id,
        vaultAddress: action.vaultAddress,
        groupId: action.groupId,
        actionType: action.actionType,
        action: action.action,
        // FIX: H-17 — idempotency key lets the backend dedupe a
        // second execute call from the same workflow-run that got
        // re-attempted because of transport retries or a partial
        // consensus failure.
        idempotencyKey,
      },
    )

    if (execBody.success && execBody.data?.executed) {
      const doneBody = postJson<Config, UpdateStatusResponse>(
        nodeRuntime,
        httpClient,
        apiKey,
        "/keepr/actions/updateStatus",
        {
          id: action.id,
          status: "executed",
          // FIX: H-17 — finalize-with-idempotency completes the chain
          // so a duplicate workflow-run cannot flip a completed row
          // back to executing.
          expectedStatus: "executing",
          idempotencyKey,
        },
      )
      if (doneBody.success && doneBody.data?.updated) {
        result.succeeded++
      } else {
        result.failed++
      }
      continue
    }

    const retryable = execBody.data?.retryable ?? false
    const shouldRetry = retryable && action.attemptCount < (QUEUE_MAX_ATTEMPTS - 1)
    if (shouldRetry) {
      const retryDelaySeconds = Math.min(
        RETRY_MAX_SECONDS,
        RETRY_BASE_SECONDS * Math.pow(2, Math.max(0, action.attemptCount)),
      )
      const retryBody = postJson<Config, UpdateStatusResponse>(
        nodeRuntime,
        httpClient,
        apiKey,
        "/keepr/actions/updateStatus",
        {
          id: action.id,
          status: "retry",
          error: execBody.data?.error ?? execBody.error ?? "execution_failed",
          retryDelaySeconds,
          expectedStatus: "executing",
          idempotencyKey,
        },
      )
      if (retryBody.success && retryBody.data?.updated) {
        result.retried++
      } else {
        result.failed++
      }
    } else {
      const failBody = postJson<Config, UpdateStatusResponse>(
        nodeRuntime,
        httpClient,
        apiKey,
        "/keepr/actions/updateStatus",
        {
          id: action.id,
          status: "failed",
          error: execBody.data?.error ?? execBody.error ?? "execution_failed",
          expectedStatus: "executing",
          idempotencyKey,
        },
      )
      if (failBody.success && failBody.data?.updated) {
        result.failed++
      } else {
        result.skipped++
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// CRE Callback — triggered by cron
// ---------------------------------------------------------------------------

const onCronTrigger = (runtime: Runtime<Config>): KeeprActionQueueResult => {
  // Retrieve the API key from CRE secrets
  const apiKeySecret = runtime.getSecret({ id: "KEEPR_API_KEY" }).result()
  const apiKey = apiKeySecret.value

  runtime.log("Keepr action queue starting")

  // Run HTTP calls in node mode with identical aggregation
  // (all nodes should see the same API responses)
  const httpClient = new HTTPClient()
  const result = runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime<Config>) =>
      fetchPendingActions(nodeRuntime, httpClient, apiKey),
    consensusIdenticalAggregation(),
  )().result()

  runtime.log(
    `Keepr action queue complete: processed=${result.processed} succeeded=${result.succeeded} failed=${result.failed} retried=${result.retried} skipped=${result.skipped}`,
  )

  return result
}

// ---------------------------------------------------------------------------
// Workflow definition
// ---------------------------------------------------------------------------

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
