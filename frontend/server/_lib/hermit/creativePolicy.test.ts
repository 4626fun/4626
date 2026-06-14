import { afterEach, describe, expect, it } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'

import { creativePolicyEnvKey, resolveHermitCreativePolicy, type HermitCreativeRoute } from './creativePolicy.js'

describe('resolveHermitCreativePolicy', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('routes /gmeow to fast tier defaults', () => {
    const policy = resolveHermitCreativePolicy({ command: '/gmeow' })
    expect(policy.route).toBe('gmeow')
    expect(policy.tier).toBe('fast_default')
    expect(policy.timeoutMs).toBe(3500)
    expect(policy.retryCount).toBe(0)
  })

  it('routes /meme to creative premium defaults', () => {
    const policy = resolveHermitCreativePolicy({ command: '/meme' })
    expect(policy.route).toBe('meme')
    expect(policy.tier).toBe('creative_premium')
    expect(policy.timeoutMs).toBe(10000)
    expect(policy.retryCount).toBe(1)
  })

  it('routes /hermit mode-specific variants', () => {
    const announce = resolveHermitCreativePolicy({ command: '/hermit', hermitMode: 'announce' })
    const tone = resolveHermitCreativePolicy({ command: '/hermit', hermitMode: 'tone' })
    expect(announce.route).toBe('hermit_announce')
    expect(announce.tier).toBe('creative_premium')
    expect(tone.route).toBe('hermit_tone')
    expect(tone.tier).toBe('fast_default')
    expect(tone.retryCount).toBe(0)
  })

  it('honors route env overrides and clamps within global timeout', () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_HTTP_TIMEOUT_MS: '4200',
      HERMIT_HERMIT_ANNOUNCE_TIMEOUT_MS: '9000',
      HERMIT_HERMIT_ANNOUNCE_MAX_OUTPUT_TOKENS: '1200',
      HERMIT_HERMIT_ANNOUNCE_RETRY_COUNT: '2',
      HERMIT_CREATIVE_PREMIUM_MODEL_HINT: 'nousresearch/hermes-4-405b',
    })
    const policy = resolveHermitCreativePolicy({ command: '/hermit', hermitMode: 'announce' })
    expect(policy.timeoutMs).toBe(4200)
    expect(policy.maxOutputTokens).toBe(1200)
    expect(policy.retryCount).toBe(2)
    expect(policy.targetModelHint).toBe('nousresearch/hermes-4-405b')
  })

  it('uses route timeout when global timeout is higher', () => {
    restoreEnv = applyEnv({
      HERMIT_AGENT_HTTP_TIMEOUT_MS: '60000',
      HERMIT_GMEOW_TIMEOUT_MS: '3500',
    })
    const policy = resolveHermitCreativePolicy({ command: '/gmeow' })
    expect(policy.timeoutMs).toBe(3500)
  })

  const routeDefaults: Array<{
    route: HermitCreativeRoute
    command: '/gmeow' | '/meme' | '/hermit'
    hermitMode?: 'copy' | 'announce' | 'quest' | 'tone'
    tier: 'fast_default' | 'creative_premium'
    timeoutMs: number
    maxOutputTokens: number
    retryCount: number
  }> = [
    { route: 'gmeow', command: '/gmeow', tier: 'fast_default', timeoutMs: 3500, maxOutputTokens: 120, retryCount: 0 },
    { route: 'meme', command: '/meme', tier: 'creative_premium', timeoutMs: 10000, maxOutputTokens: 320, retryCount: 1 },
    { route: 'hermit_copy', command: '/hermit', hermitMode: 'copy', tier: 'creative_premium', timeoutMs: 6000, maxOutputTokens: 260, retryCount: 1 },
    { route: 'hermit_announce', command: '/hermit', hermitMode: 'announce', tier: 'creative_premium', timeoutMs: 9000, maxOutputTokens: 420, retryCount: 1 },
    { route: 'hermit_quest', command: '/hermit', hermitMode: 'quest', tier: 'creative_premium', timeoutMs: 11000, maxOutputTokens: 520, retryCount: 1 },
    { route: 'hermit_tone', command: '/hermit', hermitMode: 'tone', tier: 'fast_default', timeoutMs: 4000, maxOutputTokens: 160, retryCount: 0 },
  ]

  it.each(routeDefaults)('defaults for $route', ({ command, hermitMode, route, tier, timeoutMs, maxOutputTokens, retryCount }) => {
    const policy = resolveHermitCreativePolicy(
      hermitMode ? { command, hermitMode } : { command: command as '/gmeow' | '/meme' },
    )
    expect(policy.route).toBe(route)
    expect(policy.tier).toBe(tier)
    expect(policy.timeoutMs).toBe(timeoutMs)
    expect(policy.maxOutputTokens).toBe(maxOutputTokens)
    expect(policy.retryCount).toBe(retryCount)
  })

  it('documents env keys via creativePolicyEnvKey', () => {
    expect(creativePolicyEnvKey('hermit_announce', 'TIMEOUT_MS')).toBe('HERMIT_HERMIT_ANNOUNCE_TIMEOUT_MS')
  })
})
