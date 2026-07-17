import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyShareOftRegistryBinding = vi.fn()

vi.mock('../utils/registry.js', () => ({
  verifyShareOftRegistryBinding: (...args: unknown[]) => verifyShareOftRegistryBinding(...args),
}))

import { executeSolanaSyncMapping } from '../actions/keepr-solana-sync-mapping.action.js'

const validPayload = {
  creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
  shareOft: '0x459ea17556082ebd586870f3aba81b822f104626',
  shareMeshMint: 'ShareMesh111111111111111111111111111111111',
}

describe('executeSolanaSyncMapping registry gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOLANA_SHARE_OFT_MAPPING
    delete process.env.SOLANA_CREATOR_MINTS
    process.env.SOLANA_ORCHESTRATOR_ENV_FILE_PATH = '/tmp/solana-keeper-orchestrator.env'
  })

  it('rejects registry mismatches before writing env', async () => {
    verifyShareOftRegistryBinding.mockResolvedValue({
      verified: false,
      reason: 'share_token_mismatch',
    })

    await expect(executeSolanaSyncMapping(validPayload)).rejects.toThrow(
      'registry_share_oft_mismatch:share_token_mismatch',
    )
  })

  it('allows no-op sync after registry binding succeeds', async () => {
    verifyShareOftRegistryBinding.mockResolvedValue({ verified: true })
    process.env.SOLANA_SHARE_OFT_MAPPING = JSON.stringify({
      [validPayload.shareMeshMint]: validPayload.shareOft,
    })
    process.env.SOLANA_CREATOR_MINTS = validPayload.shareMeshMint

    await expect(executeSolanaSyncMapping(validPayload)).resolves.toMatchObject({
      updated: false,
      reason: 'no_changes',
    })
    expect(verifyShareOftRegistryBinding).toHaveBeenCalledWith({
      creatorToken: validPayload.creatorToken,
      shareOft: validPayload.shareOft,
    })
  })
})
