import type { Address } from 'viem'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  ALFACLUB,
  FRIEND_KEY_ABI,
  getAlfaClubHoldings,
  getAlfaClubCreatorTokenId,
  scanAddressTransferredTokenIds,
  _resetAlfaClubPublicClientForTests,
  type AlfaClubPublicClientLike,
} from '../../server/_lib/wallet/alfaclub.ts'

const HOLDER = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9' as Address
const CREATOR_A = '0x1111111111111111111111111111111111111111' as Address
const CREATOR_B = '0x2222222222222222222222222222222222222222' as Address
const CREATOR_C = '0x3333333333333333333333333333333333333333' as Address

function transferSingleLog(id: bigint, to: Address) {
  return { args: { id, to, from: '0x0000000000000000000000000000000000000000' as Address, value: 1n } }
}
function transferBatchLog(ids: bigint[], to: Address) {
  return {
    args: {
      ids,
      to,
      from: '0x0000000000000000000000000000000000000000' as Address,
      values: ids.map(() => 1n),
    },
  }
}

type GetLogsArgs = {
  address?: Address
  event?: { type?: string; name?: string }
  args?: { to?: Address; from?: Address }
}

function makeClient(opts: {
  singleByTo?: Map<string, Array<{ args: { id: bigint; to: Address; from: Address; value: bigint } }>>
  batchByTo?: Map<string, Array<{ args: { ids: bigint[]; to: Address; from: Address; values: bigint[] } }>>
  mintsByCreator?: Map<string, Array<{ args: { id: bigint; to: Address; from: Address; value: bigint } }>>
  balances?: Map<string, bigint>
  creators?: Map<string, Address>
  throwGetLogs?: boolean
  throwReadContract?: boolean
}): AlfaClubPublicClientLike {
  return {
    async getLogs(args: unknown) {
      if (opts.throwGetLogs) throw new Error('rpc down')
      const a = args as GetLogsArgs
      const eventName = a.event?.name
      const toAddr = (a.args?.to ?? '').toString().toLowerCase()
      const fromAddr = (a.args?.from ?? '').toString().toLowerCase()

      if (eventName === 'TransferSingle') {
        if (fromAddr === '0x0000000000000000000000000000000000000000' && toAddr) {
          return opts.mintsByCreator?.get(toAddr) ?? []
        }
        return opts.singleByTo?.get(toAddr) ?? []
      }
      if (eventName === 'TransferBatch') {
        return opts.batchByTo?.get(toAddr) ?? []
      }
      return []
    },
    async readContract(args: unknown) {
      if (opts.throwReadContract) throw new Error('rpc down')
      const a = args as {
        functionName: string
        args: [Address, bigint] | [bigint]
      }
      if (a.functionName === 'balanceOf') {
        const [account, id] = a.args as [Address, bigint]
        const key = `${account.toLowerCase()}:${id.toString()}`
        return opts.balances?.get(key) ?? 0n
      }
      if (a.functionName === 'creatorByTokenId') {
        const [id] = a.args as [bigint]
        return opts.creators?.get(id.toString()) ?? '0x0000000000000000000000000000000000000000'
      }
      throw new Error(`unhandled functionName: ${a.functionName}`)
    },
  }
}

describe('alfaclub constants', () => {
  it('exports the three core Base contract addresses from the confirmed FriendDotSpace deployment', () => {
    expect(ALFACLUB.friendKey).toBe('0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F')
    expect(ALFACLUB.friendStakeBeacon).toBe('0x53BdEfB3E2faEB90b766B459AF96F3E357D3c3f9')
    expect(ALFACLUB.friendPool).toBe('0xa1bf9bb17C283CF17F01516f78f3127D2C84C79d')
    expect(ALFACLUB.chainId).toBe(8453)
  })

  it('FRIEND_KEY_ABI exposes the view functions and events the labeler relies on', () => {
    const functions = FRIEND_KEY_ABI.filter((x) => x.type === 'function').map(
      (x) => (x as { name?: string }).name,
    )
    const events = FRIEND_KEY_ABI.filter((x) => x.type === 'event').map(
      (x) => (x as { name?: string }).name,
    )
    expect(functions).toEqual(
      expect.arrayContaining([
        'balanceOf',
        'balanceOfBatch',
        'creatorByTokenId',
        'stakingPoolByTokenId',
        'totalSupply',
        'exists',
      ]),
    )
    expect(events).toEqual(expect.arrayContaining(['TransferSingle', 'TransferBatch']))
  })
})

describe('scanAddressTransferredTokenIds', () => {
  it('merges TransferSingle and TransferBatch ids and dedupes', async () => {
    const client = makeClient({
      singleByTo: new Map([
        [
          HOLDER.toLowerCase(),
          [transferSingleLog(10n, HOLDER), transferSingleLog(10n, HOLDER), transferSingleLog(25n, HOLDER)],
        ],
      ]),
      batchByTo: new Map([
        [HOLDER.toLowerCase(), [transferBatchLog([25n, 42n], HOLDER)]],
      ]),
    })

    const ids = await scanAddressTransferredTokenIds(HOLDER, client)
    expect(ids.sort((a, b) => Number(a - b))).toEqual([10n, 25n, 42n])
  })

  it('returns an empty list when no transfers match', async () => {
    const client = makeClient({})
    const ids = await scanAddressTransferredTokenIds(HOLDER, client)
    expect(ids).toEqual([])
  })
})

describe('getAlfaClubHoldings', () => {
  beforeEach(() => {
    _resetAlfaClubPublicClientForTests()
  })

  it('returns zero holdings when address has never received a key', async () => {
    const client = makeClient({})
    const result = await getAlfaClubHoldings(HOLDER, client)
    expect(result.isHolder).toBe(false)
    expect(result.isCreator).toBe(false)
    expect(result.holdings).toEqual([])
    expect(result.address).toBe(HOLDER.toLowerCase())
  })

  it('returns holdings with resolved creators for a keyholder', async () => {
    const client = makeClient({
      singleByTo: new Map([
        [HOLDER.toLowerCase(), [transferSingleLog(10n, HOLDER), transferSingleLog(25n, HOLDER)]],
      ]),
      balances: new Map([
        [`${HOLDER.toLowerCase()}:10`, 2n],
        [`${HOLDER.toLowerCase()}:25`, 1n],
      ]),
      creators: new Map([
        ['10', CREATOR_A],
        ['25', CREATOR_B],
      ]),
    })

    const result = await getAlfaClubHoldings(HOLDER, client)
    expect(result.isHolder).toBe(true)
    expect(result.isCreator).toBe(false)
    expect(result.holdings).toHaveLength(2)
    const byId = new Map(result.holdings.map((h) => [h.tokenId.toString(), h]))
    expect(byId.get('10')?.balance).toBe(2n)
    expect(byId.get('10')?.creator).toBe(CREATOR_A)
    expect(byId.get('25')?.balance).toBe(1n)
    expect(byId.get('25')?.creator).toBe(CREATOR_B)
  })

  it('drops tokenIds with zero current balance even if transfer history exists', async () => {
    const client = makeClient({
      singleByTo: new Map([
        [HOLDER.toLowerCase(), [transferSingleLog(10n, HOLDER), transferSingleLog(25n, HOLDER)]],
      ]),
      balances: new Map([
        [`${HOLDER.toLowerCase()}:10`, 0n],
        [`${HOLDER.toLowerCase()}:25`, 3n],
      ]),
      creators: new Map([['25', CREATOR_B]]),
    })

    const result = await getAlfaClubHoldings(HOLDER, client)
    expect(result.holdings).toHaveLength(1)
    expect(result.holdings[0]?.tokenId).toBe(25n)
  })

  it('flags the address as a creator when it holds a tokenId whose creatorByTokenId equals itself', async () => {
    const client = makeClient({
      singleByTo: new Map([
        [CREATOR_A.toLowerCase(), [transferSingleLog(7n, CREATOR_A)]],
      ]),
      balances: new Map([[`${CREATOR_A.toLowerCase()}:7`, 1n]]),
      creators: new Map([['7', CREATOR_A]]),
    })

    const result = await getAlfaClubHoldings(CREATOR_A, client)
    expect(result.isHolder).toBe(true)
    expect(result.isCreator).toBe(true)
  })

  it('fails open to an empty result when getLogs throws', async () => {
    const client = makeClient({ throwGetLogs: true })
    const result = await getAlfaClubHoldings(HOLDER, client)
    expect(result.isHolder).toBe(false)
    expect(result.holdings).toEqual([])
  })

  it('fails open when readContract throws during balance resolution', async () => {
    const client = makeClient({
      singleByTo: new Map([[HOLDER.toLowerCase(), [transferSingleLog(10n, HOLDER)]]]),
      throwReadContract: true,
    })
    const result = await getAlfaClubHoldings(HOLDER, client)
    expect(result.isHolder).toBe(false)
  })

  it('drops holdings whose creator resolves to the zero address (stale / deleted room)', async () => {
    const client = makeClient({
      singleByTo: new Map([
        [HOLDER.toLowerCase(), [transferSingleLog(99n, HOLDER), transferSingleLog(25n, HOLDER)]],
      ]),
      balances: new Map([
        [`${HOLDER.toLowerCase()}:99`, 4n],
        [`${HOLDER.toLowerCase()}:25`, 1n],
      ]),
      creators: new Map([
        ['99', '0x0000000000000000000000000000000000000000' as Address],
        ['25', CREATOR_C],
      ]),
    })

    const result = await getAlfaClubHoldings(HOLDER, client)
    expect(result.holdings.map((h) => h.tokenId)).toEqual([25n])
  })
})

describe('getAlfaClubCreatorTokenId', () => {
  it('returns the first mint tokenId received by a creator', async () => {
    const client = makeClient({
      mintsByCreator: new Map([
        [CREATOR_A.toLowerCase(), [transferSingleLog(42n, CREATOR_A)]],
      ]),
    })
    const id = await getAlfaClubCreatorTokenId(CREATOR_A, client)
    expect(id).toBe(42n)
  })

  it('returns null when the address has never received a mint', async () => {
    const client = makeClient({})
    const id = await getAlfaClubCreatorTokenId(CREATOR_A, client)
    expect(id).toBeNull()
  })

  it('returns null when getLogs throws (fail-open)', async () => {
    const client = makeClient({ throwGetLogs: true })
    const id = await getAlfaClubCreatorTokenId(CREATOR_A, client)
    expect(id).toBeNull()
  })
})

// Lightweight sanity check that the public client factory pins to Base.
describe('getAlfaClubPublicClient', () => {
  it('constructs a viem public client on Base using BASE_RPC_URL fallback', async () => {
    _resetAlfaClubPublicClientForTests()
    const originalLogs = process.env.BASE_LOGS_RPC_URL
    const originalBase = process.env.BASE_RPC_URL
    process.env.BASE_LOGS_RPC_URL = ''
    process.env.BASE_RPC_URL = 'https://mainnet.base.org'
    try {
      const { getAlfaClubPublicClient } = await import('../../server/_lib/wallet/alfaclub.ts')
      const client = await getAlfaClubPublicClient()
      expect(typeof client.getLogs).toBe('function')
      expect(typeof client.readContract).toBe('function')
    } finally {
      if (originalLogs === undefined) delete process.env.BASE_LOGS_RPC_URL
      else process.env.BASE_LOGS_RPC_URL = originalLogs
      if (originalBase === undefined) delete process.env.BASE_RPC_URL
      else process.env.BASE_RPC_URL = originalBase
      _resetAlfaClubPublicClientForTests()
    }
  })
})

// Suppress unused-import warnings for vi when not used directly.
void vi
