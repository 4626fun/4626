import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildArenaAgentPageUrl,
  fetchArenaAgentProfile,
  resolveArenaDegenProfileId,
} from './arenaAgentProfile.js'

describe('arenaAgentProfile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves numeric degen profile id from env override or agent id', () => {
    expect(
      resolveArenaDegenProfileId({
        agentId: '019e90fa-3c8c-7ba0-8547-bf6f81698c3d',
        degenProfileId: '1213',
      }),
    ).toBe('1213')
    expect(
      resolveArenaDegenProfileId({
        agentId: '1213',
        degenProfileId: null,
      }),
    ).toBe('1213')
    expect(
      resolveArenaDegenProfileId({
        agentId: '019e90fa-3c8c-7ba0-8547-bf6f81698c3d',
        degenProfileId: null,
      }),
    ).toBeNull()
  })

  it('builds agent page url', () => {
    expect(buildArenaAgentPageUrl('1213')).toBe('https://degen.virtuals.io/agents/1213')
  })

  it('parses agent profile payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: '1213',
            name: 'InverseAKITA',
            agentAddress: '0x74ab91cd845ff0d2006404440af49c3bc8c1df96',
          },
        }),
      }),
    )

    await expect(fetchArenaAgentProfile('1213')).resolves.toEqual({
      id: '1213',
      name: 'InverseAKITA',
      url: 'https://degen.virtuals.io/agents/1213',
      walletAddress: '0x74ab91cd845ff0d2006404440af49c3bc8c1df96',
    })
  })
})
