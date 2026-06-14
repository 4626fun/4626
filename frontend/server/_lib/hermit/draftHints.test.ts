import { describe, expect, it } from 'vitest'

import { parseDraftHints, resolveDraftMaxOutputTokens, resolveDraftTimeoutMs } from './draftHints.js'

describe('parseDraftHints', () => {
  it('returns null when hints are absent', () => {
    expect(parseDraftHints({ prompt: 'hi' })).toBeNull()
  })

  it('parses and clamps valid hints', () => {
    const parsed = parseDraftHints({
      prompt: 'hi',
      hints: {
        lane: 'hermit_creative',
        route: 'meme',
        tier: 'creative_premium',
        model: 'nousresearch/hermes-4-70b',
        maxOutputTokens: 5000,
        timeoutMs: 200_000,
      },
    })
    expect(parsed).toEqual({
      lane: 'hermit_creative',
      route: 'meme',
      tier: 'creative_premium',
      model: 'nousresearch/hermes-4-70b',
      maxOutputTokens: 4000,
      timeoutMs: 120_000,
    })
  })

  it('ignores invalid route and tier values', () => {
    const parsed = parseDraftHints({
      hints: { route: 'invalid', tier: 'nope', model: 'openai/gpt-4.1-mini' },
    })
    expect(parsed?.route).toBeNull()
    expect(parsed?.tier).toBeNull()
    expect(parsed?.model).toBe('openai/gpt-4.1-mini')
  })
})

describe('resolveDraftMaxOutputTokens', () => {
  it('prefers hint over env fallback', () => {
    expect(
      resolveDraftMaxOutputTokens(
        {
          lane: null,
          route: 'gmeow',
          tier: 'fast_default',
          model: null,
          maxOutputTokens: 120,
          timeoutMs: null,
        },
        400,
      ),
    ).toBe(120)
  })
})

describe('resolveDraftTimeoutMs', () => {
  it('uses min of hint and env ceiling', () => {
    expect(
      resolveDraftTimeoutMs(
        {
          lane: null,
          route: 'meme',
          tier: null,
          model: null,
          maxOutputTokens: null,
          timeoutMs: 9000,
        },
        6000,
      ),
    ).toBe(6000)
  })
})
