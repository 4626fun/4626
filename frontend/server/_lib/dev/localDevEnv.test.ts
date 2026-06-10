import { afterEach, describe, expect, it } from 'vitest'

import {
  applyDeployDryRunLocalDevEnv,
  filterDevelopmentRpcUrls,
  isDeployDryRunDbDisabled,
  resolveLocalDryRunRpcUrl,
} from './localDevEnv.js'

const ENV_KEYS = [
  'DEPLOY_DRY_RUN_PORT',
  'VITE_DEPLOYMENT_VERSION',
  'DEPLOY_DRY_RUN_KEEP_DB_ENV',
  'DEPLOY_DRY_RUN_LOCAL_RPC_URL',
  'DATABASE_URL',
  'BASE_READ_RPC_URL',
  'BASE_LOGS_RPC_URL',
  'NODE_ENV',
] as const

const prior: Record<string, string | undefined> = {}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = prior[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function snapshotEnv() {
  for (const key of ENV_KEYS) {
    prior[key] = process.env[key]
  }
}

describe('localDevEnv', () => {
  it('detects disabled dry-run db by default', () => {
    snapshotEnv()
    process.env.DEPLOY_DRY_RUN_PORT = '5174'
    delete process.env.DEPLOY_DRY_RUN_KEEP_DB_ENV
    expect(isDeployDryRunDbDisabled()).toBe(true)
  })

  it('applyDeployDryRunLocalDevEnv routes proxy reads to the local fork and clears db', () => {
    snapshotEnv()
    process.env.DEPLOY_DRY_RUN_PORT = '5174'
    process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL = 'http://127.0.0.1:8545'
    process.env.DATABASE_URL = 'postgresql://example'
    process.env.BASE_READ_RPC_URL = 'https://slow.example/rpc'

    applyDeployDryRunLocalDevEnv()

    expect(process.env.BASE_READ_RPC_URL).toBe('http://127.0.0.1:8545')
    expect(process.env.BASE_LOGS_RPC_URL).toBe('http://127.0.0.1:8545')
    expect(process.env.DATABASE_URL).toBeUndefined()
  })

  it('resolveLocalDryRunRpcUrl accepts loopback hosts only', () => {
    snapshotEnv()
    process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL = 'http://127.0.0.1:8545'
    expect(resolveLocalDryRunRpcUrl()).toBe('http://127.0.0.1:8545')
    process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL = 'https://eu.endpoints.matrixed.link/rpc/base'
    expect(resolveLocalDryRunRpcUrl()).toBeNull()
  })

  it('filterDevelopmentRpcUrls drops matrixed when other urls exist', () => {
    snapshotEnv()
    process.env.NODE_ENV = 'development'
    const filtered = filterDevelopmentRpcUrls([
      'https://base-mainnet.g.alchemy.com/v2/test',
      'https://eu.endpoints.matrixed.link/rpc/base',
    ])
    expect(filtered).toEqual(['https://base-mainnet.g.alchemy.com/v2/test'])
  })
})
