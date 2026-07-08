import { describe, expect, it } from 'vitest'

import { findLinkedTwitterHandle, findLinkedTwitterSubject } from '@/lib/privy/linkedAccounts'

describe('linkedAccounts', () => {
  it('reads the linked twitter handle from username', () => {
    expect(
      findLinkedTwitterHandle({
        linkedAccounts: [{ type: 'twitter_oauth', username: '@wenakita', subject: 'subject-1' }],
      }),
    ).toBe('wenakita')
  })

  it('reads the linked twitter subject for unlink', () => {
    expect(
      findLinkedTwitterSubject({
        linkedAccounts: [{ type: 'twitter_oauth', username: '@wenakita', subject: 'subject-1' }],
      }),
    ).toBe('subject-1')
  })
})
