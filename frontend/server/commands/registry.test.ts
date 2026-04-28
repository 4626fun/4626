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
    expect(getCommandFamily('/alfa')).toBe('alfaclub')
    expect(getCommandFamily('/alfaclub status')).toBe('alfaclub')
    expect(getCommandFamily('/gmeow gm')).toBe('hermit')
    expect(getCommandFamily('/meme akita')).toBe('hermit')
    expect(getCommandFamily('/hermit help')).toBe('hermit')
  })

  it('matches one or more command families', () => {
    expect(matchesCommandFamily('/send 1 usdc to 0xabc', 'send')).toBe(true)
    expect(matchesAnyCommandFamily('/tweet gm', ['twitter', 'coin'])).toBe(true)
    expect(matchesAnyCommandFamily('/vaults', ['twitter', 'coin'])).toBe(false)
  })

  it('builds Telegram bot menus from a shared registry', () => {
    const expectedMenu = [
      { command: 'start', description: 'Open the main menu' },
      { command: 'help', description: 'Show available commands' },
      { command: 'link', description: 'Link Telegram to your 4626 account' },
    ]
    expect(buildTelegramBotCommands('private')).toEqual(expectedMenu)
    expect(buildTelegramBotCommands('group')).toEqual(expectedMenu)
    expect(buildTelegramBotCommands('admin')).toEqual(expectedMenu)
  })

  it('includes aliases in Telegram command-head matching and native-head detection', () => {
    expect(TELEGRAM_COMMAND_HEADS).toContain('tweet')
    expect(TELEGRAM_COMMAND_HEADS).toContain('getid')
    expect(TELEGRAM_NATIVE_COMMAND_HEADS).toContain('get_id')
    expect(TELEGRAM_NATIVE_COMMAND_HEADS).not.toContain('tweet')
  })
})
