import { afterEach, describe, expect, it } from 'vitest'

import { applyEnv } from './helpers'

import { getTelegramWebhookConfig } from '../_handlers/telegram/webhook/config'

describe('telegram webhook config', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('caps replay ttl at the session ttl to avoid renewal dead zones', () => {
    restoreEnv = applyEnv({
      TELEGRAM_MINIAPP_SESSION_TTL_SECONDS: '600',
      TELEGRAM_MINIAPP_REPLAY_TTL_SECONDS: '900',
    })

    const config = getTelegramWebhookConfig()
    expect(config.miniAppSessionTtlSeconds).toBe(600)
    expect(config.miniAppReplayTtlSeconds).toBe(600)
  })

  it('defaults replay ttl to the session ttl when unset', () => {
    restoreEnv = applyEnv({
      TELEGRAM_MINIAPP_SESSION_TTL_SECONDS: '480',
      TELEGRAM_MINIAPP_REPLAY_TTL_SECONDS: undefined,
    })

    const config = getTelegramWebhookConfig()
    expect(config.miniAppSessionTtlSeconds).toBe(480)
    expect(config.miniAppReplayTtlSeconds).toBe(480)
  })
})
