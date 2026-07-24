import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  VIRTUALS_ACP_DEFAULT_GLOBAL_TOOL_QUOTA,
  VIRTUALS_ACP_DEFAULT_PER_JOB_TOOL_QUOTA,
  checkVirtualsAcpConfig,
  findInvalidExecutableHighRiskTools,
  isValidVirtualsSignerPrivateKey,
  parseExecutableHighRiskTools,
  readVirtualsAcpConfig,
} from './config.js'

const ENV_KEYS = [
  'VIRTUALS_ACP_AUTO_LLM',
  'VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS',
  'VIRTUALS_ACP_GLOBAL_TOOL_EXECUTION_QUOTA',
  'VIRTUALS_ACP_PER_JOB_TOOL_EXECUTION_QUOTA',
  'VIRTUALS_ACP_ENABLED',
  'VIRTUALS_ACP_WALLET_ADDRESS',
  'VIRTUALS_ACP_WALLET_ID',
  'VIRTUALS_ACP_SIGNER_PRIVATE_KEY',
] as const
const saved = new Map<string, string | undefined>()

describe('Virtuals ACP hardened config', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key])
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = saved.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    saved.clear()
  })

  it('defaults to observe-only with no executable high-risk tools', () => {
    const config = readVirtualsAcpConfig()
    expect(config.autoLlmEnabled).toBe(false)
    expect(config.executableHighRiskTools).toEqual([])
    expect(config.globalToolExecutionQuota).toBe(VIRTUALS_ACP_DEFAULT_GLOBAL_TOOL_QUOTA)
    expect(config.perJobToolExecutionQuota).toBe(VIRTUALS_ACP_DEFAULT_PER_JOB_TOOL_QUOTA)
  })

  it('parses only exact typed high-risk capabilities', () => {
    expect(parseExecutableHighRiskTools('complete, fund, complete, sendMessage, COMPLETE')).toEqual([
      'complete',
      'fund',
    ])
    expect(findInvalidExecutableHighRiskTools('complete, sendMessage, COMPLETE')).toEqual([
      'sendMessage',
      'COMPLETE',
    ])
  })

  it('validates a non-zero secp256k1 signer private key format', () => {
    expect(isValidVirtualsSignerPrivateKey(`0x${'11'.repeat(32)}`)).toBe(true)
    expect(isValidVirtualsSignerPrivateKey('11'.repeat(32))).toBe(false)
    expect(isValidVirtualsSignerPrivateKey('0x1234')).toBe(false)
    expect(isValidVirtualsSignerPrivateKey(`0x${'00'.repeat(32)}`)).toBe(false)
    // Privy/Virtuals session authorization key (P-256 PKCS#8 base64)
    expect(
      isValidVirtualsSignerPrivateKey(
        'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgAAAAAAAAAAAAAAAAAAAAAAAE' +
          'RANCAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toBe(true)
    expect(
      isValidVirtualsSignerPrivateKey(
        'wallet-auth:MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgAAAAAAAAAAAAAAAAAAAAAAAE' +
          'RANCAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toBe(true)
  })

  it('rejects malformed allowlist entries instead of silently dropping them', () => {
    process.env.VIRTUALS_ACP_ENABLED = '1'
    process.env.VIRTUALS_ACP_WALLET_ADDRESS = `0x${'aa'.repeat(20)}`
    process.env.VIRTUALS_ACP_WALLET_ID = 'wallet-id'
    process.env.VIRTUALS_ACP_SIGNER_PRIVATE_KEY = `0x${'11'.repeat(32)}`
    process.env.VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS = 'complete,sendMessage'
    const check = checkVirtualsAcpConfig(readVirtualsAcpConfig())
    expect(check).toEqual({
      ok: false,
      reason: 'invalid VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS entries: sendMessage',
    })
  })

  it('rejects a present but malformed signer key', () => {
    process.env.VIRTUALS_ACP_ENABLED = '1'
    process.env.VIRTUALS_ACP_WALLET_ADDRESS = `0x${'aa'.repeat(20)}`
    process.env.VIRTUALS_ACP_WALLET_ID = 'wallet-id'
    process.env.VIRTUALS_ACP_SIGNER_PRIVATE_KEY = 'not-a-private-key'
    const check = checkVirtualsAcpConfig(readVirtualsAcpConfig())
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toContain('invalid VIRTUALS_ACP_SIGNER_PRIVATE_KEY')
  })

  it('bounds quota configuration and rejects zero or malformed limits', () => {
    process.env.VIRTUALS_ACP_GLOBAL_TOOL_EXECUTION_QUOTA = '999999'
    process.env.VIRTUALS_ACP_PER_JOB_TOOL_EXECUTION_QUOTA = '0'
    const config = readVirtualsAcpConfig()
    expect(config.globalToolExecutionQuota).toBe(1_000)
    expect(config.perJobToolExecutionQuota).toBe(VIRTUALS_ACP_DEFAULT_PER_JOB_TOOL_QUOTA)
  })
})
