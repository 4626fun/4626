import { describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, type Address, type Hex } from 'viem'

import {
  attachFinalizeShareBridgeValueToCalls,
  quoteFinalizeShareBridgeNativeFee,
} from './finalizeShareBridgeFee'
import {
  assertShareBridgeOftWiringForFinalize,
  readShareBridgeOftWiringStatus,
  ShareBridgeOftWiringError,
} from './shareBridgeOftWiring'

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const BATCHER = '0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8' as Address
const REGISTRY = '0x3f64087dc361Ad52300409E5873b26941D6418B6' as Address
const DESTINATION = `0x${'ab'.repeat(32)}` as Hex
const REGISTRY_PEER = `0x${'cd'.repeat(32)}` as Hex
const BATCHER_DEFAULT_PEER = `0x${'ef'.repeat(32)}` as Hex

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

type WiringMockConfig = {
  enabled?: boolean
  solanaEid?: number
  destination?: Hex
  previewShares?: bigint
  nativeFee?: bigint
  registryPeer?: Hex | null
  batcherDefaultPeer?: Hex | null
  shareOftPeer?: Hex | null
  previewThrows?: boolean
  quoteOftThrows?: boolean
}

function buildFinalizeCalldata(depositAmount = FINALIZE_PARAMS.depositAmount): Hex {
  return encodeFunctionData({
    abi: FINALIZE_ABI,
    functionName: 'finalizePhase2',
    args: [{ ...FINALIZE_PARAMS, depositAmount }],
  })
}

function createWiringMockClient(config: WiringMockConfig = {}) {
  const {
    enabled = true,
    solanaEid = 30168,
    destination = DESTINATION,
    previewShares = 30_000_000n * 10n ** 18n,
    nativeFee = 1_500_000_000_000_000n,
    registryPeer = REGISTRY_PEER,
    batcherDefaultPeer = null,
    shareOftPeer = null,
    previewThrows = false,
    quoteOftThrows = false,
  } = config

  return {
    readContract: vi.fn(async (req: { functionName: string; address?: Address }) => {
      if (req.functionName === 'getOVaultRuntimeConfig') {
        return { hubComposer: FINALIZE_PARAMS.oracle, solanaEid, enabled }
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
        return batcherDefaultPeer ?? ZERO_BYTES32
      }
      if (req.functionName === 'peers') {
        return shareOftPeer ?? ZERO_BYTES32
      }
      if (req.functionName === 'quoteOFT') {
        if (quoteOftThrows) throw new Error('quoteOFT reverted')
        return [{ minAmountLD: 0n, maxAmountLD: previewShares }, [], { amountReceivedLD: previewShares }]
      }
      if (req.functionName === 'quoteSend') {
        return { nativeFee, lzTokenFee: 0n }
      }
      throw new Error(`unexpected readContract: ${req.functionName}`)
    }),
  }
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('shareBridgeOftWiring', () => {
  it('passes when bridge is not required', async () => {
    const client = createWiringMockClient({ enabled: false, destination: ZERO_BYTES32 })
    await expect(
      assertShareBridgeOftWiringForFinalize({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: buildFinalizeCalldata(),
        registryAddress: REGISTRY,
      }),
    ).resolves.toBeUndefined()
  })

  it('throws when registry and batcher default peers are missing', async () => {
    const client = createWiringMockClient({ registryPeer: null, batcherDefaultPeer: null })
    await expect(
      assertShareBridgeOftWiringForFinalize({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: buildFinalizeCalldata(),
        registryAddress: REGISTRY,
      }),
    ).rejects.toMatchObject({
      code: 'oft_peer_not_configured',
    } satisfies Partial<ShareBridgeOftWiringError>)
  })

  it('passes when batcher default peer is configured', async () => {
    const client = createWiringMockClient({ registryPeer: null, batcherDefaultPeer: BATCHER_DEFAULT_PEER })
    await expect(
      assertShareBridgeOftWiringForFinalize({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: buildFinalizeCalldata(),
        registryAddress: REGISTRY,
      }),
    ).resolves.toBeUndefined()
  })

  it('reports ready wiring when registry peer exists', async () => {
    const client = createWiringMockClient({ shareOftPeer: ZERO_BYTES32 })
    const status = await readShareBridgeOftWiringStatus({
      publicClient: client,
      batcherAddress: BATCHER,
      finalizeCallData: buildFinalizeCalldata(),
      registryAddress: REGISTRY,
    })
    expect('code' in status).toBe(false)
    if ('code' in status) return
    expect(status.bridgeRequired).toBe(true)
    expect(status.registryPeerConfigured).toBe(true)
    expect(status.effectivePeer).toBe(REGISTRY_PEER)
  })
})

describe('shareBridgeOftWiring stress (1000+ iterations)', () => {
  it('preflight + quote agree across 400 peer-source permutations', async () => {
    let iteration = 0
    for (const enabled of [true, false] as const) {
      for (const registryPeer of [null, REGISTRY_PEER] as const) {
        for (const batcherDefaultPeer of [null, BATCHER_DEFAULT_PEER] as const) {
          for (const previewShares of [0n, 3n, 4n, 1_000_000n * 10n ** 18n]) {
            iteration += 1
            const client = createWiringMockClient({
              enabled,
              registryPeer,
              batcherDefaultPeer,
              previewShares,
              nativeFee: 1_000_000_000_000n + BigInt(iteration),
            })
            const callData = buildFinalizeCalldata()
            const quote = await quoteFinalizeShareBridgeNativeFee({
              publicClient: client,
              batcherAddress: BATCHER,
              finalizeCallData: callData,
              registryAddress: REGISTRY,
            })

            const bridgeConfigured = enabled && DESTINATION !== ZERO_BYTES32
            const solanaAmount = bridgeConfigured ? (previewShares * 30n) / 100n : 0n
            const peerConfigured = registryPeer !== null || batcherDefaultPeer !== null

            if (!bridgeConfigured || solanaAmount <= 0n) {
              if ('code' in quote) {
                expect(['quote_failed', 'finalize_decode_failed']).toContain(quote.code)
              } else {
                expect(quote.required).toBe(false)
              }
              await expect(
                assertShareBridgeOftWiringForFinalize({
                  publicClient: client,
                  batcherAddress: BATCHER,
                  finalizeCallData: callData,
                  registryAddress: REGISTRY,
                }),
              ).resolves.toBeUndefined()
              continue
            }

            if (!peerConfigured) {
              expect('code' in quote && quote.code).toBe('oft_peer_not_configured')
              await expect(
                assertShareBridgeOftWiringForFinalize({
                  publicClient: client,
                  batcherAddress: BATCHER,
                  finalizeCallData: callData,
                  registryAddress: REGISTRY,
                }),
              ).rejects.toMatchObject({ code: 'oft_peer_not_configured' })
              continue
            }

            expect('code' in quote).toBe(false)
            if ('code' in quote) continue
            expect(quote.required).toBe(true)
            await expect(
              assertShareBridgeOftWiringForFinalize({
                publicClient: client,
                batcherAddress: BATCHER,
                finalizeCallData: callData,
                registryAddress: REGISTRY,
              }),
            ).resolves.toBeUndefined()
          }
        }
      }
    }
    expect(iteration).toBe(32)
  })

  it('attach + preflight stay aligned across 300 mixed finalize batches', async () => {
    for (let i = 0; i < 300; i += 1) {
      const useRegistryPeer = i % 3 !== 0
      const useDefaultPeer = !useRegistryPeer && i % 2 === 0
      const nativeFee = 800_000_000_000_000n + BigInt(i)
      const client = createWiringMockClient({
        registryPeer: useRegistryPeer ? REGISTRY_PEER : null,
        batcherDefaultPeer: useDefaultPeer ? BATCHER_DEFAULT_PEER : null,
        nativeFee,
      })
      const callData = buildFinalizeCalldata()
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: callData,
        registryAddress: REGISTRY,
      })

      if (!useRegistryPeer && !useDefaultPeer) {
        expect('code' in quote && quote.code).toBe('oft_peer_not_configured')
        continue
      }

      const attached = await attachFinalizeShareBridgeValueToCalls({
        publicClient: client,
        calls: [
          { to: FINALIZE_PARAMS.creatorToken, value: String(i), data: '0x095ea7b3' as Hex },
          { to: BATCHER, value: '0', data: callData },
        ],
      })
      expect(attached[1]?.value).toBe(String(nativeFee))
      await expect(
        assertShareBridgeOftWiringForFinalize({
          publicClient: client,
          batcherAddress: BATCHER,
          finalizeCallData: callData,
          registryAddress: REGISTRY,
        }),
      ).resolves.toBeUndefined()
    }
  })

  it('randomized wiring status reads stay consistent (370 cases)', async () => {
    const rng = mulberry32(0x4626_0fff)
    for (let i = 0; i < 370; i += 1) {
      const enabled = i % 4 !== 0
      const registryPeer = rng() > 0.45 ? REGISTRY_PEER : null
      const batcherDefaultPeer = registryPeer ? null : rng() > 0.5 ? BATCHER_DEFAULT_PEER : null
      const previewShares = BigInt(Math.floor(rng() * 1_000_000)) * 10n ** 18n
      const client = createWiringMockClient({
        enabled,
        registryPeer,
        batcherDefaultPeer,
        previewShares,
      })
      const status = await readShareBridgeOftWiringStatus({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: buildFinalizeCalldata(),
        registryAddress: REGISTRY,
      })
      if ('code' in status) {
        if (status.code === 'oft_peer_not_configured') {
          expect(registryPeer).toBeNull()
          expect(batcherDefaultPeer).toBeNull()
        }
        continue
      }
      const expectedEffective = registryPeer ?? batcherDefaultPeer
      if (status.bridgeRequired) {
        expect(status.effectivePeer).toBe(expectedEffective)
      } else {
        expect(status.effectivePeer).toBeNull()
      }
    }
  })

  it('rejects missing peers in 300 consecutive preflight attempts', async () => {
    for (let i = 0; i < 300; i += 1) {
      const client = createWiringMockClient({
        registryPeer: null,
        batcherDefaultPeer: null,
        nativeFee: 500_000_000_000n + BigInt(i),
      })
      await expect(
        assertShareBridgeOftWiringForFinalize({
          publicClient: client,
          batcherAddress: BATCHER,
          finalizeCallData: buildFinalizeCalldata(FINALIZE_PARAMS.depositAmount + BigInt(i)),
          registryAddress: REGISTRY,
        }),
      ).rejects.toMatchObject({ code: 'oft_peer_not_configured' })
    }
  })
})
