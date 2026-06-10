import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/status/_vaultReport.ts'
import { createMockReq, createMockRes } from './helpers'

const VAULT = '0x1111111111111111111111111111111111111111'
const OWNER = '0x2222222222222222222222222222222222222222'
const CREATOR = '0x3333333333333333333333333333333333333333'
const STRATEGY = '0x4444444444444444444444444444444444444444'
const INNER_VAULT = '0x5555555555555555555555555555555555555555'
const AJNA_POOL = '0x6666666666666666666666666666666666666666'
const AJNA_AUTH = '0x7777777777777777777777777777777777777777'
const USDC = '0x8888888888888888888888888888888888888888'
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`

type Scenario = {
  hasAjnaPool: boolean
  hasAjnaAuth: boolean
  paused: boolean
}

let scenario: Scenario = {
  hasAjnaPool: false,
  hasAjnaAuth: false,
  paused: false,
}

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  readContract: vi.fn(),
  multicall: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mocks.readContract,
      multicall: mocks.multicall,
    })),
  }
})

function success(result: unknown) {
  return { status: 'success', result }
}

function failure(message: string = 'missing') {
  return { status: 'failure', error: new Error(message) }
}

describe('status vault report Ajna classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scenario = {
      hasAjnaPool: false,
      hasAjnaAuth: false,
      paused: false,
    }

    mocks.handleOptions.mockReturnValue(false)
    mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'symbol') return 'KPR'
      throw new Error(`Unexpected readContract call: ${functionName}`)
    })
    mocks.multicall.mockImplementation(async ({ contracts }: { contracts: Array<{ address: string; functionName: string }> }) =>
      contracts.map(({ address, functionName }) => {
        switch (functionName) {
          case 'owner':
            return success(OWNER)
          case 'CREATOR_COIN':
            return success(CREATOR)
          case 'gaugeController':
            return success(ZERO_ADDRESS)
          case 'name':
            return success(address.toLowerCase() === VAULT.toLowerCase() ? 'Creator Vault' : 'Creator')
          case 'symbol':
            return success(address.toLowerCase() === VAULT.toLowerCase() ? 'CVLT' : 'KPR')
          case 'getStrategies':
            return success([[STRATEGY], [10_000n], [0n]])
          case 'isActive':
            return success(true)
          case 'asset':
            return success(CREATOR)
          case 'charmVault':
            return failure()
          case 'bridgeAdapter':
            return failure()
          case 'solanaDestination':
            return success(ZERO_BYTES32)
          case 'ERC4626_VAULT':
            return success(INNER_VAULT)
          case 'AJNA_POOL':
            return scenario.hasAjnaPool ? success(AJNA_POOL) : failure()
          case 'AUTH':
            return scenario.hasAjnaAuth ? success(AJNA_AUTH) : failure()
          case 'collateralAddress':
            return success(USDC)
          case 'admin':
            return success(OWNER)
          case 'bufferRatio':
            return success(500n)
          case 'minBucketIndex':
            return success(900n)
          case 'paused':
            return success(scenario.paused)
          case 'getPool':
            return success(ZERO_ADDRESS)
          default:
            return failure(`Unhandled multicall function: ${functionName}`)
        }
      }),
    )
  })

  it('does not classify a generic ERC4626 adapter as Ajna without a readable Ajna pool', async () => {
    scenario = {
      hasAjnaPool: false,
      hasAjnaAuth: true,
      paused: false,
    }

    const req = createMockReq({
      method: 'GET',
      query: { vault: VAULT },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const strategySection = res.body?.data?.sections.find((section: any) => section.id === 'strategies')
    const strategyCheck = strategySection?.checks.find((check: any) => check.id === 'strategy-0')
    expect(strategyCheck?.label).toBe('Strategy #1')
    expect(res.body?.data?.context?.ajnaAdapterAddress).toBeNull()
    expect(res.body?.data?.context?.ajnaAuthAddress).toBeNull()
  })

  it('downgrades a paused nested Ajna strategy from pass to warn', async () => {
    scenario = {
      hasAjnaPool: true,
      hasAjnaAuth: true,
      paused: true,
    }

    const req = createMockReq({
      method: 'GET',
      query: { vault: VAULT },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const strategySection = res.body?.data?.sections.find((section: any) => section.id === 'strategies')
    const strategyCheck = strategySection?.checks.find((check: any) => check.id === 'strategy-0')
    expect(strategyCheck?.label).toBe('Ajna lending (adapter-backed inner vault)')
    expect(strategyCheck?.status).toBe('warn')
    expect(String(strategyCheck?.details ?? '')).toContain('paused=true')
    expect(res.body?.data?.context?.ajnaAuthAddress).toBe(AJNA_AUTH)
    expect(res.body?.data?.context?.ajnaPaused).toBe(true)
  })
})
