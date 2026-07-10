/**
 * Pure helpers for the LLM-driven ACP job loop.
 *
 * The acp-node-v2 `JobSession` exposes role/status-scoped tools
 * (`availableTools()`), conversation history (`toMessages()`), and a
 * dispatcher (`executeTool(name, args)`). Our Eliza LLM service returns plain
 * text (no native tool calling), so the loop asks the model for a strict JSON
 * decision and parses it here.
 */
import {
  VIRTUALS_HIGH_RISK_TOOLS,
  type VirtualsHighRiskTool,
} from './config.js'

export type AcpToolLike = {
  name: string
  description: string
  parameters: Array<{ name: string; type: string; description?: string; required?: boolean }>
}

export type ToolDecision =
  | { kind: 'tool'; name: string; args: Record<string, unknown> }
  | { kind: 'none' }

/** Tools that move USDC and therefore get validated / capped. */
const SPEND_TOOL_NAMES = new Set(['setBudget', 'fund'])
const HIGH_RISK_TOOL_NAMES = new Set<string>(VIRTUALS_HIGH_RISK_TOOLS)
const DEFAULT_EXECUTABLE_TOOL_NAMES = new Set(['wait', 'sendMessage'])

export function isSpendTool(name: string): boolean {
  return SPEND_TOOL_NAMES.has(name)
}

/**
 * Keep SDK availability separate from execution authority. High-risk tools
 * stay visible so the model can propose them, but code must authorize them
 * immediately before dispatch.
 */
export function filterToolsByPolicy(
  tools: AcpToolLike[],
  _policy: { autoFundEnabled: boolean },
): AcpToolLike[] {
  return [...tools]
}

export type ToolExecutionPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: 'mutating_tool_proposal_only' | 'unknown_tool' }

export function evaluateToolExecutionPolicy(
  name: string,
  executableHighRiskTools: readonly VirtualsHighRiskTool[],
): ToolExecutionPolicyDecision {
  if (DEFAULT_EXECUTABLE_TOOL_NAMES.has(name)) return { allowed: true }
  if (!HIGH_RISK_TOOL_NAMES.has(name)) return { allowed: false, reason: 'unknown_tool' }
  return executableHighRiskTools.includes(name as VirtualsHighRiskTool)
    ? { allowed: true }
    : { allowed: false, reason: 'mutating_tool_proposal_only' }
}

export type SpendArgsDecision =
  | { valid: true; args: Record<string, unknown>; amountUsdc: number }
  | { valid: false; reason: 'invalid_spend_amount' }

/** Validate and cap USDC spend args. Invalid amounts are never made executable. */
export function validateAndClampSpendArgs(
  name: string,
  args: Record<string, unknown>,
  maxBudgetUsdc: number,
): SpendArgsDecision {
  if (!isSpendTool(name)) return { valid: true, args, amountUsdc: 0 }
  const raw = args.amount
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return { valid: false, reason: 'invalid_spend_amount' }
  }
  const amountUsdc = Math.min(raw, maxBudgetUsdc)
  return { valid: true, args: { ...args, amount: amountUsdc }, amountUsdc }
}

export type ToolDispatchDecision =
  | { executed: true }
  | {
      executed: false
      reason:
        | 'mutating_tool_proposal_only'
        | 'unknown_tool'
        | 'invalid_spend_amount'
        | 'invalid_tool_arguments'
        | 'dispatch_denied'
    }

function parameterTypeMatches(type: string, value: unknown): boolean {
  switch (type.trim().toLowerCase()) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value)
    default:
      return false
  }
}

/** Validate exact names and runtime types from the SDK's current AcpTool. */
export function validateToolArguments(
  tool: AcpToolLike,
  args: Record<string, unknown>,
): boolean {
  const parameters = new Map(tool.parameters.map((parameter) => [parameter.name, parameter]))
  if (Object.keys(args).some((name) => !parameters.has(name))) return false
  return tool.parameters.every((parameter) => {
    const present = Object.prototype.hasOwnProperty.call(args, parameter.name)
    if (!present) return parameter.required === false
    return parameterTypeMatches(parameter.type, args[parameter.name])
  })
}

/**
 * Final deterministic boundary around dispatch. The callback is never invoked
 * for proposal-only tools or invalid spend arguments.
 */
export async function executeToolUnderPolicy(params: {
  tool: AcpToolLike
  args: Record<string, unknown>
  maxBudgetUsdc: number
  executableHighRiskTools: readonly VirtualsHighRiskTool[]
  dispatch: (args: Record<string, unknown>) => Promise<boolean>
}): Promise<ToolDispatchDecision> {
  const policy = evaluateToolExecutionPolicy(params.tool.name, params.executableHighRiskTools)
  if (!policy.allowed) return { executed: false, reason: policy.reason }
  const spend = validateAndClampSpendArgs(params.tool.name, params.args, params.maxBudgetUsdc)
  if (!spend.valid) return { executed: false, reason: spend.reason }
  if (!validateToolArguments(params.tool, spend.args)) {
    return { executed: false, reason: 'invalid_tool_arguments' }
  }
  return (await params.dispatch(spend.args))
    ? { executed: true }
    : { executed: false, reason: 'dispatch_denied' }
}

export function buildToolSystemPrompt(params: {
  persona: string
  tools: AcpToolLike[]
  roles: string[]
  status: string
  maxBudgetUsdc: number
}): string {
  const toolCatalog = params.tools
    .map((tool) => {
      const parameters = tool.parameters
        .map((p) => `${p.name} (${p.type}${p.required === false ? ', optional' : ''})`)
        .join(', ')
      return `- ${tool.name}: ${tool.description}${parameters ? ` | args: ${parameters}` : ''}`
    })
    .join('\n')

  return [
    params.persona,
    '',
    `You are handling an ACP job. Your role(s): ${params.roles.join(', ')}. Job status: ${params.status}.`,
    'Available tools:',
    toolCatalog,
    '',
    `Budget rule: any USDC amount you choose must be at most ${params.maxBudgetUsdc} USDC.`,
    'Respond with EXACTLY ONE JSON object and nothing else, in one of these shapes:',
    '{"tool": "<toolName>", "args": {<args>}}',
    ...(params.tools.some((tool) => tool.name === 'wait')
      ? ['{"tool": "wait", "args": {}}', 'Use "wait" only when it is listed and no action is needed.']
      : []),
    'Do not invent tools or argument names that are not listed.',
  ].join('\n')
}

/**
 * Extract the first JSON object from an LLM response and validate it against
 * the available tool list. Returns `{kind:'none'}` for anything unusable.
 */
export function parseToolDecision(text: string | null, availableTools: AcpToolLike[]): ToolDecision {
  if (!text) return { kind: 'none' }
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { kind: 'none' }

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return { kind: 'none' }
  }
  if (!parsed || typeof parsed !== 'object') return { kind: 'none' }

  const decision = parsed as { tool?: unknown; args?: unknown }
  const name = String(decision.tool ?? '').trim()
  if (!name) return { kind: 'none' }
  if (!availableTools.some((tool) => tool.name === name)) return { kind: 'none' }

  const args =
    decision.args && typeof decision.args === 'object' && !Array.isArray(decision.args)
      ? (decision.args as Record<string, unknown>)
      : {}
  return { kind: 'tool', name, args }
}

export function buildStructuredToolProposal(
  name: string,
  args: Record<string, unknown>,
): string {
  return JSON.stringify({
    type: 'tool_execution_proposal',
    version: 1,
    tool: name,
    arguments: args,
    requiresExplicitAuthorization: true,
  })
}
