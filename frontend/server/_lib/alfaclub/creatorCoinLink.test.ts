import { encodeFunctionData, parseAbi } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import {
  CreatorCoinLinkError,
  buildCreatorCoinLinkChallengeMessage,
  consumeCreatorCoinLinkChallenge,
  inspectCreatorCoinLink,
  issueCreatorCoinLinkChallenge,
} from './creatorCoinLink'

const CSW = '0x1000000000000000000000000000000000000000'
const EOA = '0x2000000000000000000000000000000000000000'
const COIN = '0x3000000000000000000000000000000000000000'
const PAYOUT = '0x4000000000000000000000000000000000000000'
const CONTROLLER = '0x5000000000000000000000000000000000000000'

const GRANT_ABI = parseAbi(['function addOwner(address newOwner)'])

function profileRow() {
  return {
    id: 7,
    csw_address: CSW,
    primary_wallet: EOA,
    primary_embedded_eoa: null,
    linked_wallets: [CSW, EOA],
  }
}

function makeDb(options?: { claims?: any[]; deployPayload?: unknown }) {
  let challenge: any = null
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(' ')
    if (query.includes('FROM profiles p')) return { rows: [profileRow()] }
    if (query.includes('FROM alfaclub.creator_coin_links')) {
      return { rows: options?.claims ?? [] }
    }
    if (query.includes('FROM keepr_vaults')) {
      return {
        rows: options?.deployPayload
          ? [{
              vault_address: '0x6000000000000000000000000000000000000000',
              share_token_address: '0x7000000000000000000000000000000000000000',
              config_json: { contracts: { payoutRouter: PAYOUT } },
            }]
          : [],
      }
    }
    if (query.includes('FROM deploys')) {
      return { rows: options?.deployPayload ? [{ payload: options.deployPayload }] : [] }
    }
    if (
      query.includes('DELETE FROM alfaclub.creator_coin_link_challenges') &&
      query.includes('RETURNING')
    ) {
      const found = challenge
      challenge = null
      return { rows: found ? [found] : [] }
    }
    if (query.includes('DELETE FROM alfaclub.creator_coin_link_challenges')) {
      challenge = null
      return { rows: [] }
    }
    if (query.includes('INSERT INTO alfaclub.creator_coin_link_challenges')) {
      challenge = {
        profile_id: 7,
        room_id: values[2],
        token_id: values[3],
        creator_coin_address: values[4],
        execution_address: values[5],
        expires_at: values[6],
      }
      return { rows: [] }
    }
    throw new Error(`Unexpected SQL: ${query}`)
  })
  return { sql }
}

function makeClient(options?: {
  owners?: string[]
  payoutRecipient?: string
  callReject?: boolean
  controller?: boolean
}) {
  const readContract = vi.fn(async (args: any) => {
    switch (args.functionName) {
      case 'creatorByTokenId':
        return CSW
      case 'name':
        return 'Creator'
      case 'symbol':
        return 'CREATOR'
      case 'decimals':
        return 18
      case 'creator':
        return CSW
      case 'payoutRecipient':
        return options?.payoutRecipient ?? PAYOUT
      case 'owners':
        return options?.owners ?? [CSW]
      case 'owner':
        throw new Error('multi-owner coin')
      case 'creatorCoin':
        return options?.controller ? COIN : '0x0000000000000000000000000000000000000000'
      case 'payoutRouter':
        return PAYOUT
      default:
        throw new Error(`Unexpected read ${String(args.functionName)}`)
    }
  })
  return {
    getBytecode: vi.fn(async () => '0x1234'),
    getBlockNumber: vi.fn(async () => 31_337n),
    readContract,
    call: options?.callReject
      ? vi.fn(async () => {
          throw new Error('not authorized')
        })
      : vi.fn(async () => ({ data: '0x' })),
  }
}

describe('Creator Coin linking authority', () => {
  it('rejects an address without Base contract code', async () => {
    const client = makeClient()
    client.getBytecode.mockResolvedValueOnce('0x')
    await expect(
      inspectCreatorCoinLink({
        sessionAddress: CSW,
        roomId: '1659',
        creatorCoinAddress: COIN,
        executionAddress: CSW,
        db: makeDb() as any,
        client: client as any,
      }),
    ).rejects.toMatchObject({
      code: 'not_a_contract',
      status: 400,
    } satisfies Partial<CreatorCoinLinkError>)
  })

  it('rejects an execution address outside the signed-in 4626 account', async () => {
    await expect(
      inspectCreatorCoinLink({
        sessionAddress: CSW,
        roomId: '1659',
        creatorCoinAddress: COIN,
        executionAddress: '0x9900000000000000000000000000000000000000',
        db: makeDb() as any,
        client: makeClient() as any,
      }),
    ).rejects.toMatchObject({
      code: 'execution_address_mismatch',
      status: 403,
    } satisfies Partial<CreatorCoinLinkError>)
  })

  it('rejects a room controlled by another account', async () => {
    const client = makeClient()
    client.readContract.mockImplementation(async (args: any) => {
      if (args.functionName === 'creatorByTokenId') {
        return '0x9900000000000000000000000000000000000000'
      }
      throw new Error('unexpected read')
    })
    await expect(
      inspectCreatorCoinLink({
        sessionAddress: CSW,
        roomId: '1659',
        creatorCoinAddress: COIN,
        executionAddress: CSW,
        db: makeDb() as any,
        client: client as any,
      }),
    ).rejects.toMatchObject({
      code: 'room_control_not_verified',
      status: 403,
    } satisfies Partial<CreatorCoinLinkError>)
  })

  it('verifies direct ownership only when the no-op payout simulation succeeds', async () => {
    const client = makeClient()
    const inspection = await inspectCreatorCoinLink({
      sessionAddress: CSW,
      roomId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: CSW,
      db: makeDb() as any,
      client: client as any,
    })

    expect(inspection.status).toBe('verified_owner')
    expect(inspection.verificationMethod).toBe('direct_owner')
    expect(client.call).toHaveBeenCalledTimes(1)
    expect(inspection.creatorCoinPayoutRecipient).toBe(PAYOUT.toLowerCase())
  })

  it('does not treat the current creatorCoinPayoutRecipient as ownership proof', async () => {
    const inspection = await inspectCreatorCoinLink({
      sessionAddress: CSW,
      roomId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: CSW,
      db: makeDb() as any,
      client: makeClient({
        owners: ['0x9000000000000000000000000000000000000000'],
        payoutRecipient: CSW,
        callReject: true,
      }) as any,
    })

    expect(inspection.status).toBe('control_not_verified')
    expect(inspection.verificationMethod).toBeNull()
  })

  it('recognizes only a policy controller granted by this profile deployment', async () => {
    const grantData = encodeFunctionData({
      abi: GRANT_ABI,
      functionName: 'addOwner',
      args: [CONTROLLER],
    })
    const inspection = await inspectCreatorCoinLink({
      sessionAddress: CSW,
      roomId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: CSW,
      db: makeDb({
        deployPayload: {
          creatorToken: COIN,
          phase2FinalizeCalls: [{ to: COIN, data: grantData }],
        },
      }) as any,
      client: makeClient({
        owners: [CONTROLLER],
        callReject: true,
        controller: true,
      }) as any,
    })

    expect(inspection.status).toBe('managed_by_policy_controller')
    expect(inspection.policyControllerAddress).toBe(CONTROLLER.toLowerCase())
  })

  it('reports a cross-account uniqueness conflict without exposing its link', async () => {
    const foreignClaim = {
      room_id: '99',
      token_id: '99',
      creator_coin_address: COIN,
      profile_id: 88,
      execution_address: '0x8800000000000000000000000000000000000000',
      verification_method: 'direct_owner',
      verification_block: '1',
      coin_name: 'Creator',
      coin_symbol: 'CREATOR',
      coin_decimals: 18,
      owner_snapshot: ['0x8800000000000000000000000000000000000000'],
      creator_coin_payout_recipient: PAYOUT,
      verification_metadata: { creator: '0x8800000000000000000000000000000000000000' },
      created_at: new Date().toISOString(),
    }
    const inspection = await inspectCreatorCoinLink({
      sessionAddress: CSW,
      roomId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: CSW,
      db: makeDb({ claims: [foreignClaim] }) as any,
      client: makeClient() as any,
    })

    expect(inspection.status).toBe('claimed_by_another_account')
    expect(inspection.existingLink).toBeNull()
  })
})

describe('Creator Coin link challenges', () => {
  it('binds the challenge to chain, account, room, coin, and execution address', () => {
    const message = buildCreatorCoinLinkChallengeMessage({
      profileId: 7,
      roomId: '1659',
      tokenId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: CSW,
      nonce: 'nonce',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })
    expect(message).toContain('Chain: Base (8453)')
    expect(message).toContain('4626 Account: 7')
    expect(message).toContain(`Creator Coin: ${COIN}`)
    expect(message).toContain(`Execution Address: ${CSW}`)
  })

  it('consumes a challenge once and rejects replay', async () => {
    const db = makeDb()
    const inspection = await inspectCreatorCoinLink({
      sessionAddress: CSW,
      roomId: '1659',
      creatorCoinAddress: COIN,
      executionAddress: CSW,
      db: db as any,
      client: makeClient() as any,
    })
    const challenge = await issueCreatorCoinLinkChallenge({
      sessionAddress: CSW,
      inspection,
      db: db as any,
    })

    const first = await consumeCreatorCoinLinkChallenge({
      sessionAddress: CSW,
      nonce: challenge.nonce,
      db: db as any,
    })
    expect(first.row.roomId).toBe('1659')

    await expect(
      consumeCreatorCoinLinkChallenge({
        sessionAddress: CSW,
        nonce: challenge.nonce,
        db: db as any,
      }),
    ).rejects.toMatchObject({
      code: 'invalid_or_expired_challenge',
      status: 409,
    } satisfies Partial<CreatorCoinLinkError>)
  })
})
