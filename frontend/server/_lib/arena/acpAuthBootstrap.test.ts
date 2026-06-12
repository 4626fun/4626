import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import type { ArenaConfig } from './arenaConfig.js'
import {
  computeAcpSeedFingerprint,
  ensureKeyringFileBackendPinned,
  hasHeadlessConfigureSeed,
  isEnvSeedConsumed,
  markAcpSeedConsumed,
  parseAcpCliJson,
  readConsumedAcpSeedFingerprint,
  readSignerPublicKey,
  resolveAcpConfigJsonPath,
  resolveAcpStateEnv,
  runAcpAuthBootstrap,
} from './acpAuthBootstrap.js'

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

const envKeys = ['ARENA_ACP_HOME', 'ACP_ACCESS_TOKEN', 'ACP_REFRESH_TOKEN', 'ACP_OWNER_WALLET'] as const
const savedEnv: Record<string, string | undefined> = {}
for (const key of envKeys) savedEnv[key] = process.env[key]

afterEach(() => {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

describe('resolveAcpStateEnv', () => {
  it('returns empty when ARENA_ACP_HOME is unset', () => {
    expect(resolveAcpStateEnv({})).toEqual({})
    expect(resolveAcpStateEnv({ ARENA_ACP_HOME: '  ' })).toEqual({})
  })

  it('pins HOME and ACP_CONFIG_DIR to the persistent dir', () => {
    expect(resolveAcpStateEnv({ ARENA_ACP_HOME: '/data/acp-home' })).toEqual({
      HOME: '/data/acp-home',
      ACP_CONFIG_DIR: '/data/acp-home/.config/acp',
    })
  })
})

describe('resolveAcpConfigJsonPath', () => {
  it('prefers ARENA_ACP_HOME over HOME', () => {
    expect(resolveAcpConfigJsonPath({ ARENA_ACP_HOME: '/data/acp-home', HOME: '/root' })).toBe(
      '/data/acp-home/.config/acp/config.json',
    )
  })

  it('falls back to HOME default config dir', () => {
    expect(resolveAcpConfigJsonPath({ HOME: '/root' })).toBe('/root/.config/acp/config.json')
  })

  it('returns null without any home', () => {
    expect(resolveAcpConfigJsonPath({})).toBeNull()
  })
})

describe('parseAcpCliJson', () => {
  it('parses the last JSON line, skipping runner noise', () => {
    const stdout = 'npm warn something\n{"intermediate":true}\n{"id":"agent-1","walletAddress":"0xabc"}\n'
    expect(parseAcpCliJson(stdout)).toEqual({ id: 'agent-1', walletAddress: '0xabc' })
  })

  it('surfaces acp-cli json errors', () => {
    const stdout = '{"error":"No active agent set.","code":"NO_ACTIVE_AGENT","recovery":"Run `acp agent use`."}'
    expect(parseAcpCliJson(stdout)).toMatchObject({ code: 'NO_ACTIVE_AGENT' })
  })

  it('returns null for non-json output', () => {
    expect(parseAcpCliJson('plain text only')).toBeNull()
    expect(parseAcpCliJson('')).toBeNull()
  })
})

describe('readSignerPublicKey', () => {
  it('reads the publicKey case-insensitively by wallet', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'acp-config-'))
    const configDir = resolve(dir, '.config', 'acp')
    mkdirSync(configDir, { recursive: true })
    const configPath = resolve(configDir, 'config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        activeWallet: '0xAbCdef0000000000000000000000000000000001',
        agents: {
          '0xAbCdef0000000000000000000000000000000001': { publicKey: 'pk-base64', id: 'agent-1' },
        },
      }),
    )
    expect(
      readSignerPublicKey({
        configJsonPath: configPath,
        walletAddress: '0xabcdef0000000000000000000000000000000001',
      }),
    ).toBe('pk-base64')
  })

  it('returns null for missing file, wallet, or empty publicKey', () => {
    expect(readSignerPublicKey({ configJsonPath: '/nonexistent/config.json', walletAddress: '0xabc' })).toBeNull()
    expect(readSignerPublicKey({ configJsonPath: null, walletAddress: '0xabc' })).toBeNull()

    const dir = mkdtempSync(resolve(tmpdir(), 'acp-config-'))
    const configPath = resolve(dir, 'config.json')
    writeFileSync(configPath, JSON.stringify({ agents: { '0xabc': { publicKey: '' } } }))
    expect(readSignerPublicKey({ configJsonPath: configPath, walletAddress: '0xabc' })).toBeNull()
  })
})

describe('hasHeadlessConfigureSeed', () => {
  it('requires all three env vars', () => {
    expect(hasHeadlessConfigureSeed({})).toBe(false)
    expect(hasHeadlessConfigureSeed({ ACP_ACCESS_TOKEN: 't' })).toBe(false)
    expect(
      hasHeadlessConfigureSeed({ ACP_ACCESS_TOKEN: 't', ACP_REFRESH_TOKEN: 'r', ACP_OWNER_WALLET: '0xabc' }),
    ).toBe(true)
  })
})

describe('ensureKeyringFileBackendPinned', () => {
  it('writes defaultBackend=file config when missing', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'acp-keyring-'))
    const result = ensureKeyringFileBackendPinned(dir)
    expect(result).toEqual({ pinned: true, detail: 'written' })
    const configPath = resolve(dir, '.config', 'keyring', 'keyring.config.json')
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({ defaultBackend: 'file' })
  })

  it('never overwrites an existing keyring config', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'acp-keyring-'))
    const keyringDir = resolve(dir, '.config', 'keyring')
    mkdirSync(keyringDir, { recursive: true })
    const configPath = resolve(keyringDir, 'keyring.config.json')
    writeFileSync(configPath, JSON.stringify({ defaultBackend: 'custom' }))
    const result = ensureKeyringFileBackendPinned(dir)
    expect(result).toEqual({ pinned: true, detail: 'already_present' })
    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({ defaultBackend: 'custom' })
  })
})

describe('consumed-seed guard', () => {
  it('computes a stable fingerprint from the token pair only (owner excluded)', () => {
    const a = computeAcpSeedFingerprint({ ACP_ACCESS_TOKEN: 'tok', ACP_REFRESH_TOKEN: 'ref', ACP_OWNER_WALLET: '0xAAA' })
    const b = computeAcpSeedFingerprint({ ACP_ACCESS_TOKEN: 'tok', ACP_REFRESH_TOKEN: 'ref', ACP_OWNER_WALLET: '0xBBB' })
    const c = computeAcpSeedFingerprint({ ACP_ACCESS_TOKEN: 'tok', ACP_REFRESH_TOKEN: 'other' })
    expect(a).toBeTruthy()
    expect(a).toBe(b)
    expect(c).not.toBe(a)
    expect(computeAcpSeedFingerprint({ ACP_ACCESS_TOKEN: 'tok' })).toBeNull()
    expect(computeAcpSeedFingerprint({})).toBeNull()
  })

  it('marks and reads the consumed fingerprint on a persistent state dir', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'acp-seed-'))
    const env = { ARENA_ACP_HOME: dir, ACP_ACCESS_TOKEN: 'tok', ACP_REFRESH_TOKEN: 'ref' }
    expect(readConsumedAcpSeedFingerprint(env)).toBeNull()
    expect(isEnvSeedConsumed(env)).toBe(false)

    const fingerprint = computeAcpSeedFingerprint(env)!
    expect(markAcpSeedConsumed(fingerprint, env)).toEqual({ marked: true })
    expect(readConsumedAcpSeedFingerprint(env)).toBe(fingerprint)
    expect(isEnvSeedConsumed(env)).toBe(true)

    // A rotated (fresh) triplet is not considered consumed.
    expect(isEnvSeedConsumed({ ...env, ACP_REFRESH_TOKEN: 'fresh-ref' })).toBe(false)
  })

  it('does nothing without a persistent state dir', () => {
    const env = { ACP_ACCESS_TOKEN: 'tok', ACP_REFRESH_TOKEN: 'ref' }
    expect(markAcpSeedConsumed('abc', env)).toEqual({ marked: false, detail: 'no_persistent_state_dir' })
    expect(readConsumedAcpSeedFingerprint(env)).toBeNull()
    expect(isEnvSeedConsumed(env)).toBe(false)
  })
})

describe('runAcpAuthBootstrap skip paths', () => {
  it('skips when arena is disabled', async () => {
    const result = await runAcpAuthBootstrap(mockConfig({ enabled: false }))
    expect(result.attempted).toBe(false)
    expect(result.reason).toBe('arena_disabled')
  })

  it('skips in dry-run mode (no live signing needed)', async () => {
    const result = await runAcpAuthBootstrap(mockConfig({ dryRun: true }))
    expect(result.attempted).toBe(false)
    expect(result.reason).toBe('arena_dry_run')
  })
})
