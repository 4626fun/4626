import { describe, expect, it } from 'vitest'

import {
  buildToolSystemPrompt,
  clampSpendArgs,
  filterToolsByPolicy,
  isSpendTool,
  parseToolDecision,
  selectMessageTool,
  type AcpToolLike,
} from './toolLoop.js'

const TOOLS: AcpToolLike[] = [
  {
    name: 'sendMessage',
    description: 'Send a message into the job room',
    parameters: [{ name: 'message', type: 'string', required: true }],
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
  it('removes fund when auto-fund is disabled', () => {
    const filtered = filterToolsByPolicy(TOOLS, { autoFundEnabled: false })
    expect(filtered.map((t) => t.name)).toEqual(['sendMessage', 'setBudget'])
  })

  it('keeps fund when auto-fund is enabled', () => {
    const filtered = filterToolsByPolicy(TOOLS, { autoFundEnabled: true })
    expect(filtered.map((t) => t.name)).toEqual(['sendMessage', 'setBudget', 'fund'])
  })
})

describe('clampSpendArgs', () => {
  it('clamps spend amounts to the configured ceiling', () => {
    expect(clampSpendArgs('setBudget', { amount: 100 }, 5)).toEqual({ amount: 5 })
    expect(clampSpendArgs('fund', { amount: 100 }, 5)).toEqual({ amount: 5 })
  })

  it('passes through amounts under the cap', () => {
    expect(clampSpendArgs('setBudget', { amount: 2.5 }, 5)).toEqual({ amount: 2.5 })
  })

  it('zeroes invalid or non-positive amounts on spend tools', () => {
    expect(clampSpendArgs('fund', { amount: 'lots' }, 5)).toEqual({ amount: 0 })
    expect(clampSpendArgs('fund', { amount: -3 }, 5)).toEqual({ amount: 0 })
    expect(clampSpendArgs('fund', {}, 5)).toEqual({ amount: 0 })
  })

  it('does not touch non-spend tools', () => {
    expect(clampSpendArgs('sendMessage', { message: 'hi', amount: 999 }, 5)).toEqual({
      message: 'hi',
      amount: 999,
    })
  })
})

describe('parseToolDecision', () => {
  it('parses a valid tool decision', () => {
    const decision = parseToolDecision('{"tool": "sendMessage", "args": {"message": "hello"}}', TOOLS)
    expect(decision).toEqual({ kind: 'tool', name: 'sendMessage', args: { message: 'hello' } })
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
    expect(prompt).toContain('"wait"')
  })
})

describe('selectMessageTool', () => {
  it('prefers sendMessage and resolves message arg', () => {
    const selected = selectMessageTool(TOOLS)
    expect(selected).toEqual({ name: 'sendMessage', argName: 'message' })
  })

  it('falls back to respond/content style tools', () => {
    const selected = selectMessageTool([
      {
        name: 'respond',
        description: 'Respond to job room',
        parameters: [{ name: 'content', type: 'string', required: true }],
      },
    ])
    expect(selected).toEqual({ name: 'respond', argName: 'content' })
  })

  it('returns null when no text-capable tool exists', () => {
    const selected = selectMessageTool([
      {
        name: 'setBudget',
        description: 'Set budget',
        parameters: [{ name: 'amount', type: 'number', required: true }],
      },
    ])
    expect(selected).toBeNull()
  })
})
