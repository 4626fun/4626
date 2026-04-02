import { afterEach, describe, expect, it } from 'vitest'

import { applyEnv } from './helpers'

import { resolveSenderWalletWithSource } from '../_handlers/telegram/webhook/env'

describe('telegram webhook sender wallet resolution', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('treats mapped zero address as unauthenticated source', () => {
    restoreEnv = applyEnv({
      TELEGRAM_USER_WALLET_MAP_JSON: JSON.stringify({
        '42': '0x0000000000000000000000000000000000000000',
      }),
      TELEGRAM_DEFAULT_SENDER_WALLET: undefined,
    })

    expect(resolveSenderWalletWithSource('42')).toEqual({
      wallet: '0x0000000000000000000000000000000000000000',
      source: 'zero',
    })
  })

  it('treats default zero address as unauthenticated source', () => {
    restoreEnv = applyEnv({
      TELEGRAM_USER_WALLET_MAP_JSON: undefined,
      TELEGRAM_DEFAULT_SENDER_WALLET: '0x0000000000000000000000000000000000000000',
    })

    expect(resolveSenderWalletWithSource('99')).toEqual({
      wallet: '0x0000000000000000000000000000000000000000',
      source: 'zero',
    })
  })

  it('keeps non-zero default fallback as default source', () => {
    restoreEnv = applyEnv({
      TELEGRAM_USER_WALLET_MAP_JSON: undefined,
      TELEGRAM_DEFAULT_SENDER_WALLET: '0x00000000000000000000000000000000000000aa',
    })

    expect(resolveSenderWalletWithSource('99')).toEqual({
      wallet: '0x00000000000000000000000000000000000000aa',
      source: 'default',
    })
  })
})
