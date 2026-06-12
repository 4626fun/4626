import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArenaConfig } from './arenaConfig.js'
import {
  __resetArenaIdentityMappingsForTests,
  clearArenaIdentityMapping,
  resolveArenaIdentityForContext,
  upsertArenaIdentityMapping,
} from './arenaIdentityMappingStore.js'

vi.mock('../db/postgres.js', () => ({
  getDb: vi.fn(async () => null),
}))

function baseConfig(): ArenaConfig {
  return {
    enabled: true,
    tradingEnabled: false,
    creationEnabled: true,
    dryRun: true,
    agentId: null,
    agentWalletAddress: null,
    hlApiWalletAddress: null,
    hlAgentPrivateKey: null,
    hlMasterAddressOverride: null,
    commandTimeoutMs: 60_000,
    maxUsdcDeposit: 50_000,
    maxTradeSizeUsd: 100_000,
    allowedRoomIds: ['1659'],
    dgclawDir: '/tmp',
    dgclawBin: './dgclaw.sh',
    acpBin: 'acp',
    nodeRunnerBin: 'npx',
    hip3PrefixRequired: true,
    assetAllowlist: null,
  }
}

describe('arenaIdentityMappingStore in-memory fallback', () => {
  beforeEach(() => {
    __resetArenaIdentityMappingsForTests()
  })

  it('upserts and resolves room default mapping without db', async () => {
    const roomId = '1659-memory-default'
    const sender = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'

    const saved = await upsertArenaIdentityMapping({
      roomId,
      senderAddress: '*',
      arenaAgentId: '019e90fa-3c8c-7ba0-8547-bf6f81698c3d',
      arenaWalletAddress: '0x74ab91cd845ff0d2006404440af49c3bc8c1df96',
      updatedBy: sender,
    })
    expect(saved).toBe(true)

    const resolved = await resolveArenaIdentityForContext({
      roomId,
      senderAddress: sender,
      baseConfig: baseConfig(),
    })
    expect(resolved.source).toBe('room_default')
    expect(resolved.agentId).toBe('019e90fa-3c8c-7ba0-8547-bf6f81698c3d')
    expect(resolved.agentWalletAddress).toBe('0x74ab91cd845ff0d2006404440af49c3bc8c1df96')
  })

  it('prefers sender-specific mapping over room default and clears without db', async () => {
    const roomId = '1659-memory-precedence'
    const sender = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'
    const senderAgentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const senderWallet = '0x1111111111111111111111111111111111111111'
    const defaultAgentId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
    const defaultWallet = '0x2222222222222222222222222222222222222222'

    await upsertArenaIdentityMapping({
      roomId,
      senderAddress: '*',
      arenaAgentId: defaultAgentId,
      arenaWalletAddress: defaultWallet,
      updatedBy: sender,
    })
    await upsertArenaIdentityMapping({
      roomId,
      senderAddress: sender,
      arenaAgentId: senderAgentId,
      arenaWalletAddress: senderWallet,
      updatedBy: sender,
    })

    const resolved = await resolveArenaIdentityForContext({
      roomId,
      senderAddress: sender,
      baseConfig: baseConfig(),
    })
    expect(resolved.source).toBe('user')
    expect(resolved.agentId).toBe(senderAgentId)
    expect(resolved.agentWalletAddress).toBe(senderWallet)

    const cleared = await clearArenaIdentityMapping({ roomId, senderAddress: '*' })
    expect(cleared).toBe(true)

    const otherSenderResolved = await resolveArenaIdentityForContext({
      roomId,
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      baseConfig: baseConfig(),
    })
    expect(otherSenderResolved.source).toBe('env_default')
    expect(otherSenderResolved.agentId).toBeNull()
  })
})
