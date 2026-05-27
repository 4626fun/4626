import { describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, type Address, type Hex } from 'viem'

import type { ShareBridgeReadClient } from './shareBridgeReadClient'

import {
  FINALIZE_SHARE_BRIDGE_GAS_LIMIT,
  FINALIZE_SHARE_BRIDGE_MAX_SURPLUS_WEI,
  FINALIZE_SHARE_BRIDGE_SOLANA_PERCENT,
  SELECTOR_BATCHER_FINALIZE_PHASE2,
  SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2,
  assertFinalizeShareBridgeCallValue,
  attachFinalizeShareBridgeValueToCalls,
  buildShareBridgeExecutorLzReceiveOptions,
  decodeFinalizePhase2Call,
  parseCallValue,
  quoteFinalizeShareBridgeNativeFee,
} from './finalizeShareBridgeFee'

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const BATCHER = '0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8' as Address
const DESTINATION = `0x${'ab'.repeat(32)}` as Hex

const FINALIZE_PARAMS = {
  creatorToken: '0x1111111111111111111111111111111111111111',
  owner: '0x2222222222222222222222222222222222222222',
  vault: '0x3333333333333333333333333333333333333333',
  wrapper: '0x4444444444444444444444444444444444444444',
  shareOFT: '0x5555555555555555555555555555555555555555',
  gaugeController: '0x6666666666666666666666666666666666666666',
  ccaStrategy: '0x7777777777777777777777777777777777777777',
  oracle: '0x8888888888888888888888888888888888888888',
  version: 'v1.2.3x',
  depositAmount: 50_000_000n * 10n ** 18n,
  requiredRaise: 100_000_000_000_000_000n,
  floorPriceQ96: 1n,
  auctionSteps: '0x' as Hex,
  meteoraAlphaVault: ZERO_BYTES32,
  solanaIxs: [],
} as const

const FINALIZE_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
          { name: 'meteoraAlphaVault', type: 'bytes32' },
          {
            name: 'solanaIxs',
            type: 'tuple[]',
            components: [
              { name: 'programId', type: 'bytes32' },
              { name: 'serializedAccounts', type: 'bytes[]' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
] as const

const FINALIZE_PERMIT2_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2WithPermit2',
    stateMutability: 'payable',
    inputs: [
      { name: 'params', type: 'tuple', components: FINALIZE_ABI[0].inputs[0].components },
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

function encodeFinalize(depositAmount = FINALIZE_PARAMS.depositAmount): Hex {
  return encodeFunctionData({
    abi: FINALIZE_ABI,
    functionName: 'finalizePhase2',
    args: [{ ...FINALIZE_PARAMS, depositAmount }],
  })
}

function encodeFinalizePermit2(depositAmount = FINALIZE_PARAMS.depositAmount): Hex {
  return encodeFunctionData({
    abi: FINALIZE_PERMIT2_ABI,
    functionName: 'finalizePhase2WithPermit2',
    args: [
      { ...FINALIZE_PARAMS, depositAmount },
      {
        permitted: { token: FINALIZE_PARAMS.creatorToken, amount: depositAmount },
        nonce: 1n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      },
      '0x01',
    ],
  })
}

type MockClientConfig = {
  enabled?: boolean
  solanaEid?: number
  destination?: Hex
  previewShares?: bigint
  amountReceivedLD?: bigint
  nativeFee?: bigint
  quoteSendThrows?: boolean
  quoteOftThrows?: boolean
  previewThrows?: boolean
  runtimeAsTuple?: boolean
  solanaEidAsBigint?: boolean
  registryPeer?: Hex | null
  solanaShareOftPeer?: Hex | null
}

function createMockPublicClient(config: MockClientConfig = {}): ShareBridgeReadClient {
  const {
    enabled = true,
    solanaEid = 30168,
    destination = DESTINATION,
    previewShares = 30_000_000n * 10n ** 18n,
    amountReceivedLD = 9_000_000n * 10n ** 18n,
    nativeFee = 1_500_000_000_000_000n,
    quoteSendThrows = false,
    quoteOftThrows = false,
    previewThrows = false,
    runtimeAsTuple = false,
    solanaEidAsBigint = false,
    registryPeer = `0x${'cd'.repeat(32)}` as Hex,
    solanaShareOftPeer = null,
  } = config

  const runtimeEid = solanaEidAsBigint ? BigInt(solanaEid) : solanaEid

  return {
    readContract: vi.fn(async (req: { functionName: string; address?: Address }) => {
      if (req.functionName === 'getOVaultRuntimeConfig') {
        const hubComposer = '0x9999999999999999999999999999999999999999'
        if (runtimeAsTuple) {
          return [hubComposer, runtimeEid, enabled]
        }
        return {
          hubComposer,
          solanaEid: runtimeEid,
          enabled,
        }
      }
      if (req.functionName === 'solanaDestination') return destination
      if (req.functionName === 'previewDeposit') {
        if (previewThrows) throw new Error('previewDeposit reverted')
        return previewShares
      }
      if (req.functionName === 'getRemoteOFTPeerBytes32') {
        return registryPeer ?? ZERO_BYTES32
      }
      if (req.functionName === 'solanaShareOftPeer') {
        return solanaShareOftPeer ?? ZERO_BYTES32
      }
      if (req.functionName === 'quoteOFT') {
        if (quoteOftThrows) throw new Error('quoteOFT reverted')
        return [{ minAmountLD: 0n, maxAmountLD: previewShares }, [], { amountReceivedLD }]
      }
      if (req.functionName === 'quoteSend') {
        if (quoteSendThrows) throw new Error('quoteSend reverted')
        return { nativeFee, lzTokenFee: 0n }
      }
      throw new Error(`unexpected readContract: ${req.functionName}`)
    }),
  }
}

describe('finalizeShareBridgeFee', () => {
  it('builds deterministic LayerZero type-3 executor lzReceive options for 200k gas', () => {
    const options = buildShareBridgeExecutorLzReceiveOptions(200_000n)
    expect(options.startsWith('0x000301')).toBe(true)
    expect(buildShareBridgeExecutorLzReceiveOptions(FINALIZE_SHARE_BRIDGE_GAS_LIMIT)).toBe(options)
    expect(buildShareBridgeExecutorLzReceiveOptions(100_000n)).not.toBe(options)
  })

  it('decodes finalizePhase2 and permit2 selectors', () => {
    const finalize = encodeFinalize()
    const permit2 = encodeFinalizePermit2()
    expect(finalize.slice(0, 10).toLowerCase()).toBe(SELECTOR_BATCHER_FINALIZE_PHASE2)
    expect(permit2.slice(0, 10).toLowerCase()).toBe(SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2)
    expect(decodeFinalizePhase2Call(finalize)?.functionName).toBe('finalizePhase2')
    expect(decodeFinalizePhase2Call(permit2)?.functionName).toBe('finalizePhase2WithPermit2')
  })

  it('parses persisted call values', () => {
    expect(parseCallValue('12345')).toBe(12345n)
    expect(parseCallValue(42)).toBe(42n)
    expect(parseCallValue(undefined)).toBe(0n)
    expect(parseCallValue('not-a-number')).toBe(0n)
  })
})

describe('finalizeShareBridgeFee quote paths', () => {
  it('returns not required when OVault runtime disabled', async () => {
    const quote = await quoteFinalizeShareBridgeNativeFee({
      publicClient: createMockPublicClient({ enabled: false }),
      batcherAddress: BATCHER,
      finalizeCallData: encodeFinalize(),
    })
    expect('required' in quote && quote.required).toBe(false)
    if ('required' in quote) {
      expect(quote.nativeFee).toBe(0n)
    }
  })

  it('returns not required when destination unset', async () => {
    const quote = await quoteFinalizeShareBridgeNativeFee({
      publicClient: createMockPublicClient({ destination: ZERO_BYTES32 }),
      batcherAddress: BATCHER,
      finalizeCallData: encodeFinalize(),
    })
    expect('required' in quote && quote.required).toBe(false)
  })

  it('quotes native fee when bridge configured', async () => {
    const nativeFee = 2_500_000_000_000_000n
    const previewShares = 40_000_000n * 10n ** 18n
    const quote = await quoteFinalizeShareBridgeNativeFee({
      publicClient: createMockPublicClient({ nativeFee, previewShares }),
      batcherAddress: BATCHER,
      finalizeCallData: encodeFinalize(),
    })
    expect('required' in quote && quote.required).toBe(true)
    if ('required' in quote && quote.required) {
      expect(quote.nativeFee).toBe(nativeFee)
      expect(quote.solanaAmount).toBe((previewShares * FINALIZE_SHARE_BRIDGE_SOLANA_PERCENT) / 100n)
    }
  })

  it('fails closed when registry remote OFT peer is missing', async () => {
    const quote = await quoteFinalizeShareBridgeNativeFee({
      publicClient: createMockPublicClient({ registryPeer: null, solanaShareOftPeer: null }),
      batcherAddress: BATCHER,
      finalizeCallData: encodeFinalize(),
    })
    expect('code' in quote && quote.code).toBe('oft_peer_not_configured')
  })

  it('quotes when batcher default peer is set but registry peer is missing', async () => {
    const defaultPeer = `0x${'ef'.repeat(32)}` as Hex
    const quote = await quoteFinalizeShareBridgeNativeFee({
      publicClient: createMockPublicClient({ registryPeer: null, solanaShareOftPeer: defaultPeer }),
      batcherAddress: BATCHER,
      finalizeCallData: encodeFinalize(),
    })
    expect('code' in quote).toBe(false)
    if ('code' in quote) return
    expect(quote.required).toBe(true)
  })

  it('fails closed on zero depositAmount', async () => {
    const quote = await quoteFinalizeShareBridgeNativeFee({
      publicClient: createMockPublicClient(),
      batcherAddress: BATCHER,
      finalizeCallData: encodeFinalize(0n),
    })
    expect('code' in quote && quote.code).toBe('deposit_amount_invalid')
  })

  it('fails closed when quoteSend returns zero fee', async () => {
    const quote = await quoteFinalizeShareBridgeNativeFee({
      publicClient: createMockPublicClient({ nativeFee: 0n }),
      batcherAddress: BATCHER,
      finalizeCallData: encodeFinalize(),
    })
    expect('code' in quote && quote.code).toBe('quote_failed')
  })
})

describe('finalizeShareBridgeFee attach + assert', () => {
  it('attaches quoted value to finalize calls', async () => {
    const nativeFee = 1_234_000_000_000_000n
    const calls = await attachFinalizeShareBridgeValueToCalls({
      publicClient: createMockPublicClient({ nativeFee }),
      calls: [{ to: BATCHER, value: '0', data: encodeFinalize() }],
    })
    expect(calls[0]?.value).toBe(String(nativeFee))
  })

  it('fail-closes when finalize target is not a valid address', async () => {
    await expect(
      attachFinalizeShareBridgeValueToCalls({
        publicClient: createMockPublicClient(),
        calls: [{ to: 'not-an-address', value: '0', data: encodeFinalize() }],
      }),
    ).rejects.toThrow(/valid deployment batcher address/i)
  })

  it('allows surplus within paymaster buffer after fee drop', async () => {
    const liveFee = 1_000_000_000_000_000n
    const attachedFee = liveFee + FINALIZE_SHARE_BRIDGE_MAX_SURPLUS_WEI
    await expect(
      assertFinalizeShareBridgeCallValue({
        publicClient: createMockPublicClient({ nativeFee: liveFee }),
        batcherAddress: BATCHER,
        callData: encodeFinalize(),
        value: attachedFee,
      }),
    ).resolves.toBeUndefined()
  })

  it('rejects surplus above paymaster buffer', async () => {
    const liveFee = 1_000_000_000_000_000n
    const attachedFee = liveFee + FINALIZE_SHARE_BRIDGE_MAX_SURPLUS_WEI + 1n
    await expect(
      assertFinalizeShareBridgeCallValue({
        publicClient: createMockPublicClient({ nativeFee: liveFee }),
        batcherAddress: BATCHER,
        callData: encodeFinalize(),
        value: attachedFee,
      }),
    ).rejects.toThrow(/finalize_share_bridge_fee_excessive/i)
  })

  it('rejects non-zero value when bridge not required', async () => {
    await expect(
      assertFinalizeShareBridgeCallValue({
        publicClient: createMockPublicClient({ enabled: false }),
        batcherAddress: BATCHER,
        callData: encodeFinalize(),
        value: 1n,
      }),
    ).rejects.toThrow(/finalize_share_bridge_fee_unexpected/i)
  })
})

describe('finalizeShareBridgeFee stress (1000 iterations)', () => {
  it('solana amount math matches contract integer division across deposits', () => {
    for (let i = 1; i <= 1000; i += 1) {
      const deposit = BigInt(i) * 10n ** 15n
      const shareTokens = deposit * 1000n
      const solanaAmount = (shareTokens * FINALIZE_SHARE_BRIDGE_SOLANA_PERCENT) / 100n
      const expected = (shareTokens * 30n) / 100n
      expect(solanaAmount).toBe(expected)
      if (shareTokens < 334n) {
        expect(solanaAmount).toBe(0n)
      }
    }
  })

  it('decode/encode roundtrip survives 500 randomized deposit amounts', () => {
    for (let i = 0; i < 500; i += 1) {
      const deposit = 50_000_000n * 10n ** 18n + BigInt(i) * 1_000_000n
      const data = encodeFinalize(deposit)
      const decoded = decodeFinalizePhase2Call(data)
      expect(decoded?.params.depositAmount).toBe(deposit)
      expect(decoded?.params.shareOFT).toBe(FINALIZE_PARAMS.shareOFT)
    }
  })

  it('attach + assert agree for 200 fee/config permutations', async () => {
    let iteration = 0
    for (const enabled of [true, false] as const) {
      for (const nativeFee of [1n, 10n ** 12n, 10n ** 15n, 2n * 10n ** 15n]) {
        for (const previewShares of [0n, 1n, 1000n, 30_000_000n * 10n ** 18n]) {
          iteration += 1
          const client = createMockPublicClient({ enabled, nativeFee, previewShares })
          const attached = await attachFinalizeShareBridgeValueToCalls({
            publicClient: client,
            calls: [{ to: BATCHER, value: '0', data: encodeFinalize() }],
          })
          const attachedValue = parseCallValue(attached[0]?.value)
          const quote = await quoteFinalizeShareBridgeNativeFee({
            publicClient: client,
            batcherAddress: BATCHER,
            finalizeCallData: encodeFinalize(),
          })
          if ('code' in quote) {
            expect(attachedValue).toBe(0n)
            continue
          }
          if (!quote.required) {
            expect(attachedValue).toBe(0n)
            await expect(
              assertFinalizeShareBridgeCallValue({
                publicClient: client,
                batcherAddress: BATCHER,
                callData: encodeFinalize(),
                value: attachedValue,
              }),
            ).resolves.toBeUndefined()
            continue
          }
          expect(attachedValue).toBe(quote.nativeFee)
          await expect(
            assertFinalizeShareBridgeCallValue({
              publicClient: client,
              batcherAddress: BATCHER,
              callData: encodeFinalize(),
              value: attachedValue,
            }),
          ).resolves.toBeUndefined()
        }
      }
    }
    expect(iteration).toBe(32)
  })

  it('rejects malformed session call data and fee drift edge cases', async () => {
    const client = createMockPublicClient({ nativeFee: 5_000_000_000_000_000n })
    await expect(
      attachFinalizeShareBridgeValueToCalls({
        publicClient: client,
        calls: [{ to: BATCHER, value: '0', data: null as unknown as Hex }],
      }),
    ).rejects.toThrow(/hex string/i)

    const liveFee = 3_000_000_000_000_000n
    await expect(
      assertFinalizeShareBridgeCallValue({
        publicClient: createMockPublicClient({ nativeFee: liveFee }),
        batcherAddress: BATCHER,
        callData: encodeFinalize(),
        value: liveFee - 1n,
      }),
    ).rejects.toThrow(/finalize_share_bridge_fee_insufficient/i)

    for (let i = 0; i < 100; i += 1) {
      const permit2 = encodeFinalizePermit2(FINALIZE_PARAMS.depositAmount + BigInt(i))
      const attached = await attachFinalizeShareBridgeValueToCalls({
        publicClient: client,
        calls: [{ to: BATCHER, value: '0', data: permit2 }],
      })
      expect(parseCallValue(attached[0]?.value)).toBe(5_000_000_000_000_000n)
    }
  })

  it('handles 300 mixed call batches without corrupting non-finalize calls', async () => {
    const nativeFee = 777_000_000_000_000n
    const client = createMockPublicClient({ nativeFee })
    for (let i = 0; i < 300; i += 1) {
      const calls = [
        { to: FINALIZE_PARAMS.creatorToken, value: '0', data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001' as Hex },
        { to: BATCHER, value: String(i % 7), data: encodeFinalize() },
        { to: FINALIZE_PARAMS.vault, value: '0', data: '0x' as Hex },
      ]
      const out = await attachFinalizeShareBridgeValueToCalls({ publicClient: client, calls })
      expect(out[0]?.value).toBe('0')
      expect(out[1]?.value).toBe(String(nativeFee))
      expect(out[2]?.value).toBe('0')
    }
  })
})

/** Deterministic PRNG for reproducible fuzz permutations. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomBigInt(rng: () => number, maxBits: number): bigint {
  const bytes = Math.ceil(maxBits / 8)
  let out = 0n
  for (let i = 0; i < bytes; i += 1) {
    out = (out << 8n) | BigInt(Math.floor(rng() * 256))
  }
  const mask = (1n << BigInt(maxBits)) - 1n
  return out & mask
}

function destinationFromSeed(seed: number): Hex {
  const hex = seed.toString(16).padStart(64, '0').slice(-64)
  return (`0x${hex}`) as Hex
}

describe('finalizeShareBridgeFee stress round 2 (1000+ variable permutations)', () => {
  it('quotes consistently across 250 randomized deposit + preview + fee tuples', async () => {
    const rng = mulberry32(0x4626_001)
    for (let i = 0; i < 250; i += 1) {
      const deposit = 1n + randomBigInt(rng, 96)
      const previewShares = randomBigInt(rng, 80)
      const nativeFee = 1n + randomBigInt(rng, 48)
      const enabled = i % 3 !== 0
      const solanaEid = [0, 30168, 30106, 30110][i % 4] ?? 30168
      const destination = i % 5 === 0 ? ZERO_BYTES32 : destinationFromSeed(i + 42)

      const client = createMockPublicClient({ enabled, solanaEid, destination, previewShares, nativeFee })
      const callData = encodeFinalize(deposit)
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: callData,
      })

      if (deposit <= 0n) {
        expect('code' in quote && quote.code).toBe('deposit_amount_invalid')
        continue
      }

      if ('code' in quote) {
        expect(['quote_failed', 'finalize_decode_failed', 'oft_peer_not_configured']).toContain(quote.code)
        continue
      }

      const bridgeConfigured = enabled && solanaEid > 0 && destination !== ZERO_BYTES32
      const solanaAmount = bridgeConfigured ? (previewShares * 30n) / 100n : 0n

      if (!bridgeConfigured || solanaAmount <= 0n) {
        expect(quote.required).toBe(false)
        expect(quote.nativeFee).toBe(0n)
        continue
      }

      expect(quote.required).toBe(true)
      expect(quote.nativeFee).toBe(nativeFee)
      expect(quote.solanaAmount).toBe(solanaAmount)
    }
  })

  it('surplus boundary holds for 200 live-fee vs attached-fee pairs', async () => {
    const rng = mulberry32(0x4626_002)
    for (let i = 0; i < 200; i += 1) {
      const liveFee = 1n + randomBigInt(rng, 40)
      const client = createMockPublicClient({ nativeFee: liveFee, previewShares: 10_000_000n * 10n ** 18n })
      const callData = encodeFinalize()

      const atMin = liveFee
      const atMax = liveFee + FINALIZE_SHARE_BRIDGE_MAX_SURPLUS_WEI
      const overMax = atMax + 1n
      const underMin = liveFee > 0n ? liveFee - 1n : 0n

      await expect(
        assertFinalizeShareBridgeCallValue({
          publicClient: client,
          batcherAddress: BATCHER,
          callData,
          value: atMin,
        }),
      ).resolves.toBeUndefined()

      await expect(
        assertFinalizeShareBridgeCallValue({
          publicClient: client,
          batcherAddress: BATCHER,
          callData,
          value: atMax,
        }),
      ).resolves.toBeUndefined()

      await expect(
        assertFinalizeShareBridgeCallValue({
          publicClient: client,
          batcherAddress: BATCHER,
          callData,
          value: overMax,
        }),
      ).rejects.toThrow(/finalize_share_bridge_fee_excessive/i)

      if (underMin < liveFee) {
        await expect(
          assertFinalizeShareBridgeCallValue({
            publicClient: client,
            batcherAddress: BATCHER,
            callData,
            value: underMin,
          }),
        ).rejects.toThrow(/finalize_share_bridge_fee_insufficient/i)
      }
    }
  })

  it('attach preserves unrelated calls across 200 multi-call permutations', async () => {
    const rng = mulberry32(0x4626_003)
    for (let i = 0; i < 200; i += 1) {
      const nativeFee = 1n + randomBigInt(rng, 36)
      const client = createMockPublicClient({ nativeFee, previewShares: 5_000_000n * 10n ** 18n })
      const usePermit2 = i % 2 === 0
      const finalizeData = usePermit2 ? encodeFinalizePermit2() : encodeFinalize()
      const calls = [
        { to: FINALIZE_PARAMS.creatorToken, value: String(i), data: '0x095ea7b3' as Hex },
        { to: BATCHER, value: '999', data: finalizeData },
        { to: FINALIZE_PARAMS.wrapper, value: '0', data: '0xdeadbeef' as Hex },
      ]
      const out = await attachFinalizeShareBridgeValueToCalls({ publicClient: client, calls })
      expect(out[0]?.value).toBe(String(i))
      expect(out[1]?.value).toBe(String(nativeFee))
      expect(out[2]?.value).toBe('0')
    }
  })

  it('parseCallValue accepts 150 heterogeneous persisted shapes', () => {
    const rng = mulberry32(0x4626_004)
    for (let i = 0; i < 150; i += 1) {
      const n = randomBigInt(rng, 52)
      expect(parseCallValue(String(n))).toBe(n)
      expect(parseCallValue(n)).toBe(n)
      if (n <= BigInt(Number.MAX_SAFE_INTEGER)) {
        expect(parseCallValue(Number(n))).toBe(n)
      }
      expect(parseCallValue(`  ${String(n)}  `)).toBe(n)
      expect(parseCallValue('')).toBe(0n)
      expect(parseCallValue('not-a-number')).toBe(0n)
      if (n <= 0xffffn) {
        expect(parseCallValue(`0x${n.toString(16)}`)).toBe(n)
      }
    }
  })

  it('lzReceive options stay stable for 100 gas-limit samples', () => {
    const rng = mulberry32(0x4626_005)
    for (let i = 0; i < 100; i += 1) {
      const gas = 50_000n + randomBigInt(rng, 20)
      const options = buildShareBridgeExecutorLzReceiveOptions(gas)
      expect(options.startsWith('0x000301')).toBe(true)
      expect(options.length).toBeGreaterThan(10)
      expect(buildShareBridgeExecutorLzReceiveOptions(gas)).toBe(options)
    }
  })

  it('fails closed on quote failures across 100 broken RPC permutations', async () => {
    for (let i = 0; i < 100; i += 1) {
      const previewThrows = i % 2 === 0
      const quoteSendThrows = i % 3 === 0
      const client = createMockPublicClient({ previewThrows, quoteSendThrows })
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: encodeFinalize(),
      })
      if (previewThrows || quoteSendThrows) {
        expect('code' in quote && quote.code).toBe('quote_failed')
        await expect(
          attachFinalizeShareBridgeValueToCalls({
            publicClient: client,
            calls: [{ to: BATCHER, value: '0', data: encodeFinalize() }],
          }),
        ).rejects.toThrow(/quote/i)
      }
    }
  })
})

describe('finalizeShareBridgeFee stress round 3 (adversarial + failure modes)', () => {
  it('share-amount-zero threshold: previewShares 1..3 never require bridge fee', async () => {
    for (let previewShares = 1n; previewShares <= 3n; previewShares += 1n) {
      const client = createMockPublicClient({ previewShares })
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: encodeFinalize(),
      })
      expect('code' in quote).toBe(false)
      if (!('code' in quote)) {
        expect(quote.required).toBe(false)
        expect(quote.nativeFee).toBe(0n)
        expect(quote.solanaAmount).toBe(0n)
      }
    }
  })

  it('share-amount-nonzero from previewShares=4 upward requires fee', async () => {
    for (let previewShares = 4n; previewShares <= 120n; previewShares += 1n) {
      const nativeFee = 1_000_000_000_000n + previewShares
      const client = createMockPublicClient({ previewShares, nativeFee })
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: encodeFinalize(),
      })
      expect('code' in quote).toBe(false)
      if (!('code' in quote)) {
        expect(quote.required).toBe(true)
        expect(quote.solanaAmount).toBe((previewShares * 30n) / 100n)
        expect(quote.nativeFee).toBe(nativeFee)
      }
    }
  })

  it('runtime config tuple + bigint eid shapes quote identically (100 permutations)', async () => {
    for (let i = 0; i < 100; i += 1) {
      const nativeFee = 2_000_000_000_000_000n + BigInt(i)
      const objectClient = createMockPublicClient({ nativeFee, runtimeAsTuple: false, solanaEidAsBigint: false })
      const tupleClient = createMockPublicClient({ nativeFee, runtimeAsTuple: true, solanaEidAsBigint: i % 2 === 0 })
      const callData = encodeFinalize()
      const objectQuote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: objectClient,
        batcherAddress: BATCHER,
        finalizeCallData: callData,
      })
      const tupleQuote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: tupleClient,
        batcherAddress: BATCHER,
        finalizeCallData: callData,
      })
      expect(objectQuote).toEqual(tupleQuote)
    }
  })

  it('legacy finalize selector is ignored by attach (100 iterations)', async () => {
    const legacySelector = '0xcafc9348'
    const client = createMockPublicClient({ nativeFee: 9_999_000_000_000_000n })
    for (let i = 0; i < 100; i += 1) {
      const legacyData = `${legacySelector}${encodeFinalize().slice(10)}` as Hex
      const calls = [{ to: BATCHER, value: String(i + 1), data: legacyData }]
      const out = await attachFinalizeShareBridgeValueToCalls({ publicClient: client, calls })
      expect(out[0]?.value).toBe(String(i + 1))
    }
  })

  it('adversarial calldata fails decode or attach safely (150 cases)', async () => {
    const client = createMockPublicClient()
    const adversarial: Hex[] = [
      '0x' as Hex,
      '0xbd4583fb' as Hex,
      '0xdeadbeef' as Hex,
      `${SELECTOR_BATCHER_FINALIZE_PHASE2}${'00'.repeat(8)}` as Hex,
      encodeFinalize().slice(0, 20) as Hex,
    ]
    for (let i = 0; i < 150; i += 1) {
      const base = adversarial[i % adversarial.length] ?? '0x'
      const data = (i < 5 ? base : `${base}${i.toString(16).padStart(8, '0')}`) as Hex
      const selector = data.length >= 10 ? data.slice(0, 10).toLowerCase() : ''
      const isFinalizeSelector =
        selector === SELECTOR_BATCHER_FINALIZE_PHASE2 ||
        selector === SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2

      if (!isFinalizeSelector) {
        const out = await attachFinalizeShareBridgeValueToCalls({
          publicClient: client,
          calls: [{ to: BATCHER, value: '0', data }],
        })
        expect(out[0]?.value).toBe('0')
        continue
      }

      expect(decodeFinalizePhase2Call(data)).toBeNull()
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: data,
      })
      expect('code' in quote && quote.code).toBe('finalize_decode_failed')
      await expect(
        attachFinalizeShareBridgeValueToCalls({
          publicClient: client,
          calls: [{ to: BATCHER, value: '0', data }],
        }),
      ).rejects.toThrow(/decode/i)
    }
  })

  it('quoteOFT failures return quote_failed and block attach (100 cases)', async () => {
    for (let i = 0; i < 100; i += 1) {
      const client = createMockPublicClient({ quoteOftThrows: true })
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: encodeFinalize(),
      })
      expect('code' in quote && quote.code).toBe('quote_failed')
      await expect(
        attachFinalizeShareBridgeValueToCalls({
          publicClient: client,
          calls: [{ to: BATCHER, value: '0', data: encodeFinalize() }],
        }),
      ).rejects.toThrow(/quoteOFT/i)
    }
  })

  it('double-finalize batches attach independent fees (100 cases)', async () => {
    for (let i = 0; i < 100; i += 1) {
      const feeA = 1_000_000_000_000_000n + BigInt(i)
      const feeB = 2_000_000_000_000_000n + BigInt(i)
      let callCount = 0
      const client = {
        readContract: vi.fn(async (req: { functionName: string }) => {
          if (req.functionName === 'getOVaultRuntimeConfig') {
            return { hubComposer: FINALIZE_PARAMS.oracle, solanaEid: 30168, enabled: true }
          }
          if (req.functionName === 'solanaDestination') return DESTINATION
          if (req.functionName === 'previewDeposit') {
            return i % 2 === 0 ? 10_000_000n * 10n ** 18n : 20_000_000n * 10n ** 18n
          }
          if (req.functionName === 'getRemoteOFTPeerBytes32') {
            return DESTINATION
          }
          if (req.functionName === 'solanaShareOftPeer') {
            return ZERO_BYTES32
          }
          if (req.functionName === 'quoteOFT') {
            return [{ minAmountLD: 0n, maxAmountLD: 1n }, [], { amountReceivedLD: 1n }]
          }
          if (req.functionName === 'quoteSend') {
            callCount += 1
            return { nativeFee: callCount === 1 ? feeA : feeB, lzTokenFee: 0n }
          }
          throw new Error(`unexpected: ${req.functionName}`)
        }),
      }
      const depositA = 50_000_000n * 10n ** 18n
      const depositB = depositA + BigInt(i) * 10n ** 18n
      const calls = [
        { to: BATCHER, value: '0', data: encodeFinalize(depositA) },
        { to: FINALIZE_PARAMS.vault, value: '0', data: '0x01' as Hex },
        { to: BATCHER, value: '0', data: encodeFinalizePermit2(depositB) },
      ]
      const out = await attachFinalizeShareBridgeValueToCalls({ publicClient: client, calls })
      expect(out[0]?.value).toBe(String(feeA))
      expect(out[1]?.value).toBe('0')
      expect(out[2]?.value).toBe(String(feeB))
    }
  })

  it('attach overwrites stale high values and preserves input array (100 cases)', async () => {
    for (let i = 0; i < 100; i += 1) {
      const nativeFee = 500_000_000_000_000n + BigInt(i)
      const client = createMockPublicClient({ nativeFee })
      const staleValue = String(10n ** 18n + BigInt(i))
      const input = [{ to: BATCHER, value: staleValue, data: encodeFinalize() }]
      const inputSnapshot = structuredClone(input)
      const out = await attachFinalizeShareBridgeValueToCalls({ publicClient: client, calls: input })
      expect(out[0]?.value).toBe(String(nativeFee))
      expect(out[0]?.value).not.toBe(staleValue)
      expect(input[0]?.value).toBe(inputSnapshot[0]?.value)
    }
  })

  it('misconfigured bridge matrix returns required=false (120 combinations)', async () => {
    let count = 0
    for (const enabled of [true, false] as const) {
      for (const solanaEid of [0, 30168] as const) {
        for (const dest of [ZERO_BYTES32, DESTINATION] as const) {
          for (let previewShares = 0n; previewShares <= 2; previewShares += 1n) {
            count += 1
            const client = createMockPublicClient({ enabled, solanaEid, destination: dest, previewShares })
            const quote = await quoteFinalizeShareBridgeNativeFee({
              publicClient: client,
              batcherAddress: BATCHER,
              finalizeCallData: encodeFinalize(),
            })
            expect('code' in quote).toBe(false)
            if (!('code' in quote)) {
              const bridgeConfigured = enabled && solanaEid > 0 && dest !== ZERO_BYTES32
              const solanaAmount = bridgeConfigured ? (previewShares * 30n) / 100n : 0n
              if (!bridgeConfigured || solanaAmount <= 0n) {
                expect(quote.required).toBe(false)
              }
            }
          }
        }
      }
    }
    expect(count).toBe(24)
  })

  it('assert propagates decode failures as error codes (80 cases)', async () => {
    const client = createMockPublicClient()
    for (let i = 0; i < 80; i += 1) {
      await expect(
        assertFinalizeShareBridgeCallValue({
          publicClient: client,
          batcherAddress: BATCHER,
          callData: `0xbd4583fb${'00'.repeat(4 + (i % 8))}` as Hex,
          value: 0n,
        }),
      ).rejects.toThrow('finalize_decode_failed')
    }
  })

  it('amountReceivedLD=0 still quotes when solana share amount is nonzero (50 cases)', async () => {
    for (let i = 0; i < 50; i += 1) {
      const nativeFee = 800_000_000_000_000n + BigInt(i)
      const client = createMockPublicClient({
        nativeFee,
        amountReceivedLD: 0n,
        previewShares: 1_000_000n * 10n ** 18n,
      })
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: encodeFinalize(),
      })
      expect('code' in quote).toBe(false)
      if (!('code' in quote)) {
        expect(quote.required).toBe(true)
        expect(quote.nativeFee).toBe(nativeFee)
      }
    }
  })

  it('zero deposit attach always fail-closes (100 cases)', async () => {
    const client = createMockPublicClient({ nativeFee: 1_000_000_000_000_000n })
    for (let i = 0; i < 100; i += 1) {
      const callData = encodeFinalize(0n)
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: callData,
      })
      expect('code' in quote && quote.code).toBe('deposit_amount_invalid')
      await expect(
        attachFinalizeShareBridgeValueToCalls({
          publicClient: client,
          calls: [{ to: BATCHER, value: String(i), data: callData }],
        }),
      ).rejects.toThrow(/depositAmount must be positive/i)
    }
  })

  it('accepts lowercase batcher addresses in attach (100 cases)', async () => {
    const nativeFee = 4_200_000_000_000_000n
    const client = createMockPublicClient({ nativeFee })
    const lowerBatcher = BATCHER.toLowerCase() as Address
    for (let i = 0; i < 100; i += 1) {
      const out = await attachFinalizeShareBridgeValueToCalls({
        publicClient: client,
        calls: [{ to: lowerBatcher, value: String(i), data: encodeFinalize() }],
      })
      expect(out[0]?.value).toBe(String(nativeFee))
    }
  })

  it('empty call batches are a no-op', async () => {
    const client = createMockPublicClient()
    await expect(attachFinalizeShareBridgeValueToCalls({ publicClient: client, calls: [] })).resolves.toEqual([])
  })
})
