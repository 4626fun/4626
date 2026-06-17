import { describe, expect, it, vi } from 'vitest'

import {
  applyCounterTradeLlmGate,
  buildCounterTradeAdvisorPrompt,
  parseCounterTradeAdvice,
  readCounterTradeLlmAdvisorConfig,
  type CounterTradeCandidateContext,
  type CounterTradeLlmAdvisorConfig,
} from './counterTradeLlmAdvisor.js'

const CONTEXT: CounterTradeCandidateContext = {
  roomId: '1659',
  pair: 'BTC',
  fill: {
    time: 1_720_000_000_000,
    coin: 'BTC',
    px: 100_000,
    sz: 0.01,
    dir: 'Open Long 5x',
    side: 'long',
    startPosition: 0,
    leverage: 5,
    closedPnl: 0,
    fee: 0.5,
  },
  fillAction: 'entry',
  bias: 'neutral',
  preset: 'balanced',
  counterSide: 'short',
  counterLeverage: 5,
  counterNotionalUsd: 450,
  counterWalletState: {
    accountValueUsd: 10_000,
    totalNtlPosUsd: 2_000,
    totalRawUsdUsd: 8_000,
    withdrawableUsd: 7_500,
    assetPositions: [
      {
        coin: 'ETH',
        entryPx: 4_000,
        positionValue: 2_000,
        unrealizedPnl: -50,
        liquidationPx: 5_200,
        leverage: 3,
        side: 'short',
      },
    ],
  },
  hourlyExecutedCount: 2,
  hourlyCap: 12,
  dailyNotionalUsedUsd: 1_200,
  dailyNotionalCapUsd: 7_500,
}

const GATE_CONFIG: CounterTradeLlmAdvisorConfig = {
  enabled: true,
  mode: 'gate',
  failMode: 'allow',
  timeoutMs: 5_000,
  minSizeFactor: 0.2,
}

describe('parseCounterTradeAdvice', () => {
  it('parses execute with sizeFactor', () => {
    expect(parseCounterTradeAdvice('{"verdict":"execute","sizeFactor":0.5,"reason":"ok"}')).toEqual({
      verdict: 'execute',
      sizeFactor: 0.5,
      reason: 'ok',
    })
  })

  it('parses skip', () => {
    expect(parseCounterTradeAdvice('{"verdict":"skip","reason":"correlated"}')).toEqual({
      verdict: 'skip',
      reason: 'correlated',
    })
  })

  it('clamps sizeFactor above 1 down to 1 (model can never scale up)', () => {
    expect(parseCounterTradeAdvice('{"verdict":"execute","sizeFactor":3,"reason":"x"}')).toEqual({
      verdict: 'execute',
      sizeFactor: 1,
      reason: 'x',
    })
  })

  it('defaults missing sizeFactor to 1 and treats zero/negative as skip', () => {
    expect(parseCounterTradeAdvice('{"verdict":"execute","reason":"x"}')).toEqual({
      verdict: 'execute',
      sizeFactor: 1,
      reason: 'x',
    })
    expect(parseCounterTradeAdvice('{"verdict":"execute","sizeFactor":0,"reason":"x"}')).toEqual({
      verdict: 'skip',
      reason: 'x',
    })
  })

  it('extracts JSON from surrounding prose', () => {
    const advice = parseCounterTradeAdvice('My take: {"verdict":"skip","reason":"momentum"} — done')
    expect(advice).toEqual({ verdict: 'skip', reason: 'momentum' })
  })

  it('returns null for unusable input', () => {
    expect(parseCounterTradeAdvice(null)).toBeNull()
    expect(parseCounterTradeAdvice('')).toBeNull()
    expect(parseCounterTradeAdvice('no json')).toBeNull()
    expect(parseCounterTradeAdvice('{"verdict":"buy more"}')).toBeNull()
    expect(parseCounterTradeAdvice('{"sizeFactor":0.5}')).toBeNull()
  })
})

describe('buildCounterTradeAdvisorPrompt', () => {
  it('includes candidate, portfolio, and usage context', () => {
    const { systemPrompt, userMessage } = buildCounterTradeAdvisorPrompt(CONTEXT)
    expect(systemPrompt).toContain('NOT increase size')
    expect(systemPrompt).toContain('"verdict"')
    expect(userMessage).toContain('ENTRY long BTC')
    expect(userMessage).toContain('SHORT BTC $450.00 at 5x')
    expect(userMessage).toContain('SHORT ETH $2000')
    expect(userMessage).toContain('2/12 trades this hour')
    expect(userMessage).toContain('$1200/$7500 daily notional')
  })
})

describe('readCounterTradeLlmAdvisorConfig', () => {
  it('defaults to disabled advisory fail-open', () => {
    vi.stubEnv('ALFACLUB_COUNTER_TRADE_LLM_ENABLED', '')
    vi.stubEnv('ALFACLUB_COUNTER_TRADE_LLM_MODE', '')
    vi.stubEnv('ALFACLUB_COUNTER_TRADE_LLM_FAIL_MODE', '')
    const config = readCounterTradeLlmAdvisorConfig()
    expect(config.enabled).toBe(false)
    expect(config.mode).toBe('advisory')
    expect(config.failMode).toBe('allow')
    vi.unstubAllEnvs()
  })

  it('reads gate/block mode', () => {
    vi.stubEnv('ALFACLUB_COUNTER_TRADE_LLM_ENABLED', '1')
    vi.stubEnv('ALFACLUB_COUNTER_TRADE_LLM_MODE', 'gate')
    vi.stubEnv('ALFACLUB_COUNTER_TRADE_LLM_FAIL_MODE', 'block')
    const config = readCounterTradeLlmAdvisorConfig()
    expect(config).toMatchObject({ enabled: true, mode: 'gate', failMode: 'block' })
    vi.unstubAllEnvs()
  })
})

describe('applyCounterTradeLlmGate', () => {
  it('passes through untouched when disabled', async () => {
    const generate = vi.fn()
    const result = await applyCounterTradeLlmGate(CONTEXT, {
      config: { ...GATE_CONFIG, enabled: false },
      generate,
    })
    expect(result).toMatchObject({ proceed: true, notionalUsd: 450, evaluated: false, applied: false })
    expect(generate).not.toHaveBeenCalled()
  })

  it('advisory mode logs but never changes execution', async () => {
    const generate = vi.fn().mockResolvedValue({ text: '{"verdict":"skip","reason":"bad"}' })
    const result = await applyCounterTradeLlmGate(CONTEXT, {
      config: { ...GATE_CONFIG, mode: 'advisory' },
      generate,
    })
    expect(result.proceed).toBe(true)
    expect(result.notionalUsd).toBe(450)
    expect(result.evaluated).toBe(true)
    expect(result.applied).toBe(false)
    expect(result.advice).toEqual({ verdict: 'skip', reason: 'bad' })
  })

  it('gate mode vetoes on skip verdict', async () => {
    const generate = vi.fn().mockResolvedValue({ text: '{"verdict":"skip","reason":"stacked exposure"}' })
    const result = await applyCounterTradeLlmGate(CONTEXT, { config: GATE_CONFIG, generate })
    expect(result.proceed).toBe(false)
    expect(result.skipReason).toContain('llm_veto:stacked exposure')
  })

  it('gate mode downsizes notional but never enlarges', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: '{"verdict":"execute","sizeFactor":0.5,"reason":"low conviction"}',
    })
    const result = await applyCounterTradeLlmGate(CONTEXT, { config: GATE_CONFIG, generate })
    expect(result.proceed).toBe(true)
    expect(result.notionalUsd).toBe(225)
    expect(result.applied).toBe(true)
  })

  it('gate mode treats sub-floor downsizes as a veto', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: '{"verdict":"execute","sizeFactor":0.05,"reason":"barely"}',
    })
    const result = await applyCounterTradeLlmGate(CONTEXT, { config: GATE_CONFIG, generate })
    expect(result.proceed).toBe(false)
    expect(result.skipReason).toContain('llm_downsize_below_floor')
  })

  it('fail-open allows the deterministic trade when the LLM errors', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('provider down'))
    const result = await applyCounterTradeLlmGate(CONTEXT, { config: GATE_CONFIG, generate })
    expect(result.proceed).toBe(true)
    expect(result.notionalUsd).toBe(450)
    expect(result.evaluated).toBe(false)
  })

  it('fail-block skips the trade when the LLM errors in gate mode', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('provider down'))
    const result = await applyCounterTradeLlmGate(CONTEXT, {
      config: { ...GATE_CONFIG, failMode: 'block' },
      generate,
    })
    expect(result.proceed).toBe(false)
    expect(result.skipReason).toContain('llm_unavailable:request_failed')
  })

  it('fail-open allows when the response is unparseable', async () => {
    const generate = vi.fn().mockResolvedValue({ text: 'I think you should be careful here.' })
    const result = await applyCounterTradeLlmGate(CONTEXT, { config: GATE_CONFIG, generate })
    expect(result.proceed).toBe(true)
    expect(result.notionalUsd).toBe(450)
  })
})
