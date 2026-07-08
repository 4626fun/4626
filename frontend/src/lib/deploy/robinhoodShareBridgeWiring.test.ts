import { describe, expect, it, vi } from 'vitest'
import { concatHex, encodeAbiParameters, getAddress, type Address } from 'viem'

import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'
import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '@/config/contracts.defaults'
import {
  BASE_HUB_EID,
  predictOftBootstrapRegistryAddress,
  predictRemoteShareOftAddress,
  readRobinhoodShareMeshWiringStatus,
  ROBINHOOD_EID,
  ROBINHOOD_LZ_ENDPOINT,
} from './robinhoodShareBridgeWiring'
import {
  deriveShareOftSaltFromVersion,
  predictCreate2AddressFromInitCode,
} from './perVaultVanityVersionSearch'

const REGISTRY = '0x3f64087dc361Ad52300409E5873b26941D6418B6' as Address
const CREATOR = '0x1111111111111111111111111111111111111111' as Address
const BASE_SHARE = '0x2222222222222222222222222222222222222222' as Address
const RH_SHARE = BASE_SHARE
const HUB_GAUGE = '0x4444444444444444444444444444444444444444' as Address
const CREATE2_DEPLOYER = '0x5555555555555555555555555555555555555555' as Address
const CSW_OWNER = '0x6666666666666666666666666666666666666666' as Address

function peerFor(address: Address): `0x${string}` {
  return `0x${address.slice(2).padStart(64, '0')}` as `0x${string}`
}

function createMockClients(options?: { registryPeer?: Address; missingPeer?: boolean }) {
  const registryPeer = options?.registryPeer ?? RH_SHARE
  const basePeer = options?.missingPeer ? `0x${'00'.repeat(32)}` : peerFor(RH_SHARE)
  const rhPeer = options?.missingPeer ? `0x${'00'.repeat(32)}` : peerFor(BASE_SHARE)

  const baseClient = {
    readContract: vi.fn(async (req: { functionName: string; address: Address }) => {
      if (req.functionName === 'getEidForChainId') return ROBINHOOD_EID
      if (req.functionName === 'getLayerZeroEndpoint') return ROBINHOOD_LZ_ENDPOINT
      if (req.functionName === 'getRemoteOFTPeer') return registryPeer
      if (req.functionName === 'peers') return basePeer
      if (req.functionName === 'quoteSend') return { nativeFee: 42n, lzTokenFee: 0n }
      throw new Error(`unexpected base ${req.functionName}`)
    }),
  }

  const robinhoodClient = {
    getChainId: vi.fn(async () => 4663n),
    readContract: vi.fn(async (req: { functionName: string; address: Address }) => {
      if (req.functionName === 'chainEid') return ROBINHOOD_EID
      if (req.functionName === 'isHub') return false
      if (req.functionName === 'hubEid') return BASE_HUB_EID
      if (req.functionName === 'hubGaugeReceiver') return HUB_GAUGE
      if (req.functionName === 'peers') return rhPeer
      if (req.functionName === 'quoteSend') return { nativeFee: 24n, lzTokenFee: 0n }
      throw new Error(`unexpected robinhood ${req.functionName}`)
    }),
  }

  return { baseClient, robinhoodClient }
}

describe('predictRemoteShareOftAddress', () => {
  it('uses hub batcher as constructor owner and matches manual CREATE2 prediction', () => {
    const bootstrap = predictOftBootstrapRegistryAddress(CREATE2_DEPLOYER)
    const shareArgs = encodeAbiParameters(
      [{ type: 'string' }, { type: 'string' }, { type: 'address' }, { type: 'address' }],
      [
        'AKITA Shares',
        '■AKITA',
        bootstrap,
        getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER),
      ],
    )
    const initCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as `0x${string}`, shareArgs])
    const salt = deriveShareOftSaltFromVersion({
      creatorToken: CREATOR,
      owner: CSW_OWNER,
      shareSymbol: '■akita',
      version: 'v1.15.0',
    })

    const predicted = predictRemoteShareOftAddress({
      create2Deployer: CREATE2_DEPLOYER,
      shareName: 'AKITA Shares',
      shareSymbol: '■AKITA',
      oftBootstrapRegistry: bootstrap,
      creatorToken: CREATOR,
      owner: CSW_OWNER,
      deploymentVersion: 'v1.15.0',
    })

    const manual = predictCreate2AddressFromInitCode({
      create2Deployer: CREATE2_DEPLOYER,
      salt,
      initCode,
    })

    expect(predicted).toBe(manual)
  })
})

describe('readRobinhoodShareMeshWiringStatus', () => {
  it('returns ready when registry, remote config, peers, and quotes align', async () => {
    const { baseClient, robinhoodClient } = createMockClients()
    const status = await readRobinhoodShareMeshWiringStatus({
      baseClient,
      robinhoodClient,
      registryAddress: REGISTRY,
      creatorToken: CREATOR,
      baseShareOft: BASE_SHARE,
      robinhoodShareOft: RH_SHARE,
      hubGaugeReceiver: HUB_GAUGE,
    })

    expect(status.ready).toBe(true)
    expect(status.baseToRobinhoodQuoteWei).toBe(42n)
    expect(status.robinhoodToBaseQuoteWei).toBe(24n)
    expect(status.checks.find((c) => c.id === 'remote_is_hub')?.ok).toBe(true)
  })

  it('flags not ready when hub peer is missing', async () => {
    const { baseClient, robinhoodClient } = createMockClients({ missingPeer: true })
    const status = await readRobinhoodShareMeshWiringStatus({
      baseClient,
      robinhoodClient,
      registryAddress: REGISTRY,
      creatorToken: CREATOR,
      baseShareOft: BASE_SHARE,
      robinhoodShareOft: RH_SHARE,
      hubGaugeReceiver: HUB_GAUGE,
    })

    expect(status.ready).toBe(false)
    expect(status.checks.find((c) => c.id === 'base_peer_to_robinhood')?.ok).toBe(false)
    expect(status.checks.find((c) => c.id === 'remote_peer_to_base')?.ok).toBe(false)
  })

  it('flags address parity when base and robinhood ShareOFT differ', async () => {
    const { baseClient, robinhoodClient } = createMockClients()
    const status = await readRobinhoodShareMeshWiringStatus({
      baseClient,
      robinhoodClient,
      registryAddress: REGISTRY,
      creatorToken: CREATOR,
      baseShareOft: BASE_SHARE,
      robinhoodShareOft: BASE_SHARE,
      hubGaugeReceiver: HUB_GAUGE,
    })

    expect(status.checks.find((c) => c.id === 'share_oft_address_parity')?.ok).toBe(true)
  })
})
