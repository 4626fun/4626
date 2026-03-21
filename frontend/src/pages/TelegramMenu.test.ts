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
})
