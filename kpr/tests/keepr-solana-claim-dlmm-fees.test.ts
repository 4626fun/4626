import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicKey } from '@solana/web3.js'

const {
  sendAndConfirmTransactionMock,
  getAccountMock,
  createMock,
  claimAllSwapFeeMock,
  getPositionsByUserAndLbPairMock,
} = vi.hoisted(() => ({
  sendAndConfirmTransactionMock: vi.fn(async () => 'dlmm-claim-sig'),
  getAccountMock: vi.fn(),
  createMock: vi.fn(),
  claimAllSwapFeeMock: vi.fn(),
  getPositionsByUserAndLbPairMock: vi.fn(),
}))

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<any>('@solana/web3.js')
  return {
    ...actual,
    Connection: class {
      getAccountInfo = vi.fn(async () => ({ owner: actual.PublicKey.default }))
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
  return {
    TOKEN_PROGRAM_ID: web3.PublicKey.default,
    TOKEN_2022_PROGRAM_ID: new web3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
    NATIVE_MINT: new web3.PublicKey('So11111111111111111111111111111111111111112'),
    getAccount: getAccountMock,
    getAssociatedTokenAddressSync: vi.fn(() => web3.PublicKey.default),
    createAssociatedTokenAccountIdempotentInstruction: vi.fn(() => ({})),
  }
})

vi.mock('../utils/solana.js', async () => {
  const web3 = await vi.importActual<any>('@solana/web3.js')
  const keeper = web3.Keypair.generate()
  return {
    loadKeeperKeypair: vi.fn(() => keeper),
  }
})

vi.mock('../utils/dlmm.js', () => ({
  loadDlmmClass: () => ({
    create: createMock,
  }),
}))

vi.mock('../utils/alerts.js', () => ({
  alertInfo: vi.fn(async () => undefined),
  alertWarning: vi.fn(async () => undefined),
  alertCritical: vi.fn(async () => undefined),
}))

import { executeSolanaDlmmFeeClaim } from '../actions/keepr-solana-claim-dlmm-fees.action.js'
import { loadKeeperKeypair } from '../utils/solana.js'

describe('keepr Solana DLMM fee claim', () => {
  const envKeys = [
    'SOLANA_RPC_URL',
    'SOLANA_METEORA_POOL',
    'SOLANA_DLMM_POOLS',
    'SOLANA_DLMM_POSITION_OWNER',
    'SOLANA_DLMM_FEE_OWNER',
    'SOLANA_DLMM_MIN_CLAIM_Y',
  ] as const
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

  beforeEach(() => {
    vi.clearAllMocks()
    const keeper = loadKeeperKeypair()
    process.env.SOLANA_RPC_URL = 'https://solana.invalid'
    process.env.SOLANA_METEORA_POOL = '11111111111111111111111111111111'
    delete process.env.SOLANA_DLMM_POOLS
    delete process.env.SOLANA_DLMM_POSITION_OWNER
    delete process.env.SOLANA_DLMM_FEE_OWNER
    process.env.SOLANA_DLMM_MIN_CLAIM_Y = '1000'

    const quoteMint = new PublicKey('So11111111111111111111111111111111111111112')
    const position = {
      publicKey: new PublicKey('SysvarRent111111111111111111111111111111111'),
      positionData: { feeOwner: keeper.publicKey },
    }
    getPositionsByUserAndLbPairMock.mockResolvedValue({ userPositions: [position] })
    claimAllSwapFeeMock.mockResolvedValue([{ kind: 'claim' }])
    createMock.mockResolvedValue({
      tokenY: { publicKey: quoteMint },
      lbPair: { tokenYMint: quoteMint },
      getPositionsByUserAndLbPair: getPositionsByUserAndLbPairMock,
      claimAllSwapFee: claimAllSwapFeeMock,
    })
    getAccountMock
      .mockResolvedValueOnce({ amount: 100n })
      .mockResolvedValueOnce({ amount: 2500n })
  })

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('claims swap fees and reports the feeOwner quote ATA delta', async () => {
    const result = await executeSolanaDlmmFeeClaim()

    expect(claimAllSwapFeeMock).toHaveBeenCalledTimes(1)
    expect(result.poolsProcessed).toBe(1)
    expect(result.positionsClaimed).toBe(1)
    expect(result.quoteHarvestedAmount).toBe('2400')
    expect(result.harvestThresholdMet).toBe(true)
    expect(result.signatures).toEqual(['dlmm-claim-sig'])
  })

  it('fails closed when position owner is not the keeper signer', async () => {
    process.env.SOLANA_DLMM_POSITION_OWNER = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    await expect(executeSolanaDlmmFeeClaim()).rejects.toThrow(
      'dlmm_claim_requires_position_owner_signer',
    )
    expect(claimAllSwapFeeMock).not.toHaveBeenCalled()
  })

  it('fails closed when SOLANA_DLMM_FEE_OWNER disagrees with on-chain feeOwner', async () => {
    process.env.SOLANA_DLMM_FEE_OWNER = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    await expect(executeSolanaDlmmFeeClaim()).rejects.toThrow('dlmm_fee_owner_mismatch')
    expect(claimAllSwapFeeMock).not.toHaveBeenCalled()
  })
})
