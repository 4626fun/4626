import { describe, expect, it, vi, beforeEach } from 'vitest'

import { verifySolanaB2Readiness } from './solanaB2Readiness.js'

const listMappingsMock = vi.fn()
const readPoolMock = vi.fn()
const readHookMock = vi.fn()

vi.mock('./solanaShareMeshMappings.js', () => ({
  listSolanaShareMeshMappingsForCreator: (...args: unknown[]) => listMappingsMock(...args),
}))

vi.mock('./solanaMeteoraPoolStatus.js', () => ({
  readSolanaMeteoraPoolStatusByShareMeshMint: (...args: unknown[]) => readPoolMock(...args),
}))

vi.mock('./solanaHookStatus.js', () => ({
  readSolanaHookStatusByCreatorToken: (...args: unknown[]) => readHookMock(...args),
}))

describe('verifySolanaB2Readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOLANA_RPC_URL
  })

  it('returns not ready when mapping is not applied', async () => {
    listMappingsMock.mockResolvedValue([
      {
        status: 'pending',
        shareOft: '0x459ea17556082ebd586870f3aba81b822f104626',
        shareMeshMint: 'ShareMesh111111111111111111111111111111111',
      },
    ])
    readPoolMock.mockResolvedValue(null)
    readHookMock.mockResolvedValue(null)

    const result = await verifySolanaB2Readiness({
      db: { sql: vi.fn() } as any,
      creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    })

    expect(result.ready).toBe(false)
    expect(result.checks.find((check) => check.id === 'share_mesh_mapping')?.passed).toBe(false)
  })

  it('returns ready when db lanes and skipped rpc checks pass', async () => {
    const shareMeshMint = 'ShareMesh111111111111111111111111111111111'
    listMappingsMock.mockResolvedValue([
      {
        status: 'applied',
        shareOft: '0x459ea17556082ebd586870f3aba81b822f104626',
        shareMeshMint,
      },
    ])
    readPoolMock.mockResolvedValue({
      status: 'created',
      poolAddress: 'Pool1111111111111111111111111111111111111',
    })
    readHookMock.mockResolvedValue({
      status: 'created',
      hookMint: shareMeshMint,
      creatorConfig: 'CreatorConfig111111111111111111111111111111',
      pendingEntries: 'PendingEntries111111111111111111111111111',
    })

    const result = await verifySolanaB2Readiness({
      db: { sql: vi.fn() } as any,
      creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    })

    expect(result.ready).toBe(true)
    expect(result.checks.every((check) => check.passed)).toBe(true)
  })
})
