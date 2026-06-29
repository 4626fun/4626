import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listMappingsMock, readSessionMappingMock, readPoolMock } = vi.hoisted(() => ({
  listMappingsMock: vi.fn<() => Promise<any[]>>(async () => []),
  readSessionMappingMock: vi.fn<() => Promise<any | null>>(async () => null),
  readPoolMock: vi.fn<() => Promise<any | null>>(async () => null),
}))

vi.mock('../../server/_lib/onchain/solanaShareMeshMappings.js', () => ({
  listSolanaShareMeshMappingsForCreator: listMappingsMock,
}))

vi.mock('../../server/_lib/onchain/solanaMeteoraPoolStatus.js', () => ({
  readSolanaShareMeshMappingBySessionId: readSessionMappingMock,
  readSolanaMeteoraPoolStatusByShareMeshMint: readPoolMock,
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
  })
})
