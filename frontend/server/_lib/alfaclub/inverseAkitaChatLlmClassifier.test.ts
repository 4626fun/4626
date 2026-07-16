import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildInverseAkitaChatClassifierPrompt,
  classifyInverseAkitaChatOpinion,
  parseInverseAkitaChatLlmClassification,
  readInverseAkitaChatLlmClassifierConfig,
} from './inverseAkitaChatLlmClassifier.js'

describe('inverseAkitaChatLlmClassifier', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_LLM_ENABLED', '')
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_LLM_MODE', '')
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_LLM_FAIL_MODE', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to disabled classify/allow', () => {
    expect(readInverseAkitaChatLlmClassifierConfig()).toEqual({
      enabled: false,
      mode: 'classify',
      failMode: 'allow',
      timeoutMs: 8_000,
    })
  })

  it('parses trade and skip JSON (including prose wrappers)', () => {
    expect(
      parseInverseAkitaChatLlmClassification(
        'here you go\n{"verdict":"trade","userSide":"long","pair":"btc","reason":"bullish"}\n',
      ),
    ).toEqual({
      verdict: 'trade',
      userSide: 'long',
      pair: 'BTC',
      reason: 'bullish',
    })
    expect(
      parseInverseAkitaChatLlmClassification('{"verdict":"skip","reason":"gm"}'),
    ).toEqual({ verdict: 'skip', reason: 'gm' })
    expect(parseInverseAkitaChatLlmClassification('not json')).toBeNull()
  })

  it('builds a prompt that asks for author lean not the invert', () => {
    const { systemPrompt, userMessage } = buildInverseAkitaChatClassifierPrompt({
      text: 'btc looking juicy',
      availableMarkets: [
        { symbol: 'BTC', maxLeverage: 40 },
        { symbol: 'xyz:TSLA', maxLeverage: 10 },
      ],
    })
    expect(systemPrompt).toMatch(/AUTHOR/i)
    expect(systemPrompt).toMatch(/invert/i)
    expect(userMessage).toContain('btc looking juicy')
    expect(userMessage).toContain('BTC, xyz:TSLA')
  })

  it('no-ops when disabled', async () => {
    const generate = vi.fn()
    await expect(
      classifyInverseAkitaChatOpinion({
        text: 'btc looking bullish',
        generate,
        config: {
          enabled: false,
          mode: 'classify',
          failMode: 'allow',
          timeoutMs: 1_000,
        },
      }),
    ).resolves.toEqual({
      evaluated: false,
      applied: false,
      classification: null,
      blocked: false,
      skipReason: null,
    })
    expect(generate).not.toHaveBeenCalled()
  })

  it('applies trade classifications in classify mode', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: '{"verdict":"trade","userSide":"short","pair":"ETH","reason":"dump"}',
    })
    await expect(
      classifyInverseAkitaChatOpinion({
        text: 'eth looks cooked',
        generate,
        config: {
          enabled: true,
          mode: 'classify',
          failMode: 'allow',
          timeoutMs: 1_000,
        },
      }),
    ).resolves.toMatchObject({
      evaluated: true,
      applied: true,
      classification: {
        verdict: 'trade',
        userSide: 'short',
        pair: 'ETH',
      },
    })
  })

  it('logs but does not apply in advisory mode', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: '{"verdict":"trade","userSide":"long","pair":"SOL","reason":"pump"}',
    })
    await expect(
      classifyInverseAkitaChatOpinion({
        text: 'sol gonna rip',
        generate,
        config: {
          enabled: true,
          mode: 'advisory',
          failMode: 'allow',
          timeoutMs: 1_000,
        },
      }),
    ).resolves.toMatchObject({
      evaluated: true,
      applied: false,
      classification: { verdict: 'trade', pair: 'SOL' },
      blocked: false,
    })
  })

  it('blocks on failure only when classify+block', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('timeout'))
    await expect(
      classifyInverseAkitaChatOpinion({
        text: 'btc bullish',
        generate,
        config: {
          enabled: true,
          mode: 'classify',
          failMode: 'block',
          timeoutMs: 1_000,
        },
      }),
    ).resolves.toMatchObject({
      evaluated: false,
      blocked: true,
      skipReason: 'llm_unavailable:request_failed',
    })
  })
})

describe('collectInverseAkitaChatTradeIntents + LLM', () => {
  it('uses LLM trade classification over loose regex when classify mode applies', async () => {
    const { collectInverseAkitaChatTradeIntents } = await import(
      './inverseAkitaChatReaction.js'
    )
    const intents = await collectInverseAkitaChatTradeIntents({
      roomId: '1659',
      messages: [
        {
          id: 'llm-1',
          sender: '0x1111111111111111111111111111111111111111',
          text: 'btc looking bullish today',
        },
      ],
      llmConfig: {
        enabled: true,
        mode: 'classify',
        failMode: 'allow',
        timeoutMs: 1_000,
      },
      classifyOpinion: async () => ({
        evaluated: true,
        applied: true,
        classification: {
          verdict: 'trade',
          userSide: 'short',
          pair: 'BTC',
          reason: 'model says short',
        },
        blocked: false,
        skipReason: null,
      }),
    })
    expect(intents).toEqual([
      expect.objectContaining({
        id: 'llm-1',
        userSide: 'short',
        pair: 'BTC',
        parseMode: 'llm',
      }),
    ])
  })

  it('drops loose intents when the LLM skips in classify mode', async () => {
    const { collectInverseAkitaChatTradeIntents } = await import(
      './inverseAkitaChatReaction.js'
    )
    const intents = await collectInverseAkitaChatTradeIntents({
      roomId: '1659',
      messages: [
        {
          id: 'llm-skip',
          sender: '0x1111111111111111111111111111111111111111',
          text: 'btc looking bullish today',
        },
      ],
      llmConfig: {
        enabled: true,
        mode: 'classify',
        failMode: 'allow',
        timeoutMs: 1_000,
      },
      classifyOpinion: async () => ({
        evaluated: true,
        applied: true,
        classification: { verdict: 'skip', reason: 'not a real lean' },
        blocked: false,
        skipReason: 'llm_skip:not a real lean',
      }),
    })
    expect(intents).toEqual([])
  })

  it('does not call the LLM for strict long/short intents', async () => {
    const { collectInverseAkitaChatTradeIntents } = await import(
      './inverseAkitaChatReaction.js'
    )
    const classifyOpinion = vi.fn()
    const intents = await collectInverseAkitaChatTradeIntents({
      roomId: '1659',
      messages: [
        {
          id: 'strict-1',
          sender: '0x1111111111111111111111111111111111111111',
          text: 'long btc',
        },
      ],
      llmConfig: {
        enabled: true,
        mode: 'classify',
        failMode: 'allow',
        timeoutMs: 1_000,
      },
      classifyOpinion,
    })
    expect(classifyOpinion).not.toHaveBeenCalled()
    expect(intents).toEqual([
      expect.objectContaining({ id: 'strict-1', parseMode: 'strict', pair: 'BTC' }),
    ])
  })
})
