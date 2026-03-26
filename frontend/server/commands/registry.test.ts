import { describe, expect, it } from 'vitest'

import {
  TELEGRAM_COMMAND_HEADS,
  TELEGRAM_NATIVE_COMMAND_HEADS,
  buildTelegramBotCommands,
  getCommandFamily,
  getCommandHead,
  matchesAnyCommandFamily,
  matchesCommandFamily,
} from './registry.js'

describe('command registry', () => {
  it('normalizes slash commands and bot mentions', () => {
    expect(getCommandHead('/x@akitai_bot post gm')).toBe('x')
    expect(getCommandHead('tweet gm')).toBe('tweet')
    expect(getCommandHead(' /get_id ')).toBe('get_id')
  })

  it('resolves aliases to shared families', () => {
    expect(getCommandFamily('/x post gm')).toBe('twitter')
    expect(getCommandFamily('tweet gm')).toBe('twitter')
    expect(getCommandFamily('/coin buy 0xabc 0.1')).toBe('coin')
    expect(getCommandFamily('/get_id')).toBe('id')
  })

  it('matches one or more command families', () => {
    expect(matchesCommandFamily('/send 1 usdc to 0xabc', 'send')).toBe(true)
    expect(matchesAnyCommandFamily('/tweet gm', ['twitter', 'coin'])).toBe(true)
    expect(matchesAnyCommandFamily('/vaults', ['twitter', 'coin'])).toBe(false)
  })

  it('builds Telegram bot menus from a shared registry', () => {
    expect(buildTelegramBotCommands('private')).toEqual([
      { command: 'help', description: 'Start here: connect, trade, wallet' },
      { command: 'id', description: 'Pick a user, group, or channel ID' },
      { command: 'link', description: 'Connect Telegram to 4626 Privy + Zora CSW' },
      { command: 'linked', description: 'Check wallet link status' },
      { command: 'vaults', description: 'Browse vaults' },
      { command: 'buy', description: 'Guided buy flow' },
      { command: 'sell', description: 'Guided sell flow' },
      { command: 'bid', description: 'Guided bid flow' },
      { command: 'wallet', description: 'Your wallet, positions, and actions' },
    ])
  })

  it('includes aliases in Telegram command-head matching and native-head detection', () => {
    expect(TELEGRAM_COMMAND_HEADS).toContain('tweet')
    expect(TELEGRAM_COMMAND_HEADS).toContain('getid')
    expect(TELEGRAM_NATIVE_COMMAND_HEADS).toContain('get_id')
    expect(TELEGRAM_NATIVE_COMMAND_HEADS).not.toContain('tweet')
  })
})
