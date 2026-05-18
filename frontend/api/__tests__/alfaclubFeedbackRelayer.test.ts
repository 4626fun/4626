import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from './helpers'

const {
  listQueuedFeedbackMock,
  attachErc8004TxHashMock,
  markSubmissionAttemptFailedMock,
  abandonQueuedFeedbackMock,
  ensureSchemaMock,
} = vi.hoisted(() => ({
  listQueuedFeedbackMock: vi.fn(),
  attachErc8004TxHashMock: vi.fn(),
  markSubmissionAttemptFailedMock: vi.fn(),
  abandonQueuedFeedbackMock: vi.fn(),
  ensureSchemaMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/publicationLedger.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/publicationLedger.ts')
  >('../../server/_lib/alfaclub/publicationLedger.ts')
  return {
    ...actual,
    listQueuedFeedback: listQueuedFeedbackMock,
    attachErc8004TxHash: attachErc8004TxHashMock,
    markSubmissionAttemptFailed: markSubmissionAttemptFailedMock,
    abandonQueuedFeedback: abandonQueuedFeedbackMock,
  }
})

vi.mock('../../server/_lib/alfaclub/schema.js', () => ({
  ensureAlfaClubVigilanteSchema: ensureSchemaMock,
  _resetAlfaClubSchemaCacheForTests: vi.fn(),
}))

import {
  relayAlfaClubFeedbackOnce,
  isGiveFeedbackCalldata,
  GIVE_FEEDBACK_FUNCTION_SELECTOR,
} from '../../server/_lib/alfaclub/feedbackRelayer.ts'

function queuedRow(overrides: {
  publicationKey: string
  creatorAddress: string
  calldata?: string | null
  submissionAttempts?: number
}) {
  return {
    publicationKey: overrides.publicationKey,
    kind: 'erc8004-queued' as const,
    creatorAddress: overrides.creatorAddress as `0x${string}`,
    tokenId: 42n,
    scorecardCid: 'grove-cid',
    scorecardUri: 'lens://grove/cid',
    scorecardHash: '0xhash',
    lensPostId: null,
    erc8004TxHash: null,
    erc8004Calldata:
      overrides.calldata === undefined
        ? // Default to a valid giveFeedback call (selector + zero-padded args stub)
          GIVE_FEEDBACK_FUNCTION_SELECTOR + '00'.repeat(32)
        : overrides.calldata,
    score: 0.5,
    rank: 1,
    createdAt: '2026-04-20T12:00:00Z',
    submissionAttempts: overrides.submissionAttempts ?? 0,
    lastSubmissionError: null,
    lastSubmissionAt: null,
  }
}

const OWNER = {
  ownerAddress: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9' as `0x${string}`,
  ownerIndex: 2,
}

const PRIVY_ENV = {
  XMTP_AGENT_PRIVY_WALLET_ID: 'walletid-test',
  PRIVY_APP_ID: 'privy-app',
  PRIVY_APP_SECRET: 'privy-secret',
  PRIVY_WALLET_AUTHORIZATION_KEY: 'authkey',
  CDP_PAYMASTER_URL: 'https://bundler.test.example',
}

const RELAYER_ENABLED = {
  ALFACLUB_VIGILANTE_RELAYER_ENABLED: '1',
  ALFACLUB_VIGILANTE_RELAYER_SPACING_MS: '1',
}

const FAST_FLAGS = {
  killSwitch: false,
  relayerEnabled: true,
  dryRun: false,
  intervalMs: 60_000,
  maxPerTick: 5,
  spacingMs: 0,
  maxAttempts: 3,
}

describe('isGiveFeedbackCalldata', () => {
  it('accepts the giveFeedback selector + at least one byte of args', () => {
    expect(isGiveFeedbackCalldata(GIVE_FEEDBACK_FUNCTION_SELECTOR + '01')).toBe(true)
  })

  it('rejects non-hex strings', () => {
    expect(isGiveFeedbackCalldata('oops' as unknown as string)).toBe(false)
    expect(isGiveFeedbackCalldata(null)).toBe(false)
    expect(isGiveFeedbackCalldata('')).toBe(false)
  })

  it('rejects calldata for a different function selector', () => {
    expect(isGiveFeedbackCalldata('0xdeadbeef' + '00'.repeat(32))).toBe(false)
  })

  it('rejects short calldata', () => {
    expect(isGiveFeedbackCalldata('0x123456')).toBe(false)
  })
})

describe('relayAlfaClubFeedbackOnce — short-circuits', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv?.()
    restoreEnv = null
  })

  it('returns skipped=kill_switch when the kill flag is on', async () => {
    restoreEnv = applyEnv({
      ALFACLUB_VIGILANTE_KILL_SWITCH: '1',
      ...RELAYER_ENABLED,
      ...PRIVY_ENV,
    })
    const result = await relayAlfaClubFeedbackOnce()
    expect(result.skipped).toBe('kill_switch')
    expect(result.picked).toBe(0)
    expect(listQueuedFeedbackMock).not.toHaveBeenCalled()
  })

  it('returns skipped=disabled when RELAYER_ENABLED is off', async () => {
    restoreEnv = applyEnv({ ...PRIVY_ENV })
    const result = await relayAlfaClubFeedbackOnce()
    expect(result.skipped).toBe('disabled')
    expect(listQueuedFeedbackMock).not.toHaveBeenCalled()
  })

  it('returns skipped=privy_env_missing when required Privy env is absent', async () => {
    restoreEnv = applyEnv({
      ...RELAYER_ENABLED,
      XMTP_AGENT_PRIVY_WALLET_ID: undefined,
      PRIVY_APP_ID: undefined,
      PRIVY_APP_SECRET: undefined,
      PRIVY_WALLET_AUTHORIZATION_KEY: undefined,
      CDP_PAYMASTER_URL: undefined,
    })
    const result = await relayAlfaClubFeedbackOnce()
    expect(result.skipped).toBe('privy_env_missing')
  })

  it('returns skipped=no_queued_rows when the queue is empty', async () => {
    restoreEnv = applyEnv({ ...RELAYER_ENABLED, ...PRIVY_ENV })
    listQueuedFeedbackMock.mockResolvedValue([])
    const result = await relayAlfaClubFeedbackOnce({
      resolveOwnerContext: async () => OWNER,
      submitCall: async () => ({ ok: true, txHash: '0xshould-not-fire' }),
    })
    expect(result.skipped).toBe('no_queued_rows')
    expect(result.picked).toBe(0)
  })

  it('returns skipped=owner_context_failed when Privy owner resolution throws', async () => {
    restoreEnv = applyEnv({ ...RELAYER_ENABLED, ...PRIVY_ENV })
    listQueuedFeedbackMock.mockResolvedValue([
      queuedRow({
        publicationKey: '0xkey-1',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ])
    const result = await relayAlfaClubFeedbackOnce({
      resolveOwnerContext: async () => {
        throw new Error('privy api down')
      },
      submitCall: async () => ({ ok: true, txHash: '0xshould-not-fire' }),
    })
    expect(result.skipped).toBe('owner_context_failed')
  })
})

describe('relayAlfaClubFeedbackOnce — happy path', () => {
  let restoreEnv: (() => void) | null = null
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv?.()
    restoreEnv = applyEnv({ ...RELAYER_ENABLED, ...PRIVY_ENV })
  })

  it('submits each queued row serially and attaches the tx hash', async () => {
    listQueuedFeedbackMock.mockResolvedValue([
      queuedRow({
        publicationKey: '0xkey-1',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
      queuedRow({
        publicationKey: '0xkey-2',
        creatorAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    ])
    const submitted: string[] = []
    const submitCall = vi.fn(async (params: any) => {
      submitted.push(String(params.calls[0].data).slice(0, 10))
      // Assert the target is always the registry (re-derived, never trusted).
      expect(params.calls[0].to).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(params.calls[0].value).toBe(0n)
      return { ok: true as const, txHash: `0x${submitted.length.toString().padStart(64, '0')}` }
    })
    const result = await relayAlfaClubFeedbackOnce({
      flags: FAST_FLAGS,
      resolveOwnerContext: async () => OWNER,
      submitCall,
    })
    expect(result.skipped).toBeNull()
    expect(result.picked).toBe(2)
    expect(result.submitted).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.abandoned).toBe(0)
    expect(result.ownerAddress?.toLowerCase()).toBe(OWNER.ownerAddress.toLowerCase())
    expect(result.ownerIndex).toBe(OWNER.ownerIndex)
    expect(attachErc8004TxHashMock).toHaveBeenCalledTimes(2)
    expect(submitted.every((sel) => sel === GIVE_FEEDBACK_FUNCTION_SELECTOR)).toBe(true)
  })

  it('respects maxPerTick override', async () => {
    listQueuedFeedbackMock.mockImplementation(async (limit: number) => {
      return Array.from({ length: Math.min(limit, 10) }, (_, i) =>
        queuedRow({
          publicationKey: `0xkey-${i}`,
          creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }),
      )
    })
    const submitCall = vi.fn(async () => ({ ok: true as const, txHash: '0x' + '0'.repeat(64) }))
    const result = await relayAlfaClubFeedbackOnce({
      flags: FAST_FLAGS,
      maxPerTick: 3,
      resolveOwnerContext: async () => OWNER,
      submitCall,
    })
    expect(result.picked).toBe(3)
    expect(submitCall).toHaveBeenCalledTimes(3)
  })
})

describe('relayAlfaClubFeedbackOnce — calldata validation', () => {
  let restoreEnv: (() => void) | null = null
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv?.()
    restoreEnv = applyEnv({ ...RELAYER_ENABLED, ...PRIVY_ENV })
  })

  it('abandons rows whose calldata does not match the giveFeedback selector', async () => {
    listQueuedFeedbackMock.mockResolvedValue([
      queuedRow({
        publicationKey: '0xkey-bad',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        calldata: '0xdeadbeef' + '00'.repeat(32),
      }),
    ])
    const submitCall = vi.fn(async () => ({ ok: true as const, txHash: '0x' + '0'.repeat(64) }))
    const result = await relayAlfaClubFeedbackOnce({
      resolveOwnerContext: async () => OWNER,
      submitCall,
    })
    expect(result.abandoned).toBe(1)
    expect(result.submitted).toBe(0)
    expect(submitCall).not.toHaveBeenCalled()
    expect(abandonQueuedFeedbackMock).toHaveBeenCalledWith(
      '0xkey-bad',
      'invalid_calldata_selector',
    )
  })

  it('abandons rows with null calldata', async () => {
    listQueuedFeedbackMock.mockResolvedValue([
      queuedRow({
        publicationKey: '0xkey-null',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        calldata: null,
      }),
    ])
    const submitCall = vi.fn(async () => ({ ok: true as const, txHash: '0x' + '0'.repeat(64) }))
    const result = await relayAlfaClubFeedbackOnce({
      resolveOwnerContext: async () => OWNER,
      submitCall,
    })
    expect(result.abandoned).toBe(1)
    expect(submitCall).not.toHaveBeenCalled()
  })
})

describe('relayAlfaClubFeedbackOnce — failure handling', () => {
  let restoreEnv: (() => void) | null = null
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv?.()
    restoreEnv = applyEnv({ ...RELAYER_ENABLED, ...PRIVY_ENV })
  })

  it('increments submission_attempts on submit failure without abandoning', async () => {
    listQueuedFeedbackMock.mockResolvedValue([
      queuedRow({
        publicationKey: '0xkey-retry',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        submissionAttempts: 0,
      }),
    ])
    const submitCall = vi.fn(async () => ({ ok: false as const, error: 'bundler_timeout' }))
    const result = await relayAlfaClubFeedbackOnce({
      resolveOwnerContext: async () => OWNER,
      submitCall,
    })
    expect(result.failed).toBe(1)
    expect(result.abandoned).toBe(0)
    expect(markSubmissionAttemptFailedMock).toHaveBeenCalledWith(
      '0xkey-retry',
      'bundler_timeout',
    )
    expect(abandonQueuedFeedbackMock).not.toHaveBeenCalled()
  })

  it('abandons the row once submission_attempts reaches MAX_ATTEMPTS', async () => {
    // Default MAX_ATTEMPTS = 3. With 2 prior attempts, the next failure makes
    // it the 3rd → abandon.
    listQueuedFeedbackMock.mockResolvedValue([
      queuedRow({
        publicationKey: '0xkey-terminal',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        submissionAttempts: 2,
      }),
    ])
    const submitCall = vi.fn(async () => ({ ok: false as const, error: 'gas_too_low' }))
    const result = await relayAlfaClubFeedbackOnce({
      resolveOwnerContext: async () => OWNER,
      submitCall,
    })
    expect(result.failed).toBe(1)
    expect(result.abandoned).toBe(1)
    expect(abandonQueuedFeedbackMock).toHaveBeenCalledWith('0xkey-terminal', 'gas_too_low')
    expect(markSubmissionAttemptFailedMock).not.toHaveBeenCalled()
  })
})

describe('relayAlfaClubFeedbackOnce — dry run', () => {
  let restoreEnv: (() => void) | null = null
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv?.()
    restoreEnv = applyEnv({ ...RELAYER_ENABLED, ...PRIVY_ENV })
  })

  it('resolves owner context and picks rows but never invokes the submitter', async () => {
    listQueuedFeedbackMock.mockResolvedValue([
      queuedRow({
        publicationKey: '0xkey-1',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
      queuedRow({
        publicationKey: '0xkey-2',
        creatorAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    ])
    const submitCall = vi.fn(async () => ({ ok: true as const, txHash: '0x' + '0'.repeat(64) }))
    const result = await relayAlfaClubFeedbackOnce({
      dryRun: true,
      resolveOwnerContext: async () => OWNER,
      submitCall,
    })
    expect(result.skipped).toBeNull()
    expect(result.picked).toBe(2)
    expect(result.submitted).toBe(0)
    expect(result.dryRun).toBe(true)
    expect(submitCall).not.toHaveBeenCalled()
    expect(attachErc8004TxHashMock).not.toHaveBeenCalled()
    expect(result.ownerAddress?.toLowerCase()).toBe(OWNER.ownerAddress.toLowerCase())
  })

  it('dry-run still abandons invalid-selector rows (prevents stuck queue)', async () => {
    listQueuedFeedbackMock.mockResolvedValue([
      queuedRow({
        publicationKey: '0xkey-bad',
        creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        calldata: '0xdeadbeef' + '00'.repeat(32),
      }),
    ])
    const submitCall = vi.fn(async () => ({ ok: true as const, txHash: '0x' + '0'.repeat(64) }))
    const result = await relayAlfaClubFeedbackOnce({
      dryRun: true,
      resolveOwnerContext: async () => OWNER,
      submitCall,
    })
    expect(result.abandoned).toBe(1)
    expect(abandonQueuedFeedbackMock).toHaveBeenCalledTimes(1)
  })
})
