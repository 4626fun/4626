import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAccountMock,
  sendAndConfirmTransactionMock,
  getProgramAccountsMock,
} = vi.hoisted(() => ({
  getAccountMock: vi.fn(),
  sendAndConfirmTransactionMock: vi.fn(async () => 'solana-signature'),
  getProgramAccountsMock: vi.fn(),
}))

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<any>('@solana/web3.js')
  return {
    ...actual,
    Connection: class {
      getProgramAccounts = getProgramAccountsMock
    },
    Transaction: class {
      add() {
        return this
      }
    },
    sendAndConfirmTransaction: sendAndConfirmTransactionMock,
  }
})

vi.mock('@solana/spl-token', async () => {
  const web3 = await vi.importActual<any>('@solana/web3.js')
  const program = new web3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')
  return {
    TOKEN_2022_PROGRAM_ID: program,
    getTransferFeeConfig: vi.fn(() => ({ withdrawWithheldAuthority: program })),
    getMint: vi.fn(async () => ({})),
    getAccount: getAccountMock,
    getAssociatedTokenAddressSync: vi.fn(() => program),
    createAssociatedTokenAccountIdempotentInstruction: vi.fn(() => ({})),
  }
})

vi.mock('../utils/solana.js', async () => {
  const web3 = await vi.importActual<any>('@solana/web3.js')
  return {
    loadKeeperKeypair: vi.fn(() => web3.Keypair.generate()),
  }
})

vi.mock('../utils/alerts.js', () => ({
  alertInfo: vi.fn(async () => undefined),
  alertWarning: vi.fn(async () => undefined),
  alertCritical: vi.fn(async () => undefined),
}))

import { executeSolanaFeeSettlement } from '../actions/keepr-solana-settle-fees.action.js'

describe('keepr Solana fee harvest-only lane', () => {
  const envKeys = [
    'SOLANA_RPC_URL',
    'SOLANA_CREATOR_MINTS',
    'SOLANA_BRIDGE_ADAPTER',
    'SOLANA_KEEPER_PUBKEY',
    'SOLANA_SHARE_OFT_MAPPING',
  ] as const
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SOLANA_RPC_URL = 'https://solana.invalid'
    process.env.SOLANA_CREATOR_MINTS =
      '11111111111111111111111111111111,SysvarRent111111111111111111111111111111111'
    delete process.env.SOLANA_BRIDGE_ADAPTER
    delete process.env.SOLANA_KEEPER_PUBKEY
    delete process.env.SOLANA_SHARE_OFT_MAPPING
    getProgramAccountsMock.mockResolvedValue([
      { pubkey: { toString: () => 'fee-account' } },
    ])
    getAccountMock
      .mockResolvedValueOnce({ amount: 0n })
      .mockResolvedValueOnce({ amount: 600_000n })
      .mockResolvedValueOnce({ amount: 0n })
      .mockResolvedValueOnce({ amount: 500_000n })
  })

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('reports only the aggregate amount harvested into the keeper ATA', async () => {
    const result = await executeSolanaFeeSettlement()

    expect(result.solanaHarvestedAmount).toBe('1100000')
    expect(result.harvestThresholdMet).toBe(true)
    expect(result.mappingIntegrityFailures).toBe(0)
  })
})
