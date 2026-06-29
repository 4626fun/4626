import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listMappingsMock, readSessionMappingMock, readPoolMock, readHookMock } = vi.hoisted(() => ({
  listMappingsMock: vi.fn<() => Promise<any[]>>(async () => []),
  readSessionMappingMock: vi.fn<() => Promise<any | null>>(async () => null),
  readPoolMock: vi.fn<() => Promise<any | null>>(async () => null),
  readHookMock: vi.fn<() => Promise<any | null>>(async () => null),
}))

vi.mock('../../server/_lib/onchain/solanaShareMeshMappings.js', () => ({
  listSolanaShareMeshMappingsForCreator: listMappingsMock,
}))

vi.mock('../../server/_lib/onchain/solanaMeteoraPoolStatus.js', () => ({
  readSolanaShareMeshMappingBySessionId: readSessionMappingMock,
  readSolanaMeteoraPoolStatusByShareMeshMint: readPoolMock,
}))

vi.mock('../../server/_lib/onchain/solanaHookStatus.js', () => ({
  readSolanaHookStatusByCreatorToken: readHookMock,
}))

import { readSolanaPostDeployStatus } from '../../server/_lib/deploy/solanaPostDeployStatus.js'

describe('readSolanaPostDeployStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SOLANA_METEORA_POOL_PROVISIONING_ENABLED = '1'
  })

  it('returns waiting before deploy completes', async () => {
    const status = await readSolanaPostDeployStatus({
      db: { sql: vi.fn() } as any,
      sessionId: 'dep_1',
      deployStep: 'phase4_sent',
      deployState: 'running',
      ovaultEnabled: true,
    })
    expect(status.overall).toBe('waiting')
    expect(status.deployComplete).toBe(false)
  })

  it('returns complete when the Meteora pool is created', async () => {
    readSessionMappingMock.mockResolvedValueOnce({
      creatorToken: '0x1111111111111111111111111111111111111111',
      shareOft: '0x2222222222222222222222222222222222222222',
      shareMeshMint: 'ShareMesh111111111111111111111111111111111',
      status: 'applied',
      lastError: null,
    })
    readPoolMock.mockResolvedValueOnce({
      id: 1,
      creatorToken: '0x1111111111111111111111111111111111111111',
      shareOft: '0x2222222222222222222222222222222222222222',
      shareMeshMint: 'ShareMesh111111111111111111111111111111111',
      quoteMint: 'So11111111111111111111111111111111111111112',
      poolAddress: 'Pool1111111111111111111111111111111111111',
      status: 'created',
      provisionAttemptCount: 1,
      lastSignature: 'sig123',
      lastError: null,
      sourceSessionId: 'dep_1',
      updatedAt: new Date().toISOString(),
    })

    const status = await readSolanaPostDeployStatus({
      db: { sql: vi.fn() } as any,
      sessionId: 'dep_1',
      deployStep: 'completed',
      deployState: 'completed',
      ovaultEnabled: true,
    })

    expect(status.overall).toBe('complete')
    expect(status.meteoraPool?.poolAddress).toBe('Pool1111111111111111111111111111111111111')
    expect(status.meteoraPool?.quoteMint).toBe('So11111111111111111111111111111111111111112')
    expect(status.meteoraPool?.pairLabel).toBe('Share mesh / SOL')
    expect(status.meteoraPool?.lastSignature).toBe('sig123')
    expect(status.lpSeedingNote).toContain('launch bundle')
  })

  it('returns hook lane addresses from solana_hook_status when present', async () => {
    readSessionMappingMock.mockResolvedValueOnce({
      creatorToken: '0x1111111111111111111111111111111111111111',
      shareOft: '0x2222222222222222222222222222222222222222',
      shareMeshMint: 'ShareMesh111111111111111111111111111111111',
      status: 'applied',
      lastError: null,
    })
    readHookMock.mockResolvedValueOnce({
      id: 1,
      creatorToken: '0x1111111111111111111111111111111111111111',
      shareOft: '0x2222222222222222222222222222222222222222',
      hookMint: 'HookMint111111111111111111111111111111111',
      creatorConfig: 'CreatorConfig111111111111111111111111111111',
      pendingEntries: 'PendingEntries111111111111111111111111111',
      winnerRecord: 'WinnerRecord11111111111111111111111111111',
      status: 'created',
      provisionAttemptCount: 1,
      lastError: null,
      sourceSessionId: 'dep_1',
      updatedAt: new Date().toISOString(),
    })

    const status = await readSolanaPostDeployStatus({
      db: { sql: vi.fn() } as any,
      sessionId: 'dep_1',
      deployStep: 'completed',
      deployState: 'completed',
      creatorToken: '0x1111111111111111111111111111111111111111',
      ovaultEnabled: true,
    })

    expect(status.hookLane?.hookMint).toBe('HookMint111111111111111111111111111111111')
    expect(status.hookLane?.creatorConfig).toBe('CreatorConfig111111111111111111111111111111')
  })
})
