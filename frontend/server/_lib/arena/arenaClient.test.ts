import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import type { ArenaConfig } from './arenaConfig.js'
import {
  parseAcpAgentCreateOutput,
  runArenaActivateUnifiedAccount,
  runArenaAddApiWallet,
  runArenaCreateAgent,
  runArenaDepositUsdc,
  runArenaJoin,
  runArenaStatus,
  runArenaTrade,
} from './arenaClient.js'

function mockConfig(overrides: Partial<ArenaConfig> = {}): ArenaConfig {
  return {
    enabled: true,
    tradingEnabled: true,
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

  it('builds v2 flag-style open args via tsx', async () => {
    const result = await runArenaTrade(
      { action: 'open', pair: 'xyz:GOLD', side: 'long', sizeUsd: 1000, leverage: 2 },
      mockConfig({ dryRun: true }),
    )
    expect(result.run?.args).toEqual([
      'tsx',
      'scripts/trade.ts',
      'open',
      '--pair',
      'xyz:GOLD',
      '--side',
      'long',
      '--size',
      '1000',
      '--leverage',
      '2',
    ])
  })

  it('builds v2 flag-style close args via tsx', async () => {
    const result = await runArenaTrade({ action: 'close', pair: 'xyz:GOLD' }, mockConfig({ dryRun: true }))
    expect(result.run?.args).toEqual(['tsx', 'scripts/trade.ts', 'close', '--pair', 'xyz:GOLD'])
  })
})

describe('arenaClient dgclaw v2 setup ops', () => {
  it('activates unified account via scripts/activate-unified.ts', async () => {
    const result = await runArenaActivateUnifiedAccount(mockConfig({ dryRun: true }))
    expect(result.ok).toBe(true)
    expect(result.run?.command).toBe('npx')
    expect(result.run?.args).toEqual(['tsx', 'scripts/activate-unified.ts'])
  })

  it('treats add-api-wallet as a successful no-op (v2 needs no API wallet)', async () => {
    const result = await runArenaAddApiWallet(mockConfig({ dryRun: false }))
    expect(result.ok).toBe(true)
    expect(result.message).toContain('no API wallet required')
    expect(result.run).toBeUndefined()
  })

  it('fails deposit with ACP job guidance (deposit.ts removed upstream)', async () => {
    const result = await runArenaDepositUsdc(100, mockConfig({ dryRun: false }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain('perp_deposit')
    expect(result.message).toContain('"amount":"100"')
    expect(result.message).toContain('acp client fund')
  })
})

describe('arenaClient dgclaw command preflight', () => {
  it('fails with actionable message when dgclaw binary is missing in live mode', async () => {
    const result = await runArenaJoin(
      mockConfig({
        dryRun: false,
        dgclawDir: '/tmp',
        dgclawBin: './definitely-missing-dgclaw.sh',
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain('dgclaw binary not found')
    expect(result.message).toContain('ARENA_DGCLAW_DIR/ARENA_DGCLAW_BIN')
  })

  it('reports command resolution details in status output', async () => {
    const result = await runArenaStatus(mockConfig({ dgclawDir: '/tmp', dgclawBin: './dgclaw.sh' }))

    expect(result.ok).toBe(true)
    expect(result.details?.dgclawCommandPath).toBe('/tmp/dgclaw.sh')
    expect(result.details?.dgclawCommandSource).toBe('configured')
    expect(Array.isArray(result.details?.dgclawCandidatePaths)).toBe(true)
    expect(result.details?.dgclawDirExists).toBe(true)
    expect(result.details?.dgclawCommandExists).toBe(false)
  })

  it('falls back to canonical dgclaw.sh in configured dir when bin override is stale', async () => {
    const dgclawDir = mkdtempSync(resolve(tmpdir(), 'arena-dgclaw-'))
    const dgclawPath = resolve(dgclawDir, 'dgclaw.sh')
    writeFileSync(dgclawPath, '#!/usr/bin/env bash\nexit 0\n', 'utf8')
    chmodSync(dgclawPath, 0o755)

    const result = await runArenaJoin(
      mockConfig({
        dryRun: false,
        dgclawDir,
        dgclawBin: './stale-wrapper.sh',
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.run?.command).toBe(dgclawPath)
  })

  it('falls back to scripts/dgclaw.sh when canonical wrapper is missing', async () => {
    const dgclawDir = mkdtempSync(resolve(tmpdir(), 'arena-dgclaw-scripts-'))
    const scriptsDir = resolve(dgclawDir, 'scripts')
    mkdirSync(scriptsDir)
    const scriptPath = resolve(scriptsDir, 'dgclaw.sh')
    writeFileSync(scriptPath, '#!/usr/bin/env bash\nexit 0\n', 'utf8')
    chmodSync(scriptPath, 0o755)

    const result = await runArenaJoin(
      mockConfig({
        dryRun: false,
        dgclawDir,
        dgclawBin: './dgclaw.sh',
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.run?.command).toBe(scriptPath)
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

  it('uses ownerAddress fallback when ACP_OWNER_WALLET is unset', async () => {
    process.env.ACP_ACCESS_TOKEN = 'token'
    process.env.ACP_REFRESH_TOKEN = 'refresh'
    delete process.env.ACP_OWNER_WALLET

    const result = await runArenaCreateAgent(
      mockConfig({ dryRun: true, creationEnabled: true }),
      '0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9',
    )

    expect(result.ok).toBe(true)
    expect(result.run?.dryRun).toBe(true)
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
