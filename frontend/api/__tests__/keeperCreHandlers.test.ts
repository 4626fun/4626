import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  dbSqlMock,
  getDbMock,
  ensureKeeperCreSchemaMock,
  upsertKeeperCreAttestationMock,
  upsertKeeperCreStrategyHealthMock,
  enqueueKeeperJobMock,
  readContractMock,
  writeContractMock,
  waitForReceiptMock,
} = vi.hoisted(() => ({
  dbSqlMock: vi.fn(async () => ({ rows: [] as any[] })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
  ensureKeeperCreSchemaMock: vi.fn(async () => undefined),
  upsertKeeperCreAttestationMock: vi.fn(async () => 123),
  upsertKeeperCreStrategyHealthMock: vi.fn(async () => undefined),
  enqueueKeeperJobMock: vi.fn(async () => ({ id: 77, kind: 'internal_api' })),
  readContractMock: vi.fn(async () => [1000n, BigInt(Math.floor(Date.now() / 1000))]),
  writeContractMock: vi.fn(async () => '0xhash'),
  waitForReceiptMock: vi.fn(async () => ({ status: 'success' })),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  getDbForCron: getDbMock,
  isDbConfigured: () => true,
}))

vi.mock('../../server/_lib/db/schemaBootstrap.js', () => ({
  ensureKeeperCreSchema: ensureKeeperCreSchemaMock,
}))

vi.mock('../../server/_lib/keeper/creAttestations.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/_lib/keeper/creAttestations.ts')>(
    '../../server/_lib/keeper/creAttestations.ts',
  )
  return {
    ...actual,
    upsertKeeperCreAttestation: upsertKeeperCreAttestationMock,
    upsertKeeperCreStrategyHealth: upsertKeeperCreStrategyHealthMock,
  }
})

vi.mock('../../server/_lib/keeperJobs/keeperJobs.js', () => ({
  enqueueKeeperJob: enqueueKeeperJobMock,
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: readContractMock,
      waitForTransactionReceipt: waitForReceiptMock,
    })),
    createWalletClient: vi.fn(() => ({
      writeContract: writeContractMock,
    })),
    http: vi.fn(),
  }
})

import { getApiHandler } from '../_handlers/_routes.js'
import creOracleValidateUpdateHandler from '../_handlers/keeper/_creOracleValidateUpdate.js'
import creSolanaNavIngestHandler from '../_handlers/keeper/_creSolanaNavIngest.js'
import creSolanaNavUpdateHandler from '../_handlers/keeper/_creSolanaNavUpdate.js'
import creStrategyHealthIngestHandler from '../_handlers/keeper/_creStrategyHealthIngest.js'

const API_KEY = 'cre-keeper-api-key'
const AUTH = { authorization: `Bearer ${API_KEY}` }

describe('keeper CRE handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyEnv({
      KPR_API_KEY: API_KEY,
      KPR_PRIVATE_KEY: `0x${'1'.repeat(64)}`,
      CRE_SOLANA_NAV_SHADOW_ONLY: '1',
      CRE_SOLANA_NAV_WRITE_ENABLED: '0',
      CRE_ORACLE_SHADOW_ONLY: '1',
      CRE_ORACLE_VALIDATOR_WRITE_ENABLED: '0',
      CRE_KILL_SWITCH: '0',
    })
  })

  it('registers CRE routes in the API route map', async () => {
    await expect(getApiHandler('keeper/cre-solana-nav-ingest')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/cre-solana-nav-update')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/cre-strategy-health-ingest')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/cre-oracle-validate-update')).resolves.toBeTypeOf('function')
  })

  it('ingests Solana NAV payload in shadow mode without enqueueing writes', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        strategyAddress: '0x1111111111111111111111111111111111111111',
        reportedRemoteNav: '1000000000000000000',
        source: 'cre-test',
      },
    })
    const res = createMockRes()

    await creSolanaNavIngestHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.mode).toBe('shadow_only')
    expect(enqueueKeeperJobMock).not.toHaveBeenCalled()
    expect(upsertKeeperCreAttestationMock).toHaveBeenCalled()
  })

  it('queues Solana NAV write when write lane is enabled', async () => {
    applyEnv({
      CRE_SOLANA_NAV_SHADOW_ONLY: '0',
      CRE_SOLANA_NAV_WRITE_ENABLED: '1',
    })
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        strategyAddress: '0x1111111111111111111111111111111111111111',
        reportedRemoteNav: '1000000000000000000',
        source: 'cre-test',
      },
    })
    const res = createMockRes()

    await creSolanaNavIngestHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.mode).toBe('queued')
    expect(enqueueKeeperJobMock).toHaveBeenCalledTimes(1)
  })

  it('persists strategy health updates', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        vaultAddress: '0x2222222222222222222222222222222222222222',
        strategyAddress: '0x1111111111111111111111111111111111111111',
        status: 'healthy',
        confidenceBps: 9000,
        source: 'cre-test',
      },
    })
    const res = createMockRes()
    await creStrategyHealthIngestHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(upsertKeeperCreStrategyHealthMock).toHaveBeenCalledTimes(1)
  })

  it('keeps oracle validator in monitor mode when writes are disabled', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        oracleAddress: '0x3333333333333333333333333333333333333333',
        proposedPrice: '1000',
        source: 'cre-test',
      },
    })
    const res = createMockRes()
    await creOracleValidateUpdateHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.status).toBe('monitor_only')
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('skips direct NAV write endpoint when writes are disabled', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        strategyAddress: '0x1111111111111111111111111111111111111111',
        reportId: `0x${'a'.repeat(64)}`,
        reportedRemoteNav: '123',
        source: 'cre-test',
      },
    })
    const res = createMockRes()
    await creSolanaNavUpdateHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.status).toBe('skipped')
    expect(writeContractMock).not.toHaveBeenCalled()
  })
})
