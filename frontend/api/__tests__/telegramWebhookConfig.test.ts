import { afterEach, describe, expect, it } from 'vitest'

import { applyEnv } from './helpers'

import { getTelegramWebhookConfig } from '../_handlers/telegram/webhook/config'

describe('telegram webhook config', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('caps init data, session, and replay ttl to Privy-aligned five-minute windows', () => {
    restoreEnv = applyEnv({
      TELEGRAM_MINIAPP_SESSION_TTL_SECONDS: '600',
      TELEGRAM_MINIAPP_INITDATA_MAX_AGE_SECONDS: '1200',
      TELEGRAM_MINIAPP_REPLAY_TTL_SECONDS: '900',
    })

    const config = getTelegramWebhookConfig()
    expect(config.miniAppInitDataMaxAgeSeconds).toBe(300)
    expect(config.miniAppSessionTtlSeconds).toBe(300)
    expect(config.miniAppReplayTtlSeconds).toBe(300)
  })

  it('defaults replay ttl to the session ttl when unset', () => {
    restoreEnv = applyEnv({
      TELEGRAM_MINIAPP_SESSION_TTL_SECONDS: '480',
      TELEGRAM_MINIAPP_REPLAY_TTL_SECONDS: undefined,
    })

    const config = getTelegramWebhookConfig()
    expect(config.miniAppSessionTtlSeconds).toBe(300)
    expect(config.miniAppReplayTtlSeconds).toBe(300)
  })

  it('normalizes stale Telegram menu button labels from env', () => {
    restoreEnv = applyEnv({
      TELEGRAM_MENU_BUTTON_TEXT: 'Open 4626 v2',
    })

    const config = getTelegramWebhookConfig()
    expect(config.menuButtonText).toBe('Open 4626')
  })
})
