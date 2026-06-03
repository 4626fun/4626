import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  requireBearerEnvAuth,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { PrepareRequestSchema, type PrepareRequest } from '../../../server/_lib/agents/base-mcp/schemas.js'
import {
  createDefaultBaseMcpPolicyConfig,
  evaluateSwapPolicy,
  evaluateTransferPolicy,
  type PolicyDecision,
} from '../../../server/_lib/agents/base-mcp/policy.js'
import { resolveExecutionRoute, type ExecutionMode } from '../../../server/_lib/agents/base-mcp/executionRoute.js'
import { baseMcpApprovalStore } from '../../../server/_lib/agents/base-mcp/store.js'
import { loadBaseMcpRuntimeConfig } from '../../../server/_lib/agents/base-mcp/config.js'
import { resolveBaseMcpAccountExecutionContext } from '../../../server/_lib/agents/base-mcp/accountResolver.js'

const MAX_BODY_BYTES = 16_384

interface PrepareResponseOk {
  status: 'ok'
  executionMode: ExecutionMode
  sender: string
  approval: {
    requestId: string
    approvalUrl: string
    expiresAt: string
  }
}

interface PrepareResponseBlocked {
  status: 'blocked'
  reasonCode: string
  message: string
}

function toBlocked(decision: Extract<PolicyDecision, { status: 'blocked' }>): PrepareResponseBlocked {
  return {
    status: 'blocked',
    reasonCode: decision.reasonCode,
    message: decision.message,
  }
}

function resolveRouteContext(requestedMode: ExecutionMode, canonicalSender: string | null, eoaSender: string | null) {
  const canonicalReady = Boolean(canonicalSender)
  const eoaReady = Boolean(eoaSender)
  return resolveExecutionRoute({ requestedMode, canonicalReady, eoaReady, canonicalSender, eoaSender })
}

function evaluatePolicy(payload: PrepareRequest, config: ReturnType<typeof createDefaultBaseMcpPolicyConfig>): PolicyDecision {
  if (payload.action === 'prepareSwap') {
    return evaluateSwapPolicy(
      {
        chainId: payload.chainId,
        sellToken: payload.sellToken,
        buyToken: payload.buyToken,
        sellAmount: BigInt(payload.sellAmount),
        maxSlippageBps: payload.maxSlippageBps,
      },
      config,
    )
  }

  return evaluateTransferPolicy(
    {
      chainId: payload.chainId,
      token: payload.token,
      amount: BigInt(payload.amount),
      recipient: payload.recipient,
    },
    config,
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<unknown>(req, { maxBytes: MAX_BODY_BYTES })
  const parsed = PrepareRequestSchema.safeParse(body)

  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid Base MCP prepare payload' } satisfies ApiEnvelope<never>)
  }

  const payload = parsed.data
  const runtimeConfig = loadBaseMcpRuntimeConfig()
  if (!runtimeConfig.enabled) {
    return res.status(503).json({ success: false, error: 'Base MCP is disabled' } satisfies ApiEnvelope<never>)
  }

  if (
    !requireBearerEnvAuth(req, res, {
      envKey: 'BASE_MCP_AGENT_SECRET',
      missingSecretError: 'Base MCP agent auth is not configured',
      unauthorizedError: 'Base MCP agent auth required',
    })
  ) {
    return
  }

  const policyConfig = createDefaultBaseMcpPolicyConfig()
  policyConfig.allowedTokens = runtimeConfig.allowedTokens
  for (const [token, limit] of runtimeConfig.tokenNotionalLimitsBaseUnits) {
    policyConfig.tokenNotionalLimitsBaseUnits.set(token, limit)
  }
  policyConfig.allowedChainIds = runtimeConfig.allowedChainIds
  const policyDecision = evaluatePolicy(payload, policyConfig)

  if (policyDecision.status === 'blocked') {
    return res.status(200).json({ success: true, data: toBlocked(policyDecision) } satisfies ApiEnvelope<PrepareResponseBlocked>)
  }

  const requestedMode = payload.requestedMode ?? 'canonical'
  const accountContext = await resolveBaseMcpAccountExecutionContext(payload.userId)
  const route = accountContext
    ? resolveRouteContext(requestedMode, accountContext.canonicalSender, accountContext.eoaSender)
    : {
        status: 'blocked' as const,
        reasonCode: 'not_execution_ready' as const,
        message: 'No execution-ready Base MCP account was found for the requested user.',
      }

  if (route.status === 'blocked') {
    return res.status(200).json({ success: true, data: route } satisfies ApiEnvelope<PrepareResponseBlocked>)
  }

  const ttlSeconds = payload.action === 'prepareSwap' ? payload.quoteTtlSeconds : 300
  let requestRecord: Awaited<ReturnType<typeof baseMcpApprovalStore.create>>
  try {
    requestRecord = await baseMcpApprovalStore.create({
      clientRequestId: payload.clientRequestId,
      ttlSeconds,
      userId: payload.userId,
      executionMode: route.executionMode,
      sender: route.sender,
    })
  } catch {
    return res.status(503).json({ success: false, error: 'Base MCP approval store is unavailable' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      executionMode: route.executionMode,
      sender: route.sender,
      approval: {
        requestId: requestRecord.requestId,
        approvalUrl: requestRecord.approvalUrl,
        expiresAt: requestRecord.expiresAt,
      },
    },
  } satisfies ApiEnvelope<PrepareResponseOk>)
}
