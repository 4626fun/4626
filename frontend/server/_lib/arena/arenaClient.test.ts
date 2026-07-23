import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import type { ArenaConfig } from './arenaConfig.js'
import {
  formatCloseTradeSummary,
  parseAcpAgentCreateOutput,
  parseTradeFillFromOutput,
  runArenaActivateUnifiedAccount,
  runArenaAddApiWallet,
  runArenaCreateAgent,
  runArenaDepositUsdc,
  runArenaJoin,
  runArenaPositionIntel,
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
    degenProfileId: null,
    agentWalletAddress: null,
    hlApiWalletAddress: null,
    hlAgentPrivateKey: null,
    hlMasterAddressOverride: null,
    hlSubaccountAddress: null,
    commandTimeoutMs: 60_000,
    maxUsdcDeposit: 50_000,
    minTradeSizeUsd: 11,
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

describe('arenaClient command override parsing', () => {
  it('supports inline dgclaw binary arguments in ARENA_DGCLAW_BIN', async () => {
    const result = await runArenaJoin(
      mockConfig({
        dryRun: false,
        dgclawDir: '/tmp',
        dgclawBin: '/bin/echo hello',
        agentId: '019e90fa-3c8c-7ba0-8547-bf6f81698c3d',
        agentWalletAddress: '0x74ab91cd845ff0d2006404440af49c3bc8c1df96',
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.run?.command).toBe('/bin/echo')
    expect(result.run?.args[0]).toBe('hello')
    expect(result.run?.args[1]).toBe('join')
    expect(result.run?.args).toContain('0x74ab91cd845ff0d2006404440af49c3bc8c1df96')
    expect(result.run?.stdout).toContain('hello join')
  })

  it('supports inline node runner arguments in ARENA_NODE_RUNNER_BIN', async () => {
    const result = await runArenaTrade(
      { action: 'open', pair: 'xyz:GOLD', side: 'long', sizeUsd: 1000, leverage: 2 },
      mockConfig({ dryRun: true, nodeRunnerBin: 'pnpm exec' }),
    )
    expect(result.ok).toBe(true)
    expect(result.run?.command).toBe('pnpm')
    expect(result.run?.args.slice(0, 3)).toEqual(['exec', 'tsx', 'scripts/trade.ts'])
  })

  it('does not fall back to dgclaw.sh when ARENA_DGCLAW_BIN has inline args', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'arena-dgclaw-override-'))
    writeFileSync(resolve(dir, 'dgclaw.sh'), '#!/bin/sh\necho should-not-run\n', { mode: 0o755 })

    const result = await runArenaJoin(
      mockConfig({
        dryRun: true,
        dgclawDir: dir,
        dgclawBin: 'pnpm exec',
        agentId: '019e90fa-3c8c-7ba0-8547-bf6f81698c3d',
        agentWalletAddress: '0x74ab91cd845ff0d2006404440af49c3bc8c1df96',
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.run?.command).toBe('pnpm')
    expect(result.run?.args[0]).toBe('exec')
    expect(result.run?.args[1]).toBe('join')
    expect(result.run?.command).not.toContain('dgclaw.sh')
  })
})

describe('arenaClient trade guardrails', () => {
  it('fails closed when trading lane is disabled', async () => {
    const result = await runArenaTrade(
      { action: 'open', pair: 'BTC', side: 'long', sizeUsd: 1000, leverage: 2 },
      mockConfig({ tradingEnabled: false }),
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain('ARENA_TRADING_ENABLED')
  })

  it('rejects open trades below ARENA_MIN_TRADE_SIZE_USD', async () => {
    const result = await runArenaTrade(
      { action: 'open', pair: 'BTC', side: 'long', sizeUsd: 10, leverage: 5 },
      mockConfig({ dryRun: true }),
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain('ARENA_MIN_TRADE_SIZE_USD')
    expect(result.message).toContain('11')
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

  it('permits reduce-only closes for a position removed from the entry allowlist', async () => {
    const result = await runArenaTrade(
      { action: 'close', pair: 'BTC' },
      mockConfig({ dryRun: true, assetAllowlist: new Set(['ETH']) }),
    )
    expect(result.ok).toBe(true)
    expect(result.run?.args).toContain('BTC')
  })

  it('parses the exit fill from the dgclaw close order response', () => {
    const stdout = JSON.stringify({
      status: 'ok',
      response: {
        type: 'order',
        data: { statuses: [{ filled: { totalSz: '0.00017', avgPx: '63898.0', oid: 489994283102 } }] },
      },
    })
    expect(parseTradeFillFromOutput(stdout)).toEqual({ totalSz: 0.00017, avgPx: 63898 })
    expect(parseTradeFillFromOutput('Closing BTC position (full)')).toBeNull()
    expect(parseTradeFillFromOutput('')).toBeNull()
  })

  it('formats a close summary with entry, exit, and PnL', () => {
    const summary = formatCloseTradeSummary({
      pair: 'BTC',
      partial: false,
      snapshot: { szi: -0.00017, entryPx: 63898, leverage: 5 },
      fill: { totalSz: 0.00017, avgPx: 63400 },
    })
    expect(summary).toContain('Closed BTC short')
    expect(summary).toContain('Entry $63,898 → Exit $63,400')
    expect(summary).toContain('+$0.0847')
    expect(summary).toContain('% on margin')

    // long side flips the PnL sign
    const losingLong = formatCloseTradeSummary({
      pair: 'ETH',
      partial: true,
      snapshot: { szi: 0.02, entryPx: 2500, leverage: null },
      fill: { totalSz: 0.01, avgPx: 2450 },
    })
    expect(losingLong).toContain('Partially closed ETH long')
    expect(losingLong).toContain('-$0.50')

    // no fill parsed -> caller falls back to the plain submitted message
    expect(
      formatCloseTradeSummary({ pair: 'BTC', partial: false, snapshot: null, fill: null }),
    ).toBeNull()

    // fill without a snapshot still reports the exit
    expect(
      formatCloseTradeSummary({
        pair: 'BTC',
        partial: false,
        snapshot: null,
        fill: { totalSz: 0.001, avgPx: 64000 },
      }),
    ).toContain('Closed BTC: 0.001 @ $64,000')
  })

  it('passes strategy subaccount args through to trade.ts', async () => {
    const result = await runArenaTrade(
      {
        action: 'open',
        pair: 'xyz:GOLD',
        side: 'short',
        sizeUsd: 300,
        leverage: 3,
        subaccountAddress: '0x1111111111111111111111111111111111111111',
        strategyKey: 'event',
      },
      mockConfig({ dryRun: true }),
    )
    expect(result.run?.args).toEqual([
      'tsx',
      'scripts/trade.ts',
      'open',
      '--pair',
      'xyz:GOLD',
      '--side',
      'short',
      '--size',
      '300',
      '--leverage',
      '3',
      '--subaccount',
      '0x1111111111111111111111111111111111111111',
    ])
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

  it('builds ACP perp_deposit create-job command for deposits', async () => {
    const result = await runArenaDepositUsdc(100, mockConfig({ dryRun: true }))
    expect(result.ok).toBe(true)
    expect(result.run?.command).toBe('acp')
    expect(result.run?.args).toEqual([
      'client',
      'create-job',
      '--provider',
      '0xd478a8B40372db16cA8045F28C6FE07228F3781A',
      '--offering-name',
      'perp_deposit',
      '--requirements',
      '{"amount":"100"}',
      '--legacy',
      '--json',
    ])
    expect(result.message).toContain('Bridge dry-run prepared')
    expect(result.message).toContain('/arena sweep')
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

  it('fails closed instead of bypassing a stale configured wrapper', async () => {
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

    expect(result.ok).toBe(false)
    expect(result.message).toContain('stale-wrapper.sh')
  })

  it('does not discover scripts/dgclaw.sh when the configured path is absent', async () => {
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

    expect(result.ok).toBe(false)
    expect(result.message).toContain('dgclaw binary not found')
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

  it('fails closed when any runtime ACP session rotation variable is set', async () => {
    process.env.ACP_OWNER_WALLET = '0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9'
    const result = await runArenaCreateAgent(mockConfig({ dryRun: true, creationEnabled: true }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Runtime ACP token rotation is disabled')
  })

  it('refuses a complete headless ACP credential triplet before spawning a process', async () => {
    process.env.ACP_ACCESS_TOKEN = 'token'
    process.env.ACP_REFRESH_TOKEN = 'refresh'
    process.env.ACP_OWNER_WALLET = '0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9'
    const result = await runArenaCreateAgent(
      mockConfig({ dryRun: false, creationEnabled: true, acpBin: '__definitely_missing_acp_bin__' }),
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Runtime ACP token rotation is disabled')
  })

  it('does not pair service ACP tokens with a caller-provided owner fallback', async () => {
    process.env.ACP_ACCESS_TOKEN = 'token'
    process.env.ACP_REFRESH_TOKEN = 'refresh'
    delete process.env.ACP_OWNER_WALLET

    const result = await runArenaCreateAgent(
      mockConfig({ dryRun: true, creationEnabled: true }),
      '0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9',
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain('Runtime ACP token rotation is disabled')
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

describe('runArenaPositionIntel', () => {
  it('fails soft when wallet context is unavailable', async () => {
    const result = await runArenaPositionIntel(
      mockConfig({
        dryRun: true,
        agentWalletAddress: null,
        hlApiWalletAddress: null,
        hlMasterAddressOverride: null,
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.message).toContain('without Hyperliquid account enrichment')
    expect(result.details?.walletAddress).toBeNull()
    expect(Array.isArray(result.details?.partialFailures)).toBe(true)
  })

  it('returns enriched payloads when Hyperliquid info endpoints respond', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      new Response(JSON.stringify({ mocked: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
    try {
      const result = await runArenaPositionIntel(
        mockConfig({
          dryRun: true,
          agentWalletAddress: '0x1111111111111111111111111111111111111111',
        }),
      )
      expect(result.ok).toBe(true)
      expect(result.details?.walletAddress).toBe('0x1111111111111111111111111111111111111111')
      expect(result.details?.userDetails).toEqual({ mocked: true })
      expect(result.details?.userFees).toEqual({ mocked: true })
      expect(result.details?.ledgerUpdates).toEqual({ mocked: true })
      expect(result.details?.userFills).toEqual({ mocked: true })
      expect(result.details?.allMids).toEqual({ mocked: true })
      expect(result.details?.spotMetaAndAssetCtxs).toEqual({ mocked: true })
      expect(Array.isArray(result.details?.partialFailures)).toBe(true)
      const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]))
      expect(calledUrls.some((url) => url.includes('/explorer'))).toBe(true)
      expect(calledUrls.some((url) => url.includes('/info'))).toBe(true)
    } finally {
      ;(globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch
    }
  })
})
