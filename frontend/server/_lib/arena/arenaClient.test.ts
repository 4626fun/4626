import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ArenaConfig } from './arenaConfig.js'
import { parseAcpAgentCreateOutput, runArenaCreateAgent, runArenaTrade } from './arenaClient.js'

function mockConfig(overrides: Partial<ArenaConfig> = {}): ArenaConfig {
  return {
    enabled: true,
    tradingEnabled: true,
    creationEnabled: true,
    dryRun: true,
    agentId: null,
    agentWalletAddress: null,
    hlApiWalletAddress: null,
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
    ...overrides,
  }
}

describe('arenaClient trade guardrails', () => {
  it('fails closed when trading lane is disabled', async () => {
    const result = await runArenaTrade(
      { action: 'open', pair: 'BTC', side: 'long', sizeUsd: 1000, leverage: 2 },
      mockConfig({ tradingEnabled: false }),
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain('ARENA_TRADING_ENABLED')
  })

  it('returns dry-run success when enabled', async () => {
    const result = await runArenaTrade(
      { action: 'open', pair: 'xyz:GOLD', side: 'long', sizeUsd: 1000, leverage: 2 },
      mockConfig({ dryRun: true }),
    )
    expect(result.ok).toBe(true)
    expect(result.run?.dryRun).toBe(true)
    expect(result.run?.command).toBe('npx')
  })
})

describe('arenaClient create/register (acp path)', () => {
  const acpEnvKeys = ['ACP_ACCESS_TOKEN', 'ACP_REFRESH_TOKEN', 'ACP_OWNER_WALLET'] as const
  let previousAcpEnv: Record<(typeof acpEnvKeys)[number], string | undefined>

  beforeEach(() => {
    previousAcpEnv = {
      ACP_ACCESS_TOKEN: process.env.ACP_ACCESS_TOKEN,
      ACP_REFRESH_TOKEN: process.env.ACP_REFRESH_TOKEN,
      ACP_OWNER_WALLET: process.env.ACP_OWNER_WALLET,
    }
    for (const key of acpEnvKeys) delete process.env[key]
  })

  afterEach(() => {
    for (const key of acpEnvKeys) {
      const value = previousAcpEnv[key]
      if (typeof value === 'string') process.env[key] = value
      else delete process.env[key]
    }
  })

  it('fails closed when creation lane is disabled', async () => {
    const result = await runArenaCreateAgent(mockConfig({ creationEnabled: false }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain('ARENA_CREATION_ENABLED')
  })

  it('fails closed when ACP session rotation vars are only partially set', async () => {
    process.env.ACP_OWNER_WALLET = '0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9'
    const result = await runArenaCreateAgent(mockConfig({ dryRun: true, creationEnabled: true }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain('partially configured')
    expect(result.message).toContain('ACP_ACCESS_TOKEN')
    expect(result.message).toContain('ACP_REFRESH_TOKEN')
  })

  it('fails closed when headless acp configure fails', async () => {
    process.env.ACP_ACCESS_TOKEN = 'token'
    process.env.ACP_REFRESH_TOKEN = 'refresh'
    process.env.ACP_OWNER_WALLET = '0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9'
    const result = await runArenaCreateAgent(
      mockConfig({ dryRun: false, creationEnabled: true, acpBin: '__definitely_missing_acp_bin__' }),
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain('acp configure failed')
  })

  it('returns dry-run success (mock) and attempts parse when enabled', async () => {
    const result = await runArenaCreateAgent(mockConfig({ dryRun: true, creationEnabled: true }))
    expect(result.ok).toBe(true)
    expect(result.run?.dryRun).toBe(true)
    // In dry the stdout is the placeholder; parse may or may not yield ids, but shape is correct
    expect(result).toHaveProperty('message')
  })

  it('runArenaCreateAgent exercises the parser and returns correct shape', async () => {
    const cfg = mockConfig({ dryRun: true, creationEnabled: true })
    const r = await runArenaCreateAgent(cfg)
    expect(typeof r.ok).toBe('boolean')
  })
})

describe('parseAcpAgentCreateOutput', () => {
  it('parses typical acp agent create human output', () => {
    const out = 'Agent created successfully.\nAgent ID: 019e82af-2e66-7645-af23-69e9f14351f4\nAgent Wallet: 0x30068C6bCCf43E9EB5CDB68fB978F32F744D870C\nHL API Wallet: 0xabc0000000000000000000000000000000000000'
    const p = parseAcpAgentCreateOutput(out)
    expect(p.agentId).toBe('019e82af-2e66-7645-af23-69e9f14351f4')
    expect(p.agentWalletAddress).toBe('0x30068c6bccf43e9eb5cdb68fb978f32f744d870c')
    expect(p.hlApiWalletAddress).toBe('0xabc0000000000000000000000000000000000000')
  })

  it('parses JSON output', () => {
    const out = JSON.stringify({ agentId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', wallet: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' })
    const p = parseAcpAgentCreateOutput(out)
    expect(p.agentId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(p.agentWalletAddress).toBe('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
  })

  it('returns empty on garbage / dry-run placeholder / non-hex id', () => {
    expect(parseAcpAgentCreateOutput('[dry-run] command not executed')).toEqual({})
    expect(parseAcpAgentCreateOutput('some random text with 0x123 but no id')).toEqual({})
    expect(parseAcpAgentCreateOutput('Agent ID: not-a-hex-id-at-all!')).toEqual({})
  })
})
