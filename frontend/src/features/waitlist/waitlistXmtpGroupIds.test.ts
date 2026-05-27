import { describe, expect, it } from 'vitest'

import { collectWaitlistGroupIdCandidates, findWaitlistGroupConversation } from './waitlistXmtpGroupIds'

describe('waitlistXmtpGroupIds', () => {
  it('dedupes group id candidates case-insensitively', () => {
    expect(
      collectWaitlistGroupIdCandidates({
        groupId: 'Ed6FbDa3AAA',
        envGroupId: '543a2ed196de4aa6a02df5145c5fdfaf',
        vaultGroupId: 'ed6fbda3aaa',
      }),
    ).toEqual(['Ed6FbDa3AAA', '543a2ed196de4aa6a02df5145c5fdfaf'])
  })

  it('finds a group conversation across candidate ids', () => {
    const match = findWaitlistGroupConversation(
      [
        { id: 'dm-1', type: 'dm' },
        { id: '543a2ed196de4aa6a02df5145c5fdfaf', type: 'group' },
      ],
      ['ed6fbda3missing', '543a2ed196de4aa6a02df5145c5fdfaf'],
    )
    expect(match?.id).toBe('543a2ed196de4aa6a02df5145c5fdfaf')
  })
})
