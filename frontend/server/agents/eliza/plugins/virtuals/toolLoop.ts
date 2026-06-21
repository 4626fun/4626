/**
 * Pure helpers for the LLM-driven ACP job loop.
 *
 * The acp-node-v2 `JobSession` exposes role/status-scoped tools
 * (`availableTools()`), conversation history (`toMessages()`), and a
 * dispatcher (`executeTool(name, args)`). Our Eliza LLM service returns plain
 * text (no native tool calling), so the loop asks the model for a strict JSON
 * decision and parses it here.
 */

export type AcpToolLike = {
  name: string
  description: string
  parameters: Array<{ name: string; type: string; description?: string; required?: boolean }>
}

export type ToolDecision =
  | { kind: 'tool'; name: string; args: Record<string, unknown> }
  | { kind: 'none' }

export type MessageToolSelection = { name: string; argName: string }

/** Tools that move USDC and therefore get clamped / policy-gated. */
const SPEND_TOOL_NAMES = new Set(['setBudget', 'fund'])

export function isSpendTool(name: string): boolean {
  return SPEND_TOOL_NAMES.has(name)
}

/**
 * Policy filter applied before the tool list is shown to the LLM:
 * - `fund` (paying for a job as a client) is removed unless auto-fund is on.
 */
export function filterToolsByPolicy(
  tools: AcpToolLike[],
  policy: { autoFundEnabled: boolean },
): AcpToolLike[] {
  return tools.filter((tool) => {
    if (tool.name === 'fund' && !policy.autoFundEnabled) return false
    return true
  })
}

/** Clamp any USDC `amount` argument on spend tools to the configured ceiling. */
export function clampSpendArgs(
  name: string,
  args: Record<string, unknown>,
  maxBudgetUsdc: number,
): Record<string, unknown> {
  if (!isSpendTool(name)) return args
  const raw = Number(args.amount)
  if (!Number.isFinite(raw) || raw <= 0) return { ...args, amount: 0 }
  return { ...args, amount: Math.min(raw, maxBudgetUsdc) }
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
    '{"tool": "wait", "args": {}}',
    'Use "wait" when no action is needed yet. Do not invent tools that are not listed.',
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

/**
 * Resolve a "message send" ACP tool from the current session tool list.
 * We prefer explicit names first, then fall back to any tool with a required
 * string parameter that looks like a message/content field.
 */
export function selectMessageTool(tools: AcpToolLike[]): MessageToolSelection | null {
  const preferredNames = ['sendMessage', 'respond', 'deliver']
  for (const preferredName of preferredNames) {
    const tool = tools.find((entry) => entry.name === preferredName)
    if (!tool) continue
    const textParam =
      tool.parameters.find((param) => param.name === 'message' || param.name === 'content') ??
      tool.parameters.find((param) => param.type === 'string')
    if (!textParam) continue
    return { name: tool.name, argName: textParam.name }
  }

  for (const tool of tools) {
    const textParam =
      tool.parameters.find((param) => param.name === 'message' || param.name === 'content') ??
      tool.parameters.find((param) => param.type === 'string' && param.required !== false)
    if (!textParam) continue
    return { name: tool.name, argName: textParam.name }
  }
  return null
}
