import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress, keccak256, type Hex } from 'viem'

import {
  buildShareOftVanityCacheKey,
  buildVanityVersionCacheKey,
  readPersistedShareOftVanitySalt,
  readPersistedVanityVersionPlan,
  writePersistedShareOftVanitySalt,
  writePersistedVanityVersionPlan,
} from './deployVaultVanityPersistence'

const CREATOR = getAddress('0x1111111111111111111111111111111111111111')
const OWNER = getAddress('0x2222222222222222222222222222222222222222')
const DEPLOYER = getAddress('0x3333333333333333333333333333333333333333')

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    },
  })
}

beforeEach(() => {
  installLocalStorageMock()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('deploy vanity persistence', () => {
  it('builds stable vanity version cache keys', () => {
    const key = buildVanityVersionCacheKey({
      create2Deployer: DEPLOYER,
      creatorToken: CREATOR,
      owner: OWNER,
      chainId: 8453,
      vaultName: 'Vault',
      vaultSymbol: 'V',
      shareName: 'Share',
      shareSymbol: 'S',
      baseVersion: 'v1.13.0',
      vaultPrefix: '4626',
      shareSuffix: null,
      vaultVanityMaxTries: 250_000,
      shareOftVanityMaxTries: 1_000_000,
      supportsPhase1WithSalt: true,
    })
    expect(key).toContain(DEPLOYER.toLowerCase())
    expect(key.endsWith(':salt')).toBe(true)
  })

  it('persists and reloads vanity version plans', () => {
    const cacheKey = 'test-version-key'
    writePersistedVanityVersionPlan(cacheKey, {
      version: 'v1.13.0-v1',
      outcome: 'vault_only_match',
    })
    expect(readPersistedVanityVersionPlan(cacheKey)).toEqual({
      version: 'v1.13.0-v1',
      outcome: 'vault_only_match',
    })
  })

  it('persists and reloads share oft vanity salts', () => {
    const cacheKey = 'test-salt-key'
    const salt = `0x${'ab'.repeat(32)}` as Hex
    writePersistedShareOftVanitySalt(cacheKey, salt)
    expect(readPersistedShareOftVanitySalt(cacheKey)).toBe(salt)
  })

  it('builds share oft cache keys from init code hash', () => {
    const initCodeHash = keccak256('0x1234')
    const key = buildShareOftVanityCacheKey({
      create2Deployer: DEPLOYER,
      initCodeHash,
      shareOftVanitySuffix: '4626',
      shareOftVanityMaxTries: 1_000_000,
      deploymentVersion: 'v1.13.0-v1',
      creatorToken: CREATOR,
      owner: OWNER,
    })
    expect(key).toContain(initCodeHash.toLowerCase())
    expect(key).toContain('4626')
  })
})