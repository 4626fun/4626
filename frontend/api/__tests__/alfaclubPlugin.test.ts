import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  readVigilanteFlagsMock,
  getLatestSnapshotTsMock,
  getSnapshotAtMock,
  listRecentPublicationsMock,
  recentPublicationsForCreatorMock,
} = vi.hoisted(() => ({
  readVigilanteFlagsMock: vi.fn(),
  getLatestSnapshotTsMock: vi.fn(),
  getSnapshotAtMock: vi.fn(),
  listRecentPublicationsMock: vi.fn(),
  recentPublicationsForCreatorMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/vigilante.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/vigilante.ts')
  >('../../server/_lib/alfaclub/vigilante.ts')
  return {
    ...actual,
    readVigilanteFlags: readVigilanteFlagsMock,
  }
})

vi.mock('../../server/_lib/alfaclub/publicationLedger.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/publicationLedger.ts')
  >('../../server/_lib/alfaclub/publicationLedger.ts')
  return {
    ...actual,
    getLatestSnapshotTs: getLatestSnapshotTsMock,
    getSnapshotAt: getSnapshotAtMock,
    listRecentPublications: listRecentPublicationsMock,
    recentPublicationsForCreator: recentPublicationsForCreatorMock,
  }
})

import {
  alfaclubPlugin,
  parseSubcommand,
} from '../../server/agent/eliza/plugins/alfaclub/index.ts'

type AnyAction = {
  name?: string
  validate?: (runtime: unknown, message: any) => Promise<boolean> | boolean
  handler?: (
    runtime: unknown,
    message: any,
    state?: unknown,
    options?: Record<string, unknown>,
    callback?: (content: any) => Promise<any[]>,
  ) => Promise<void>
}

function getAction(): AnyAction {
  const action = (alfaclubPlugin.actions ?? []).find(
    (a) => a?.name === 'ALFACLUB_VIGILANTE',
  ) as AnyAction | undefined
  if (!action?.validate || !action?.handler) {
    throw new Error('ALFACLUB_VIGILANTE action not found')
  }
  return action
}

async function runAlfa(params: {
  text: string
  senderAddress?: string
}): Promise<string> {
  const action = getAction()
  const message = {
    content: {
      text: params.text,
      metadata: params.senderAddress
        ? { senderAddress: params.senderAddress }
        : {},
    },
  }
  const valid = await action.validate?.({}, message)
  expect(valid).toBe(true)
  const outputs: string[] = []
  await action.handler?.({}, message, undefined, {}, async (content: any) => {
    outputs.push(String(content?.text ?? ''))
    return []
  })
  return outputs.join('\n\n')
}

const BASE_FLAGS = {
  killSwitch: false,
  readEnabled: true,
  postEnabled: false,
  feedbackEnabled: false,
  topN: 5,
  cooldownHours: 24,
}

describe('parseSubcommand', () => {
  it('defaults an empty /alfa to leaderboard', () => {
    expect(parseSubcommand('/alfa')).toEqual({ sub: 'leaderboard', address: null })
    expect(parseSubcommand('/alfa leaderboard')).toEqual({ sub: 'leaderboard', address: null })
    expect(parseSubcommand('/alfa top')).toEqual({ sub: 'leaderboard', address: null })
  })

  it('maps a bare address to creator detail', () => {
    const res = parseSubcommand('/alfa 0x1111111111111111111111111111111111111111')
    expect(res.sub).toBe('creator')
    expect(res.address).toBe('0x1111111111111111111111111111111111111111')
  })

  it('accepts the explicit creator <addr> form', () => {
    const res = parseSubcommand('/alfa creator 0x2222222222222222222222222222222222222222')
    expect(res.sub).toBe('creator')
    expect(res.address).toBe('0x2222222222222222222222222222222222222222')
  })

  it('maps status/flags/health to status', () => {
    expect(parseSubcommand('/alfa status').sub).toBe('status')
    expect(parseSubcommand('/alfa flags').sub).toBe('status')
    expect(parseSubcommand('/alfa health').sub).toBe('status')
  })

  it('maps unknown tokens to help', () => {
    expect(parseSubcommand('/alfa wat').sub).toBe('help')
  })

  it('accepts /alfaclub as an alias', () => {
    expect(parseSubcommand('/alfaclub').sub).toBe('leaderboard')
    expect(parseSubcommand('/alfaclub status').sub).toBe('status')
  })
})

describe('/alfa plugin — validation', () => {
  it('validate() matches /alfa prefix (case-insensitive)', async () => {
    const action = getAction()
    await expect(
      action.validate?.({}, { content: { text: '/alfa leaderboard' } }),
    ).resolves.toBe(true)
    await expect(
      action.validate?.({}, { content: { text: '/ALFA status' } }),
    ).resolves.toBe(true)
    await expect(
      action.validate?.({}, { content: { text: '/intel 0xabc' } }),
    ).resolves.toBe(false)
  })
})

describe('/alfa plugin — kill switch / read_disabled paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a dormant message when read is disabled', async () => {
    readVigilanteFlagsMock.mockReturnValue({ ...BASE_FLAGS, readEnabled: false })
    const out = await runAlfa({ text: '/alfa' })
    expect(out).toContain('Pipeline is dormant')
  })

  it('renders a kill-switch message when the switch is on', async () => {
    readVigilanteFlagsMock.mockReturnValue({ ...BASE_FLAGS, killSwitch: true, readEnabled: true })
    const out = await runAlfa({ text: '/alfa' })
    expect(out).toContain('KILL_SWITCH')
  })

  it('always includes the scorecard disclaimer', async () => {
    readVigilanteFlagsMock.mockReturnValue({ ...BASE_FLAGS, readEnabled: false })
    const out = await runAlfa({ text: '/alfa' })
    expect(out).toContain('4626 Keepr onchain-derived snapshot')
  })
})

describe('/alfa plugin — leaderboard path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readVigilanteFlagsMock.mockReturnValue(BASE_FLAGS)
  })

  it('renders a no-snapshot-yet message when cron has never run', async () => {
    getLatestSnapshotTsMock.mockResolvedValue(null)
    const out = await runAlfa({ text: '/alfa' })
    expect(out).toContain('No snapshot available yet')
  })

  it('renders the top-N rows with rank, supply, stake, pnl, score', async () => {
    getLatestSnapshotTsMock.mockResolvedValue('2026-04-20T12:00:00Z')
    getSnapshotAtMock.mockResolvedValue([
      {
        snapshotTs: '2026-04-20T12:00:00Z',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        tokenId: 1n,
        totalSupply: 100n,
        stakedSupply: 80n,
        pnl30dUsd: 50_000,
        hlAccountValueUsd: 12_000,
        score: 0.74,
        rank: 1,
      },
      {
        snapshotTs: '2026-04-20T12:00:00Z',
        creatorAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        tokenId: 2n,
        totalSupply: 20n,
        stakedSupply: 10n,
        pnl30dUsd: -5_000,
        hlAccountValueUsd: 500,
        score: 0.12,
        rank: 2,
      },
    ])
    listRecentPublicationsMock.mockResolvedValue([])
    const out = await runAlfa({ text: '/alfa' })
    expect(out).toContain('AlfaClub Integrity Leaderboard')
    expect(out).toContain('2026-04-20T12:00:00Z')
    expect(out).toContain('0xaaaaaaaa')
    expect(out).toContain('0xbbbbbbbb')
    expect(out).toMatch(/rank=5|topN=5|cooldown=24h/)
    expect(out).toContain('pnl30d=$50.00K')
    expect(out).toContain('score=0.7400')
  })
})

describe('/alfa plugin — creator path', () => {
  const TARGET = '0xcccccccccccccccccccccccccccccccccccccccc'

  beforeEach(() => {
    vi.clearAllMocks()
    readVigilanteFlagsMock.mockReturnValue(BASE_FLAGS)
    getLatestSnapshotTsMock.mockResolvedValue('2026-04-20T12:00:00Z')
    recentPublicationsForCreatorMock.mockResolvedValue([])
  })

  it('renders "not currently indexed" when no row exists for the address', async () => {
    getSnapshotAtMock.mockResolvedValue([])
    const out = await runAlfa({ text: `/alfa ${TARGET}` })
    expect(out).toContain('not currently indexed as an AlfaClub creator')
  })

  it('renders the creator detail when the row is found', async () => {
    getSnapshotAtMock.mockResolvedValue([
      {
        snapshotTs: '2026-04-20T12:00:00Z',
        creatorAddress: TARGET,
        tokenId: 42n,
        totalSupply: 1_234n,
        stakedSupply: 980n,
        pnl30dUsd: 185_000,
        hlAccountValueUsd: 45_221,
        score: 0.3595,
        rank: 5,
      },
    ])
    recentPublicationsForCreatorMock.mockResolvedValue([
      {
        publicationKey: '0x' + 'a'.repeat(64),
        kind: 'lens',
        creatorAddress: TARGET,
        tokenId: 42n,
        scorecardCid: 'grove-abc',
        scorecardUri: 'lens://grove/abc',
        scorecardHash: '0xdead',
        lensPostId: 'lens-post-1',
        erc8004TxHash: null,
        erc8004Calldata: null,
        score: 0.3595,
        rank: 5,
        createdAt: '2026-04-20T12:00:00Z',
      },
    ])
    const out = await runAlfa({ text: `/alfa ${TARGET}` })
    expect(out).toContain('AlfaClub Creator')
    expect(out).toContain(TARGET)
    expect(out).toContain('FriendKey tokenId):** 42')
    expect(out).toContain('Supply:** 1234 (staked 980)')
    expect(out).toContain('pnl30d=$185.00K')
    expect(out).toContain('Composite score:** 0.3595')
    expect(out).toContain('Recent publications')
  })

  it('falls back to the sender address when no arg is supplied', async () => {
    getSnapshotAtMock.mockResolvedValue([])
    const out = await runAlfa({
      text: '/alfa creator',
      senderAddress: TARGET,
    })
    expect(out).toContain(TARGET)
    expect(out).toContain('not currently indexed')
  })

  it('shows a usage hint when neither address nor sender is available', async () => {
    const out = await runAlfa({ text: '/alfa creator' })
    expect(out).toContain('Usage:')
  })
})

describe('/alfa plugin — status path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders every flag with explicit on/off state', async () => {
    readVigilanteFlagsMock.mockReturnValue({
      killSwitch: false,
      readEnabled: true,
      postEnabled: true,
      feedbackEnabled: false,
      topN: 20,
      cooldownHours: 24,
    })
    const out = await runAlfa({ text: '/alfa status' })
    expect(out).toContain('Pipeline Status')
    expect(out).toContain('KILL_SWITCH: off')
    expect(out).toContain('READ_ENABLED: on')
    expect(out).toContain('POST_ENABLED: on')
    expect(out).toContain('FEEDBACK_ENABLED: off')
    expect(out).toContain('TOP_N: 20')
  })
})

describe('/alfa plugin — help path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readVigilanteFlagsMock.mockReturnValue(BASE_FLAGS)
  })

  it('renders usage help on an unrecognized subcommand', async () => {
    const out = await runAlfa({ text: '/alfa lolwat' })
    expect(out).toContain('/alfa')
    expect(out).toContain('leaderboard')
    expect(out).toContain('creator')
  })
})
