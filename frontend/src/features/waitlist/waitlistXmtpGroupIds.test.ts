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

  it('uses only the vault group id when env drift is flagged', () => {
    expect(
      collectWaitlistGroupIdCandidates({
        groupId: 'ed6fbda34f2614536df5cec08dff2266',
        envGroupId: '543a2ed196de4aa6a02df5145c5fdfaf',
        vaultGroupId: 'ed6fbda34f2614536df5cec08dff2266',
        groupIdMismatch: true,
      }),
    ).toEqual(['ed6fbda34f2614536df5cec08dff2266'])
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

  it('matches by conversation id even when type metadata is missing', () => {
    const match = findWaitlistGroupConversation(
      [{ id: 'ed6fbda34f2614536df5cec08dff2266', type: 'dm' }],
      ['ed6fbda34f2614536df5cec08dff2266'],
    )
    expect(match?.id).toBe('ed6fbda34f2614536df5cec08dff2266')
  })
})
