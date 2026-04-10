import type { VercelRequest, VercelResponse } from "@vercel/node"

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  logger,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from "../../../../packages/server-core/src/index.js"

import {
  authenticateRuntimeRequest,
  listRuntimeRecords,
  storeRuntimeRecord,
} from "../../../../server/_lib/cre/runtimeBridge.js"

import { normalizeRuntimeRecordForWorkspace } from "../../../../server/_lib/workspace/normalizer.js"

type IngestBody = {
  workflow?: string
  kind?: string
  idempotencyKey?: string
  payload?: unknown
  source?: string
}

type IngestPostResponse = {
  stored: boolean
  inserted: boolean
  idempotencyKey: string
}

type IngestGetResponse = {
  records: unknown[]
  count: number
}

const ALLOWED_INGEST_PAIRS = new Set<string>([
  "runtime-indexer-block:block",
  "runtime-indexer-data-fetch:metrics",
  "runtime-reference-feeds:feeds",
])

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey("cre-runtime-ingest", req.method.toLowerCase(), getClientIp(req)),
    req.method === "GET" ? RATE_LIMITS.creRuntimeIngestRead : RATE_LIMITS.creRuntimeIngestWrite,
  )
  if (!limiter.allowed) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({
      success: false,
      error: "Too many requests",
    } satisfies ApiEnvelope<never>)
  }

  const body: Partial<IngestBody> = req.method === "POST"
    ? ((await readBoundedJsonObjectBody<IngestBody>(req, { maxBytes: 131_072 })) ?? {})
    : {}
  const enforceHmac = (process.env.CRE_RUNTIME_ENFORCE_HMAC ?? "false").toLowerCase() === "true"
  const auth = await authenticateRuntimeRequest(req, body, {
    allowUnsignedWhenHmacConfigured: req.method === "GET" || !enforceHmac,
  })
  if (!auth.ok) {
    return res.status(auth.status).json({
      success: false,
      error: auth.error,
    } satisfies ApiEnvelope<never>)
  }

  try {
    if (req.method === "GET") {
      const kind = nonEmptyString(req.query.kind)
      const workflow = nonEmptyString(req.query.workflow)
      const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : NaN
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20
      const records = await listRuntimeRecords({
        kind: kind ?? undefined,
        workflow: workflow ?? undefined,
        limit,
      })
      return res.status(200).json({
        success: true,
        data: { records, count: records.length },
      } satisfies ApiEnvelope<IngestGetResponse>)
    }

    const workflow = nonEmptyString(body.workflow)
    const kind = nonEmptyString(body.kind)
    const idempotencyKey = nonEmptyString(body.idempotencyKey)
    if (!workflow || !kind || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: "workflow, kind, and idempotencyKey are required",
      } satisfies ApiEnvelope<never>)
    }

    if (!ALLOWED_INGEST_PAIRS.has(`${workflow}:${kind}`)) {
      return res.status(400).json({
        success: false,
        error: "workflow/kind combination is not allowed",
      } satisfies ApiEnvelope<never>)
    }

    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : null
    if (!payload) {
      return res.status(400).json({
        success: false,
        error: "payload must be an object",
      } satisfies ApiEnvelope<never>)
    }

    const stored = await storeRuntimeRecord({
      workflow,
      kind,
      idempotencyKey,
      payload,
      source: nonEmptyString(body.source) ?? "cre",
      correlationId: auth.correlationId,
    })

    if (stored.inserted) {
      await normalizeRuntimeRecordForWorkspace({
        record: stored.record,
      }).catch((error) => {
        logger.warn("Workspace runtime record normalization failed", {
          workflow,
          kind,
          idempotencyKey,
          correlationId: auth.correlationId,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }

    logger.info("CRE ingest stored", {
      workflow,
      kind,
      idempotencyKey,
      inserted: stored.inserted,
      correlationId: auth.correlationId,
    })

    return res.status(200).json({
      success: true,
      data: {
        stored: true,
        inserted: stored.inserted,
        idempotencyKey,
      },
    } satisfies ApiEnvelope<IngestPostResponse>)
  } catch (error) {
    logger.error("CRE ingest error", { error, correlationId: auth.correlationId })
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    } satisfies ApiEnvelope<never>)
  }
}
