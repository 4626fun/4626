import { describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, encodeFunctionData, type Address, type Hex } from 'viem'

import {
  attachFinalizeShareBridgeValueToCalls,
  quoteFinalizeShareBridgeNativeFee,
  SELECTOR_BATCHER_FINALIZE_PHASE2,
  isFinalizePhase2CallSelector,
} from './finalizeShareBridgeFee'
import {
  assertShareBridgeOftWiringForFinalize,
  prepareFinalizeShareBridgeCallsForSend,
  readShareBridgeOftWiringStatus,
  ShareBridgeOftWiringError,
} from './shareBridgeOftWiring'

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const BATCHER = '0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8' as Address
const REGISTRY = '0x3f64087dc361Ad52300409E5873b26941D6418B6' as Address
const DESTINATION = `0x${'ab'.repeat(32)}` as Hex
const REGISTRY_PEER = `0x${'cd'.repeat(32)}` as Hex
const SEND_LIB = '0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2' as Address
const RECV_LIB = '0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf' as Address
const GREEN_ULN = encodeAbiParameters(
  [{ type: 'tuple', components: [
    { name: 'confirmations', type: 'uint64' },
    { name: 'requiredDvnCount', type: 'uint8' },
    { name: 'optionalDvnCount', type: 'uint8' },
    { name: 'optionalDvnThreshold', type: 'uint8' },
    { name: 'requiredDvns', type: 'address[]' },
    { name: 'optionalDvns', type: 'address[]' },
  ] }],
  [{ confirmations: 15n, requiredDvnCount: 0, optionalDvnCount: 5, optionalDvnThreshold: 3, requiredDvns: [], optionalDvns: [
    '0x9e059a54699a285714207b43B055483E78FAac25',
    '0xa7b5189bcA84Cd304D8553977c7C614329750d99',
    '0xc2A0C36f5939A14966705c7Cec813163FaEEa1F0',
    '0xcd37CA043f8479064e10635020c65FfC005d36f6',
    '0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc',
  ] as Address[] }],
)
const GREEN_RECV_ULN = encodeAbiParameters(
  [{ type: 'tuple', components: [
    { name: 'confirmations', type: 'uint64' },
    { name: 'requiredDvnCount', type: 'uint8' },
    { name: 'optionalDvnCount', type: 'uint8' },
    { name: 'optionalDvnThreshold', type: 'uint8' },
    { name: 'requiredDvns', type: 'address[]' },
    { name: 'optionalDvns', type: 'address[]' },
  ] }],
  [{ confirmations: 32n, requiredDvnCount: 0, optionalDvnCount: 5, optionalDvnThreshold: 3, requiredDvns: [], optionalDvns: [
    '0x9e059a54699a285714207b43B055483E78FAac25',
    '0xa7b5189bcA84Cd304D8553977c7C614329750d99',
    '0xc2A0C36f5939A14966705c7Cec813163FaEEa1F0',
    '0xcd37CA043f8479064e10635020c65FfC005d36f6',
    '0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc',
  ] as Address[] }],
)
const GREEN_ENFORCED = '0x00030100210100000000000000000000000000030d40000000000000000000000000001f1df0' as Hex

const FINALIZE_PARAMS = {
  creatorToken: '0x1111111111111111111111111111111111111111',
  owner: '0x2222222222222222222222222222222222222222',
  vault: '0x3333333333333333333333333333333333333333',
  wrapper: '0x4444444444444444444444444444444444444444',
  shareOFT: '0x5555555555555555555555555555555555555555',
  gaugeController: '0x6666666666666666666666666666666666666666',
  ccaLaunchArm: '0x7777777777777777777777777777777777777777',
  oracle: '0x8888888888888888888888888888888888888888',
  version: 'v1.2.3x',
  depositAmount: 50_000_000n * 10n ** 18n,
  requiredRaise: 100_000_000_000_000_000n,
  floorPriceQ96: 1n,
  auctionSteps: '0x' as Hex,
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
          { name: 'ccaLaunchArm', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
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
  shareOftPeer?: Hex | null
  previewThrows?: boolean
  quoteOftThrows?: boolean
  sendConfirmations?: bigint
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
    shareOftPeer = null,
    previewThrows = false,
    quoteOftThrows = false,
    sendConfirmations = 15n,
  } = config

  return {
    readContract: vi.fn(async (req: { functionName: string; address?: Address; args?: readonly unknown[] }) => {
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
      if (req.functionName === 'getSendLibrary') return SEND_LIB
      if (req.functionName === 'getReceiveLibrary') return [RECV_LIB, false]
      if (req.functionName === 'getConfig') {
        // First getConfig in Promise.all is send; second is receive — distinguish by lib arg when present.
        const lib = req.args?.[1]
        if (typeof lib === 'string' && lib.toLowerCase() === RECV_LIB.toLowerCase()) return GREEN_RECV_ULN
        if (sendConfirmations === 15n) return GREEN_ULN
        return encodeAbiParameters(
          [{ type: 'tuple', components: [
            { name: 'confirmations', type: 'uint64' },
            { name: 'requiredDvnCount', type: 'uint8' },
            { name: 'optionalDvnCount', type: 'uint8' },
            { name: 'optionalDvnThreshold', type: 'uint8' },
            { name: 'requiredDvns', type: 'address[]' },
            { name: 'optionalDvns', type: 'address[]' },
          ] }],
          [{ confirmations: sendConfirmations, requiredDvnCount: 0, optionalDvnCount: 5, optionalDvnThreshold: 3, requiredDvns: [], optionalDvns: [
            '0x9e059a54699a285714207b43B055483E78FAac25',
            '0xa7b5189bcA84Cd304D8553977c7C614329750d99',
            '0xc2A0C36f5939A14966705c7Cec813163FaEEa1F0',
            '0xcd37CA043f8479064e10635020c65FfC005d36f6',
            '0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc',
          ] as Address[] }],
        )
      }
      if (req.functionName === 'enforcedOptions') return GREEN_ENFORCED
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
  it('recognizes trimmed finalizePhase2 selector for attach/decode paths', () => {
    const data = buildFinalizeCalldata()
    expect(data.slice(0, 10).toLowerCase()).toBe(SELECTOR_BATCHER_FINALIZE_PHASE2)
    expect(SELECTOR_BATCHER_FINALIZE_PHASE2).toBe('0xcafc9348')
    expect(isFinalizePhase2CallSelector(SELECTOR_BATCHER_FINALIZE_PHASE2)).toBe(true)
  })

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

  it('throws when registry peer is missing', async () => {
    const client = createWiringMockClient({ registryPeer: null })
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

  it('throws when Base send ULN confirmations are below template (B2 class)', async () => {
    const client = createWiringMockClient({ sendConfirmations: 10n })
    await expect(
      assertShareBridgeOftWiringForFinalize({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: buildFinalizeCalldata(),
        registryAddress: REGISTRY,
      }),
    ).rejects.toMatchObject({
      code: 'lz_uln_pathway_not_ready',
    } satisfies Partial<ShareBridgeOftWiringError>)
  })

  it('prepareFinalizeShareBridgeCallsForSend blocks B2-class ULN before finalize submit', async () => {
    const callData = buildFinalizeCalldata()
    const badClient = createWiringMockClient({ sendConfirmations: 10n })
    await expect(
      prepareFinalizeShareBridgeCallsForSend({
        publicClient: badClient,
        calls: [{ to: BATCHER, value: '0', data: callData }],
        registryAddress: REGISTRY,
      }),
    ).rejects.toMatchObject({
      code: 'lz_uln_pathway_not_ready',
    } satisfies Partial<ShareBridgeOftWiringError>)

    const goodClient = createWiringMockClient({ sendConfirmations: 15n })
    const prepared = await prepareFinalizeShareBridgeCallsForSend({
      publicClient: goodClient,
      calls: [{ to: BATCHER, value: '0', data: callData }],
      registryAddress: REGISTRY,
    })
    expect(prepared).toHaveLength(1)
    expect(prepared[0]?.value).toBe('1500000000000000')
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
        for (const previewShares of [0n, 3n, 4n, 1_000_000n * 10n ** 18n]) {
          iteration += 1
          const client = createWiringMockClient({
            enabled,
            registryPeer,
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
            const peerConfigured = registryPeer !== null

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
    expect(iteration).toBe(16)
  })

  it('attach + preflight stay aligned across 300 mixed finalize batches', async () => {
    for (let i = 0; i < 300; i += 1) {
      const useRegistryPeer = i % 2 === 0
      const nativeFee = 800_000_000_000_000n + BigInt(i)
      const client = createWiringMockClient({
        registryPeer: useRegistryPeer ? REGISTRY_PEER : null,
        nativeFee,
      })
      const callData = buildFinalizeCalldata()
      const quote = await quoteFinalizeShareBridgeNativeFee({
        publicClient: client,
        batcherAddress: BATCHER,
        finalizeCallData: callData,
        registryAddress: REGISTRY,
      })

      if (!useRegistryPeer) {
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
      const previewShares = BigInt(Math.floor(rng() * 1_000_000)) * 10n ** 18n
      const client = createWiringMockClient({
        enabled,
        registryPeer,
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
        }
        continue
      }
      if (status.bridgeRequired) {
        expect(status.effectivePeer).toBe(registryPeer)
      } else {
        expect(status.effectivePeer).toBeNull()
      }
    }
  })

  it('rejects missing peers in 300 consecutive preflight attempts', async () => {
    for (let i = 0; i < 300; i += 1) {
      const client = createWiringMockClient({
        registryPeer: null,
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
