import { describe, expect, it } from 'vitest'

import { getChatUnreadTotal, setChatUnreadTotal, subscribeChatUnreadTotal } from './openChat'

describe('chat unread total store', () => {
  it('notifies subscribers when unread changes', () => {
    setChatUnreadTotal(0)
    const seen: number[] = []
    const unsubscribe = subscribeChatUnreadTotal((count) => {
      seen.push(count)
    })
    setChatUnreadTotal(1)
    setChatUnreadTotal(1)
    setChatUnreadTotal(3)
    expect(getChatUnreadTotal()).toBe(3)
    expect(seen).toEqual([0, 1, 3])
    unsubscribe()
  })
})
