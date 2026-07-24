import { describe, expect, it, vi } from 'vitest'

import {
  buildToolSystemPrompt,
  evaluateToolExecutionPolicy,
  executeToolUnderPolicy,
  filterToolsByPolicy,
  isSpendTool,
  parseToolDecision,
  buildStructuredToolProposal,
  validateToolArguments,
  validateAndClampSpendArgs,
  type AcpToolLike,
} from './toolLoop.js'

const TOOLS: AcpToolLike[] = [
  {
    name: 'sendMessage',
    description: 'Send a message into the job room',
    parameters: [
      { name: 'content', type: 'string', required: true },
      { name: 'contentType', type: 'string', required: false },
    ],
  },
  {
    name: 'setBudget',
    description: 'Set the job budget in USDC',
    parameters: [{ name: 'amount', type: 'number', required: true }],
  },
  {
    name: 'fund',
    description: 'Fund the job escrow in USDC',
    parameters: [{ name: 'amount', type: 'number', required: true }],
  },
  {
    name: 'complete',
    description: 'Complete the job',
    parameters: [],
  },
]

describe('isSpendTool', () => {
  it('flags setBudget and fund only', () => {
    expect(isSpendTool('setBudget')).toBe(true)
    expect(isSpendTool('fund')).toBe(true)
    expect(isSpendTool('sendMessage')).toBe(false)
    expect(isSpendTool('complete')).toBe(false)
  })
})

describe('filterToolsByPolicy', () => {
  it('keeps high-risk tools visible as proposals when execution is disabled', () => {
    const filtered = filterToolsByPolicy(TOOLS, { autoFundEnabled: false })
    expect(filtered.map((t) => t.name)).toEqual(['sendMessage', 'setBudget', 'fund', 'complete'])
  })

  it('does not derive execution authority from the legacy auto-fund prompt flag', () => {
    const filtered = filterToolsByPolicy(TOOLS, { autoFundEnabled: true })
    expect(filtered).toEqual(TOOLS)
  })
})

describe('evaluateToolExecutionPolicy', () => {
  it('makes all high-risk tools proposal-only by default', () => {
    for (const tool of ['setBudget', 'fund', 'submit', 'complete', 'reject']) {
      expect(evaluateToolExecutionPolicy(tool, [])).toEqual({
        allowed: false,
        reason: 'mutating_tool_proposal_only',
      })
    }
  })

  it('allows only explicitly typed high-risk capabilities', () => {
    expect(evaluateToolExecutionPolicy('complete', ['complete'])).toEqual({ allowed: true })
    expect(evaluateToolExecutionPolicy('fund', ['complete'])).toEqual({
      allowed: false,
      reason: 'mutating_tool_proposal_only',
    })
    expect(evaluateToolExecutionPolicy('sendMessage', [])).toEqual({ allowed: true })
    expect(evaluateToolExecutionPolicy('wait', [])).toEqual({ allowed: true })
    expect(evaluateToolExecutionPolicy('futureUnknownMutation', [])).toEqual({
      allowed: false,
      reason: 'unknown_tool',
    })
  })
})

describe('validateAndClampSpendArgs', () => {
  it('clamps spend amounts to the configured ceiling', () => {
    expect(validateAndClampSpendArgs('setBudget', { amount: 100 }, 5)).toEqual({
      valid: true,
      args: { amount: 5 },
      amountUsdc: 5,
    })
  })

  it('passes through amounts under the cap', () => {
    expect(validateAndClampSpendArgs('setBudget', { amount: 2.5 }, 5)).toEqual({
      valid: true,
      args: { amount: 2.5 },
      amountUsdc: 2.5,
    })
  })

  it('rejects invalid, string, missing, zero, and non-positive spend amounts', () => {
    for (const args of [{ amount: '2' }, { amount: 'lots' }, { amount: -3 }, { amount: 0 }, {}]) {
      expect(validateAndClampSpendArgs('fund', args, 5)).toEqual({
        valid: false,
        reason: 'invalid_spend_amount',
      })
    }
  })

  it('does not touch non-spend tools', () => {
    expect(validateAndClampSpendArgs('sendMessage', { content: 'hi' }, 5)).toEqual({
      valid: true,
      args: { content: 'hi' },
      amountUsdc: 0,
    })
  })
})

describe('executeToolUnderPolicy', () => {
  it('does not call dispatch for proposal-only high-risk tools', async () => {
    const dispatch = vi.fn(async () => true)
    const result = await executeToolUnderPolicy({
      tool: TOOLS[3],
      args: {},
      maxBudgetUsdc: 5,
      executableHighRiskTools: [],
      dispatch,
    })
    expect(result).toEqual({ executed: false, reason: 'mutating_tool_proposal_only' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does not call dispatch for invalid spend args even when fund is allowed', async () => {
    const dispatch = vi.fn(async () => true)
    const result = await executeToolUnderPolicy({
      tool: TOOLS[2],
      args: { amount: 0 },
      maxBudgetUsdc: 5,
      executableHighRiskTools: ['fund'],
      dispatch,
    })
    expect(result).toEqual({ executed: false, reason: 'invalid_spend_amount' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('dispatches capped spend args only with explicit capability', async () => {
    const dispatch = vi.fn(async () => true)
    const result = await executeToolUnderPolicy({
      tool: TOOLS[2],
      args: { amount: 50 },
      maxBudgetUsdc: 5,
      executableHighRiskTools: ['fund'],
      dispatch,
    })
    expect(result).toEqual({ executed: true })
    expect(dispatch).toHaveBeenCalledWith({ amount: 5 })
  })

  it('denies unknown tools and SDK-invalid argument names before dispatch', async () => {
    const dispatch = vi.fn(async () => true)
    expect(await executeToolUnderPolicy({
      tool: { name: 'futureMutation', description: 'Unknown', parameters: [] },
      args: {},
      maxBudgetUsdc: 5,
      executableHighRiskTools: [],
      dispatch,
    })).toEqual({ executed: false, reason: 'unknown_tool' })
    expect(await executeToolUnderPolicy({
      tool: TOOLS[0],
      args: { message: 'wrong SDK argument name' },
      maxBudgetUsdc: 5,
      executableHighRiskTools: [],
      dispatch,
    })).toEqual({ executed: false, reason: 'invalid_tool_arguments' })
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('validateToolArguments', () => {
  it('accepts only SDK-declared names with required runtime types', () => {
    expect(validateToolArguments(TOOLS[0], { content: 'hello' })).toBe(true)
    expect(validateToolArguments(TOOLS[0], {})).toBe(false)
    expect(validateToolArguments(TOOLS[0], { content: 7 })).toBe(false)
    expect(validateToolArguments(TOOLS[0], { content: 'hello', invented: true })).toBe(false)
  })
})

describe('parseToolDecision', () => {
  it('parses a valid tool decision', () => {
    const decision = parseToolDecision('{"tool": "sendMessage", "args": {"content": "hello"}}', TOOLS)
    expect(decision).toEqual({ kind: 'tool', name: 'sendMessage', args: { content: 'hello' } })
  })

  it('extracts JSON embedded in surrounding prose', () => {
    const decision = parseToolDecision(
      'Sure! Here is my decision: {"tool": "setBudget", "args": {"amount": 3}} hope that helps',
      TOOLS,
    )
    expect(decision).toEqual({ kind: 'tool', name: 'setBudget', args: { amount: 3 } })
  })

  it('rejects tools not in the available list (including wait)', () => {
    expect(parseToolDecision('{"tool": "selfDestruct", "args": {}}', TOOLS)).toEqual({ kind: 'none' })
    expect(parseToolDecision('{"tool": "wait", "args": {}}', TOOLS)).toEqual({ kind: 'none' })
  })

  it('returns none for empty, non-JSON, or malformed input', () => {
    expect(parseToolDecision(null, TOOLS)).toEqual({ kind: 'none' })
    expect(parseToolDecision('', TOOLS)).toEqual({ kind: 'none' })
    expect(parseToolDecision('no json here', TOOLS)).toEqual({ kind: 'none' })
    expect(parseToolDecision('{"tool": ', TOOLS)).toEqual({ kind: 'none' })
    expect(parseToolDecision('{"args": {"amount": 1}}', TOOLS)).toEqual({ kind: 'none' })
  })

  it('defaults args to an empty object when missing or invalid', () => {
    expect(parseToolDecision('{"tool": "sendMessage"}', TOOLS)).toEqual({
      kind: 'tool',
      name: 'sendMessage',
      args: {},
    })
    expect(parseToolDecision('{"tool": "sendMessage", "args": [1,2]}', TOOLS)).toEqual({
      kind: 'tool',
      name: 'sendMessage',
      args: {},
    })
  })
})

describe('buildToolSystemPrompt', () => {
  it('includes persona, roles, status, tool catalog, and budget rule', () => {
    const prompt = buildToolSystemPrompt({
      persona: 'You are agent 4626.',
      tools: TOOLS.slice(0, 2),
      roles: ['provider'],
      status: 'negotiation',
      maxBudgetUsdc: 5,
    })
    expect(prompt).toContain('You are agent 4626.')
    expect(prompt).toContain('Your role(s): provider')
    expect(prompt).toContain('Job status: negotiation')
    expect(prompt).toContain('- sendMessage:')
    expect(prompt).toContain('- setBudget:')
    expect(prompt).not.toContain('- fund:')
    expect(prompt).toContain('at most 5 USDC')
    expect(prompt).not.toContain('"wait"')
  })

  it('documents wait only when the SDK currently exposes it', () => {
    const prompt = buildToolSystemPrompt({
      persona: 'You are agent 4626.',
      tools: [{ name: 'wait', description: 'Do nothing', parameters: [] }],
      roles: ['provider'],
      status: 'open',
      maxBudgetUsdc: 5,
    })
    expect(prompt).toContain('"wait"')
  })
})

describe('buildStructuredToolProposal', () => {
  it('builds a machine-readable counterparty proposal', () => {
    expect(JSON.parse(buildStructuredToolProposal('complete', { reason: 'done' }))).toEqual({
      type: 'tool_execution_proposal',
      version: 1,
      tool: 'complete',
      arguments: { reason: 'done' },
      requiresExplicitAuthorization: true,
    })
  })
})
