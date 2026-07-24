import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicKey } from '@solana/web3.js'

const {
  executeClaimMock,
  swapMock,
  forwardOftMock,
  writeContractMock,
  readContractMock,
  getAccountMock,
  createMock,
  isDryRunMock,
} = vi.hoisted(() => ({
  executeClaimMock: vi.fn(),
  swapMock: vi.fn(),
  forwardOftMock: vi.fn(),
  writeContractMock: vi.fn(),
  readContractMock: vi.fn(),
  getAccountMock: vi.fn(),
  createMock: vi.fn(),
  isDryRunMock: vi.fn(() => false),
}))

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<any>('@solana/web3.js')
  return {
    ...actual,
    Connection: class {
      getAccountInfo = vi.fn(async () => ({
        owner: new actual.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
      }))
    },
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

vi.mock('../actions/keepr-solana-claim-dlmm-fees.action.js', () => ({
  executeSolanaDlmmFeeClaim: executeClaimMock,
}))

vi.mock('../utils/solanaJupiterSwap.js', () => ({
  buyShareWithWsol: swapMock,
}))

vi.mock('../utils/solanaOftForward.js', async () => {
  const actual = await vi.importActual<typeof import('../utils/solanaOftForward.js')>(
    '../utils/solanaOftForward.js',
  )
  return {
    ...actual,
    forwardSolanaShareOftToHub: forwardOftMock,
  }
})

vi.mock('../utils/onchain.js', () => ({
  isDryRun: () => isDryRunMock(),
  writeContract: writeContractMock,
  readContract: readContractMock,
}))

vi.mock('../utils/remoteFeeFlush.js', () => ({
  resolveHubGaugeController: () => '0x1111111111111111111111111111111111111111',
}))

vi.mock('../utils/alerts.js', () => ({
  alertInfo: vi.fn(async () => undefined),
  alertWarning: vi.fn(async () => undefined),
  alertCritical: vi.fn(async () => undefined),
}))

import { executeSolanaDlmmFeeForward } from '../actions/keepr-solana-forward-dlmm-fees.action.js'
import { hubGaugeToBytes32 } from '../utils/solanaOftForward.js'
import { loadKeeperKeypair } from '../utils/solana.js'

describe('keepr Solana DLMM fee forward', () => {
  const envKeys = [
    'SOLANA_RPC_URL',
    'SOLANA_METEORA_POOL',
    'SOLANA_DLMM_FEE_OWNER',
    'SOLANA_DLMM_FORWARD_MIN_QUOTE',
    'SOLANA_DLMM_FORWARD_SKIP_CLAIM',
    'SOLANA_DLMM_FORWARD_SKIP_OFT',
    'SOLANA_DLMM_FORWARD_SKIP_BASE_SWEEP',
    'SOLANA_DLMM_FORWARD_BASE_SWEEP_TIMEOUT_MS',
    'SOLANA_DLMM_FORWARD_BASE_SWEEP_POLL_MS',
    'SOLANA_OFT_FORWARD_TO_BYTES32',
  ] as const
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

  function mockBridgedCreditReady() {
    readContractMock.mockImplementation(async (params: { functionName: string }) => {
      if (params.functionName === 'shareOFT') return '0x2222222222222222222222222222222222222222'
      if (params.functionName === 'accountedOFTBalance') return 0n
      if (params.functionName === 'balanceOf') return 4200n
      return 0n
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getAccountMock.mockReset()
    isDryRunMock.mockReturnValue(false)
    const keeper = loadKeeperKeypair()
    process.env.SOLANA_RPC_URL = 'https://solana.invalid'
    process.env.SOLANA_METEORA_POOL = '11111111111111111111111111111111'
    process.env.SOLANA_DLMM_FEE_OWNER = keeper.publicKey.toBase58()
    process.env.SOLANA_DLMM_FORWARD_MIN_QUOTE = '1000'
    process.env.SOLANA_DLMM_FORWARD_BASE_SWEEP_TIMEOUT_MS = '0'
    process.env.SOLANA_DLMM_FORWARD_BASE_SWEEP_POLL_MS = '1'
    delete process.env.SOLANA_DLMM_FORWARD_SKIP_CLAIM
    delete process.env.SOLANA_DLMM_FORWARD_SKIP_OFT
    delete process.env.SOLANA_DLMM_FORWARD_SKIP_BASE_SWEEP
    delete process.env.SOLANA_OFT_FORWARD_TO_BYTES32

    executeClaimMock.mockResolvedValue({
      quoteHarvestedAmount: '5000',
      positionsClaimed: 1,
      poolsProcessed: 1,
      harvestThresholdMet: true,
      signatures: ['claim-sig'],
    })
    getAccountMock
      .mockResolvedValueOnce({ amount: 5000n }) // WSOL before swap
      .mockResolvedValueOnce({ amount: 4200n }) // share after swap
    createMock.mockResolvedValue({
      tokenX: { publicKey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') },
      lbPair: { tokenXMint: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') },
    })
    swapMock.mockResolvedValue({
      signature: 'swap-sig',
      inAmount: '5000',
      minOutAmount: '4000',
      outAmountQuoted: '4200',
      mode: 'jupiter',
    })
    forwardOftMock.mockResolvedValue({
      signature: 'oft-sig',
      amountLd: '4200',
      mode: 'helper',
    })
    writeContractMock.mockResolvedValue({
      success: true,
      txHash: '0xabc',
    })
    mockBridgedCreditReady()
  })

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('pads hub gauge addresses to bytes32', () => {
    expect(hubGaugeToBytes32('0x1111111111111111111111111111111111111111')).toBe(
      '0x0000000000000000000000001111111111111111111111111111111111111111',
    )
  })

  it('skips claim/swap when dry-run is enabled', async () => {
    isDryRunMock.mockReturnValue(true)
    const result = await executeSolanaDlmmFeeForward()
    expect(result.skippedReason).toBe('dry_run')
    expect(executeClaimMock).not.toHaveBeenCalled()
    expect(swapMock).not.toHaveBeenCalled()
  })

  it('skips swap below threshold but still attempts independent Base sweep', async () => {
    process.env.SOLANA_DLMM_FORWARD_MIN_QUOTE = '100000'
    getAccountMock.mockReset()
    getAccountMock.mockResolvedValueOnce({ amount: 5000n })

    const result = await executeSolanaDlmmFeeForward()
    expect(result.skippedReason).toMatch(/^below_forward_threshold/)
    expect(swapMock).not.toHaveBeenCalled()
    expect(forwardOftMock).not.toHaveBeenCalled()
    expect(writeContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'receiveBridgedFees' }),
    )
    expect(result.receiveBridgedFeesCalled).toBe(true)
  })

  it('fails closed when feeOwner is not the keeper signer', async () => {
    process.env.SOLANA_DLMM_FEE_OWNER = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    await expect(executeSolanaDlmmFeeForward()).rejects.toThrow(
      'dlmm_forward_requires_fee_owner_signer',
    )
    expect(swapMock).not.toHaveBeenCalled()
  })

  it('claims, swaps, OFTs, then sweeps Base receiveBridgedFees after credit', async () => {
    const result = await executeSolanaDlmmFeeForward()

    expect(executeClaimMock).toHaveBeenCalledTimes(1)
    expect(swapMock).toHaveBeenCalledTimes(1)
    expect(forwardOftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amountLd: 4200n,
        toBytes32: '0x0000000000000000000000001111111111111111111111111111111111111111',
      }),
    )
    expect(readContractMock).toHaveBeenCalled()
    expect(writeContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'receiveBridgedFees' }),
    )
    expect(result.swapSignature).toBe('swap-sig')
    expect(result.oftSignature).toBe('oft-sig')
    expect(result.receiveBridgedFeesCalled).toBe(true)
    expect(result.receiveBridgedFeesTxHash).toBe('0xabc')
  })

  it('does not mark Base sweep success when credit never arrives', async () => {
    readContractMock.mockImplementation(async (params: { functionName: string }) => {
      if (params.functionName === 'shareOFT') return '0x2222222222222222222222222222222222222222'
      if (params.functionName === 'accountedOFTBalance') return 100n
      if (params.functionName === 'balanceOf') return 100n
      return 0n
    })

    const result = await executeSolanaDlmmFeeForward()
    expect(result.receiveBridgedFeesCalled).toBe(false)
    expect(writeContractMock).not.toHaveBeenCalled()
  })
})
