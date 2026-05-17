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
    expect(runtime.systemPrompt).toContain('Use conversation context blocks truthfully and conservatively.')
    expect(runtime.systemPrompt).toContain('do not claim perfect or guaranteed memory')
    expect(runtime.systemPrompt).toContain('<history>')
  })

  it('prepends continuity guardrail even with env override', () => {
    process.env.ELIZA_CHARACTER_SYSTEM_PROMPT = 'Custom role prompt for testing.'
    const runtime = resolveCharacterRuntimeConfig()
    expect(runtime.systemPrompt).toContain('Custom role prompt for testing.')
    expect(runtime.systemPrompt).toContain('continuity depends on runtime memory/session storage availability')
  })
})
