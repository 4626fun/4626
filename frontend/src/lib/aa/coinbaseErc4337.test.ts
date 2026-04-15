import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters } from 'viem'

import {
  findCoinbaseSmartWalletOwnerIndex,
  pollUserOperationStatus,
  resetOwnerIndexCacheForTests,
  sendCoinbaseSmartWalletUserOperation,
  simulateSmartWalletCalls,
  verifyBundlerSupportsV06,
} from './coinbaseErc4337'

const SMART_WALLET = '0x1111111111111111111111111111111111111111'
const OWNER_ADDRESS = '0x2222222222222222222222222222222222222222'
const OTHER_ADDRESS = '0x3333333333333333333333333333333333333333'
const LOOKUP_ADDRESS = '0x4444444444444444444444444444444444444444'
const NON_OWNER_ADDRESS = '0x5555555555555555555555555555555555555555'
const TX_HASH = `0x${'a'.repeat(64)}`
const USER_OP_HASH = `0x${'b'.repeat(64)}`

type ReadContractArgs = {
  functionName: string
  args?: unknown[]
}

function createPublicClient(params: { ownerCount: () => bigint }) {
  const ownerBytes = encodeAbiParameters([{ type: 'address' }], [OWNER_ADDRESS])
  const otherBytes = encodeAbiParameters([{ type: 'address' }], [OTHER_ADDRESS])

  const readContract = vi.fn(async ({ functionName, args }: ReadContractArgs) => {
    if (functionName === 'ownerCount') return params.ownerCount()
    if (functionName === 'nextOwnerIndex') return params.ownerCount()
    if (functionName === 'ownerAtIndex') {
      const index = Number((args?.[0] as bigint | undefined) ?? 0n)
      return index === 1 ? ownerBytes : otherBytes
    }
    throw new Error(`Unexpected functionName: ${functionName}`)
  })

  return {
    client: {
      chain: { id: 8453 },
      readContract,
    },
    readContract,
  }
}

describe('coinbaseErc4337 latency helpers', () => {
  beforeEach(() => {
    resetOwnerIndexCacheForTests()
  })

  afterEach(() => {
    resetOwnerIndexCacheForTests()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('caches owner index and avoids rescan when ownerCount is unchanged', async () => {
    let ownerCount = 2n
    const { client, readContract } = createPublicClient({ ownerCount: () => ownerCount })

    const first = await findCoinbaseSmartWalletOwnerIndex({
      publicClient: client as any,
      smartWallet: SMART_WALLET as `0x${string}`,
      ownerAddress: OWNER_ADDRESS as `0x${string}`,
    })
    const second = await findCoinbaseSmartWalletOwnerIndex({
      publicClient: client as any,
      smartWallet: SMART_WALLET as `0x${string}`,
      ownerAddress: OWNER_ADDRESS as `0x${string}`,
    })

    expect(first).toEqual({ ownerIndex: 1, ownerCount: Number(ownerCount) })
    expect(second).toEqual({ ownerIndex: 1, ownerCount: Number(ownerCount) })
    const fnCalls = readContract.mock.calls.map(([arg]) => (arg as ReadContractArgs).functionName)
    expect(fnCalls.filter((name) => name === 'ownerCount')).toHaveLength(2)
    expect(fnCalls.filter((name) => name === 'nextOwnerIndex')).toHaveLength(1)
    expect(fnCalls.filter((name) => name === 'ownerAtIndex')).toHaveLength(2)
  })

  it('invalidates owner index cache when ownerCount changes', async () => {
    let ownerCount = 2n
    const { client, readContract } = createPublicClient({ ownerCount: () => ownerCount })

    await findCoinbaseSmartWalletOwnerIndex({
      publicClient: client as any,
      smartWallet: SMART_WALLET as `0x${string}`,
      ownerAddress: OWNER_ADDRESS as `0x${string}`,
    })
    ownerCount = 3n
    await findCoinbaseSmartWalletOwnerIndex({
      publicClient: client as any,
      smartWallet: SMART_WALLET as `0x${string}`,
      ownerAddress: OWNER_ADDRESS as `0x${string}`,
    })

    const fnCalls = readContract.mock.calls.map(([arg]) => (arg as ReadContractArgs).functionName)
    expect(fnCalls.filter((name) => name === 'nextOwnerIndex')).toHaveLength(2)
    expect(fnCalls.filter((name) => name === 'ownerAtIndex').length).toBeGreaterThanOrEqual(4)
  })

  it('supports explicit cache bypass for owner index lookup', async () => {
    const { client, readContract } = createPublicClient({ ownerCount: () => 2n })

    await findCoinbaseSmartWalletOwnerIndex({
      publicClient: client as any,
      smartWallet: SMART_WALLET as `0x${string}`,
      ownerAddress: OWNER_ADDRESS as `0x${string}`,
    })
    await findCoinbaseSmartWalletOwnerIndex({
      publicClient: client as any,
      smartWallet: SMART_WALLET as `0x${string}`,
      ownerAddress: OWNER_ADDRESS as `0x${string}`,
      useCache: false,
    })

    const fnCalls = readContract.mock.calls.map(([arg]) => (arg as ReadContractArgs).functionName)
    expect(fnCalls.filter((name) => name === 'nextOwnerIndex')).toHaveLength(2)
  })

  it('falls back from explicit ownerIndexLookupAddress when it is not an onchain owner', async () => {
    const ownerBytes = encodeAbiParameters([{ type: 'address' }], [OWNER_ADDRESS])
    const otherBytes = encodeAbiParameters([{ type: 'address' }], [OTHER_ADDRESS])
    const readContract = vi.fn(async ({ functionName, args }: ReadContractArgs) => {
      if (functionName === 'ownerCount') return 2n
      if (functionName === 'nextOwnerIndex') return 2n
      if (functionName === 'ownerAtIndex') {
        const index = Number((args?.[0] as bigint | undefined) ?? 0n)
        return index === 0 ? ownerBytes : otherBytes
      }
      throw new Error(`Unexpected functionName: ${functionName}`)
    })

    await expect(
      sendCoinbaseSmartWalletUserOperation({
        publicClient: { chain: { id: 8453 }, readContract } as any,
        walletClient: {} as any,
        bundlerUrl: 'https://bundler.invalid',
        smartWallet: SMART_WALLET as `0x${string}`,
        ownerAddress: NON_OWNER_ADDRESS as `0x${string}`,
        ownerIndexLookupAddress: LOOKUP_ADDRESS as `0x${string}`,
        calls: [{ to: OWNER_ADDRESS as `0x${string}`, data: '0x1234' as `0x${string}` }],
      }),
    ).rejects.toThrow(`Connected wallet (${NON_OWNER_ADDRESS}) is not an onchain owner of the smart wallet (${SMART_WALLET}).`)

    const ownerAtIndexCalls = readContract.mock.calls
      .map(([arg]) => arg as ReadContractArgs)
      .filter((arg) => arg.functionName === 'ownerAtIndex')
    expect(ownerAtIndexCalls).toHaveLength(4)
  })

  it('treats Unauthorized executeBatch simulation as non-blocking', async () => {
    const simulateContract = vi.fn(async () => {
      const err = new Error('execution reverted') as Error & { data?: string }
      err.data = '0x82b42900'
      throw err
    })
    const client = {
      simulateContract,
      call: vi.fn(),
    }

    const result = await simulateSmartWalletCalls({
      publicClient: client as any,
      smartWallet: SMART_WALLET as `0x${string}`,
      calls: [
        { to: OWNER_ADDRESS as `0x${string}`, data: '0x1234' as `0x${string}` },
        { to: OTHER_ADDRESS as `0x${string}`, data: '0xabcd' as `0x${string}` },
      ],
    })

    expect(result.success).toBe(true)
    expect(simulateContract).toHaveBeenCalledTimes(1)
  })

  it('keeps direct-call revert when execute simulation is Unauthorized', async () => {
    const call = vi.fn(async () => {
      const err = new Error('execution reverted') as Error & { data?: string }
      err.data = '0x30cd7471'
      throw err
    })
    const simulateContract = vi.fn(async () => {
      const err = new Error('execution reverted') as Error & { data?: string }
      err.data = '0x82b42900'
      throw err
    })
    const client = {
      call,
      simulateContract,
    }

    const result = await simulateSmartWalletCalls({
      publicClient: client as any,
      smartWallet: SMART_WALLET as `0x${string}`,
      calls: [{ to: OWNER_ADDRESS as `0x${string}`, data: '0x1234' as `0x${string}` }],
    })

    expect(result.success).toBe(false)
    expect(result.errorName).toBe('NotOwner()')
  })

  it('treats bundler probe timeout as non-fatal', async () => {
    vi.useFakeTimers()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const abortError = new Error('aborted')
        ;(abortError as any).name = 'AbortError'
        ;(init.signal as AbortSignal | undefined)?.addEventListener('abort', () => reject(abortError))
      })
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const probePromise = verifyBundlerSupportsV06('https://bundler.invalid', { timeoutMs: 10 })
    await vi.advanceTimersByTimeAsync(20)
    await expect(probePromise).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('pollUserOperationStatus resolves confirmed when receipt arrives', async () => {
    const statuses: string[] = []
    const bundlerClient = {
      getUserOperationReceipt: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ receipt: { transactionHash: TX_HASH, status: '0x1' } }),
    }

    const result = await pollUserOperationStatus({
      bundlerClient,
      userOpHash: USER_OP_HASH as `0x${string}`,
      options: {
        pollIntervalMs: 1,
        maxDurationMs: 50,
        perCheckTimeoutMs: 20,
        onStatusChange: (status) => statuses.push(status),
      },
    })

    expect(result).toEqual({ status: 'confirmed', txHash: TX_HASH })
    expect(statuses).toContain('pending')
    expect(statuses).toContain('confirmed')
  })

  it('pollUserOperationStatus returns timeout when receipt does not arrive', async () => {
    const bundlerClient = {
      getUserOperationReceipt: vi.fn().mockResolvedValue(null),
    }

    const result = await pollUserOperationStatus({
      bundlerClient,
      userOpHash: USER_OP_HASH as `0x${string}`,
      options: {
        pollIntervalMs: 1,
        maxDurationMs: 6,
        perCheckTimeoutMs: 3,
      },
    })

    expect(result).toEqual({ status: 'timeout' })
  })
})
