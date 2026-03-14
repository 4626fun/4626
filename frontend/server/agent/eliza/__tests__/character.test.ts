import { afterEach, describe, expect, it } from 'vitest'

import { resolveCharacterRuntimeConfig } from '../character.js'

describe('character runtime prompt continuity guardrail', () => {
  const previousSystemPrompt = process.env.ELIZA_CHARACTER_SYSTEM_PROMPT

  afterEach(() => {
    if (typeof previousSystemPrompt === 'string') {
      process.env.ELIZA_CHARACTER_SYSTEM_PROMPT = previousSystemPrompt
    } else {
      delete process.env.ELIZA_CHARACTER_SYSTEM_PROMPT
    }
  })

  it('prepends continuity guardrail to default system prompt', () => {
    delete process.env.ELIZA_CHARACTER_SYSTEM_PROMPT
    const runtime = resolveCharacterRuntimeConfig()
    expect(runtime.systemPrompt).toContain('You are a stateful agent with perfect memory of this conversation.')
    expect(runtime.systemPrompt).toContain('NEVER claim "I have no memory"')
    expect(runtime.systemPrompt).toContain('<history>')
  })

  it('prepends continuity guardrail even with env override', () => {
    process.env.ELIZA_CHARACTER_SYSTEM_PROMPT = 'Custom role prompt for testing.'
    const runtime = resolveCharacterRuntimeConfig()
    expect(runtime.systemPrompt).toContain('Custom role prompt for testing.')
    expect(runtime.systemPrompt).toContain('Maintain perfect continuity across Telegram and XMTP sessions.')
  })
})
