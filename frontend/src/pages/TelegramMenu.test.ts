import { describe, expect, it } from 'vitest'

import { buildTelegramMenuLaunch, resolveTelegramMenuChatTypes } from './TelegramMenu'

describe('TelegramMenu helpers', () => {
  it('keeps Search in the current chat', () => {
    expect(resolveTelegramMenuChatTypes('search')).toEqual([])
    expect(buildTelegramMenuLaunch({ mode: 'search', query: '  ai test  ' })).toEqual({
      query: 'ai test',
      chatTypes: [],
    })
  })

  it('uses Telegram chat picker for Share', () => {
    expect(resolveTelegramMenuChatTypes('share')).toEqual(['users', 'groups', 'channels'])
    expect(buildTelegramMenuLaunch({ mode: 'share' })).toEqual({
      query: '',
      chatTypes: ['users', 'groups', 'channels'],
    })
  })

  it('preserves bare token address launches for inline token analysis', () => {
    expect(buildTelegramMenuLaunch({ mode: 'search', query: '  0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913  ' })).toEqual({
      query: '0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913',
      chatTypes: [],
    })
  })
})
