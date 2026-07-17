import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  isExpectedHookMintProgramOwner,
  verifySolanaB2Readiness,
} from './solanaB2Readiness.js'

const listMappingsMock = vi.fn()
const readPoolMock = vi.fn()
const readHookMock = vi.fn()
const validateRegistryShareOftMock = vi.fn()

vi.mock('./solanaShareMeshMappings.js', () => ({
  listSolanaShareMeshMappingsForCreator: (...args: unknown[]) => listMappingsMock(...args),
}))

vi.mock('./solanaMeteoraPoolStatus.js', () => ({
  readSolanaMeteoraPoolStatusByShareMeshMint: (...args: unknown[]) => readPoolMock(...args),
}))

vi.mock('./solanaHookStatus.js', () => ({
  readSolanaHookStatusByCreatorToken: (...args: unknown[]) => readHookMock(...args),
}))

vi.mock('./registry4626Verification.js', () => ({
  validateRegistry4626ShareOftBinding: (...args: unknown[]) =>
    validateRegistryShareOftMock(...args),
}))

describe('verifySolanaB2Readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOLANA_RPC_URL
    validateRegistryShareOftMock.mockResolvedValue({ ok: true, mode: 'registry' })
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

  it('fails closed when db lanes pass but Solana RPC verification is unavailable', async () => {
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
      shareOft: '0x459ea17556082ebd586870f3aba81b822f104626',
      creatorConfig: 'CreatorConfig111111111111111111111111111111',
      pendingEntries: 'PendingEntries111111111111111111111111111',
    })

    const result = await verifySolanaB2Readiness({
      db: { sql: vi.fn() } as any,
      creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    })

    expect(result.ready).toBe(false)
    expect(result.checks.find((check) => check.id === 'onchain_accounts')).toEqual({
      id: 'onchain_accounts',
      passed: false,
      detail: 'failed_no_solana_rpc_url',
    })
  })

  it('fails closed when the applied mapping disagrees with Registry4626', async () => {
    const shareMeshMint = 'ShareMesh111111111111111111111111111111111'
    listMappingsMock.mockResolvedValue([{
      status: 'applied',
      shareOft: '0x459ea17556082ebd586870f3aba81b822f104626',
      shareMeshMint,
    }])
    readPoolMock.mockResolvedValue(null)
    readHookMock.mockResolvedValue(null)
    validateRegistryShareOftMock.mockResolvedValue({
      ok: false,
      reason: 'share_token_mismatch',
    })

    const result = await verifySolanaB2Readiness({
      db: { sql: vi.fn() } as any,
      creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    })

    expect(result.checks.find((check) => check.id === 'registry_share_oft_matches')).toEqual({
      id: 'registry_share_oft_matches',
      passed: false,
      detail: 'share_token_mismatch',
    })
  })

  it('fails closed when hook ShareOFT is absent for an applied mapping', async () => {
    const shareMeshMint = 'ShareMesh111111111111111111111111111111111'
    listMappingsMock.mockResolvedValue([{
      status: 'applied',
      shareOft: '0x459ea17556082ebd586870f3aba81b822f104626',
      shareMeshMint,
    }])
    readPoolMock.mockResolvedValue(null)
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

    expect(result.ready).toBe(false)
    expect(result.checks.find((check) => check.id === 'hook_share_oft_matches_mapping')).toEqual({
      id: 'hook_share_oft_matches_mapping',
      passed: false,
      detail: 'hook_share_oft_missing',
    })
  })

  it('fails closed when hook ShareOFT disagrees with the applied mapping', async () => {
    const shareMeshMint = 'ShareMesh111111111111111111111111111111111'
    listMappingsMock.mockResolvedValue([{
      status: 'applied',
      shareOft: '0x459ea17556082ebd586870f3aba81b822f104626',
      shareMeshMint,
    }])
    readPoolMock.mockResolvedValue(null)
    readHookMock.mockResolvedValue({
      status: 'created',
      hookMint: shareMeshMint,
      shareOft: '0x1111111111111111111111111111111111111111',
      creatorConfig: 'CreatorConfig111111111111111111111111111111',
      pendingEntries: 'PendingEntries111111111111111111111111111',
    })

    const result = await verifySolanaB2Readiness({
      db: { sql: vi.fn() } as any,
      creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    })

    expect(result.ready).toBe(false)
    expect(result.checks.find((check) => check.id === 'hook_share_oft_matches_mapping')?.passed).toBe(false)
  })
})

describe('isExpectedHookMintProgramOwner', () => {
  it('accepts only the Token-2022 program owner', () => {
    expect(
      isExpectedHookMintProgramOwner('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
    ).toBe(true)
    expect(
      isExpectedHookMintProgramOwner('EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'),
    ).toBe(false)
    expect(isExpectedHookMintProgramOwner('11111111111111111111111111111111')).toBe(false)
  })
})
