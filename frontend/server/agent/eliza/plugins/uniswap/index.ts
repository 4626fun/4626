import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

import { executeUniswapSkill, type UniswapSkillName } from '../../../../uniswap/agentSkills.js'

function parseSkillInvocation(text: string): { skill: UniswapSkillName; payload: Record<string, unknown> } | null {
  const trimmed = text.trim()
  if (!trimmed.toLowerCase().startsWith('/uniswap')) return null

  const [, rawSkill, ...rest] = trimmed.split(' ')
  const skill = String(rawSkill ?? '').trim() as UniswapSkillName
  if (!skill) return null

  const payloadText = rest.join(' ').trim()
  if (!payloadText) return { skill, payload: {} }

  try {
    const parsed = JSON.parse(payloadText)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return { skill, payload: parsed as Record<string, unknown> }
  } catch {
    return null
  }
}

const uniswapSkillAction: Action = {
  name: 'UNISWAP_SKILL',
  similes: ['uniswap skill', '/uniswap'],
  description: 'Execute structured Uniswap skills by command: /uniswap <skill_name> <json_payload>.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    return parseSkillInvocation(message.content?.text ?? '') !== null
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const parsed = parseSkillInvocation(message.content?.text ?? '')
    if (!parsed) {
      await callback?.({ text: 'Invalid /uniswap command. Format: /uniswap <skill_name> <json_payload>' } as Content)
      return
    }

    try {
      const data = await executeUniswapSkill(parsed.skill, parsed.payload)
      await callback?.({ text: JSON.stringify({ skill: parsed.skill, data }, null, 2) } as Content)
    } catch (error: any) {
      await callback?.({ text: `Uniswap skill failed: ${error?.message ?? 'unknown error'}` } as Content)
    }
  },

  examples: [
    [
      { name: 'user', content: { text: '/uniswap uniswap_quote {"tokenIn":"0x4200000000000000000000000000000000000006","tokenOut":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","tokenInChainId":8453,"tokenOutChainId":8453,"type":"EXACT_INPUT","amount":"1000000000000000","swapper":"0x1111111111111111111111111111111111111111"}' } },
      { name: 'agent', content: { text: '{"skill":"uniswap_quote","data":{...}}' } },
    ],
  ],
}

export const uniswapPlugin: Plugin = {
  name: '@creatorvault/plugin-uniswap',
  description: 'Structured Uniswap protocol actions for ElizaOS runtime.',
  actions: [uniswapSkillAction],
}

export default uniswapPlugin
