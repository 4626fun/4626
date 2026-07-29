import { describe, expect, it } from 'vitest'

import {
  CCA_FACTORY_V110,
  CCA_FACTORY_V210,
  CCA_LAUNCH_CHAINS,
  LZ_ENDPOINT_V2_CANONICAL,
  LZ_ENDPOINT_V2_NONCANONICAL,
  SEVEN_DAYS_SECONDS,
  ZERO_ADDRESS,
  effectiveLaunchBlockTimeSeconds,
  type CcaLaunchChainKey,
} from './ccaLaunchChains'

const EXPECTED_KEYS: CcaLaunchChainKey[] = ['ethereum', 'base', 'unichain', 'arbitrum', 'robinhood']

const EXPECTED_CHAIN_IDS: Record<CcaLaunchChainKey, number> = {
  ethereum: 1,
  base: 8453,
  unichain: 130,
  arbitrum: 42_161,
  robinhood: 4_663,
}

const EXPECTED_EIDS: Record<CcaLaunchChainKey, number> = {
  ethereum: 30_101,
  base: 30_184,
  unichain: 30_320,
  arbitrum: 30_110,
  robinhood: 30_416,
}

const TWO_HOURS_SECONDS = 7_200
const EIGHT_HOURS_SECONDS = 28_800
const TOLERANCE = 0.05

describe('ccaLaunchChains', () => {
  it('covers exactly the five launch chains', () => {
    expect(Object.keys(CCA_LAUNCH_CHAINS).sort()).toEqual([...EXPECTED_KEYS].sort())
  })

  it('records canonical chainIds and unique EIDs', () => {
    const eids = new Set<number>()
    const chainIds = new Set<number>()
    for (const key of EXPECTED_KEYS) {
      const chain = CCA_LAUNCH_CHAINS[key]
      expect(chain.chainId).toBe(EXPECTED_CHAIN_IDS[key])
      expect(chain.eid).toBe(EXPECTED_EIDS[key])
      eids.add(chain.eid)
      chainIds.add(chain.chainId)
    }
    expect(eids.size).toBe(EXPECTED_KEYS.length)
    expect(chainIds.size).toBe(EXPECTED_KEYS.length)
  })

  it('defaultDuration ≈ 7 days under effective block time', () => {
    for (const key of EXPECTED_KEYS) {
      const chain = CCA_LAUNCH_CHAINS[key]
      const seconds = chain.defaultDurationBlocks * effectiveLaunchBlockTimeSeconds(chain)
      expect(Math.abs(seconds - SEVEN_DAYS_SECONDS) / SEVEN_DAYS_SECONDS).toBeLessThanOrEqual(
        TOLERANCE,
      )
    }
  })

  it('claim delay ≈ 2h and sweep delay ≈ 8h under effective block time', () => {
    for (const key of EXPECTED_KEYS) {
      const chain = CCA_LAUNCH_CHAINS[key]
      const claimSeconds = chain.defaultClaimDelayBlocks * effectiveLaunchBlockTimeSeconds(chain)
      const sweepSeconds = chain.defaultSweepDelayBlocks * effectiveLaunchBlockTimeSeconds(chain)
      expect(Math.abs(claimSeconds - TWO_HOURS_SECONDS) / TWO_HOURS_SECONDS).toBeLessThanOrEqual(
        TOLERANCE,
      )
      expect(Math.abs(sweepSeconds - EIGHT_HOURS_SECONDS) / EIGHT_HOURS_SECONDS).toBeLessThanOrEqual(
        TOLERANCE,
      )
    }
  })

  it('fast chains use blocks-per-second scheduling (robinhood 10, arbitrum 4)', () => {
    expect(CCA_LAUNCH_CHAINS.robinhood.launchBlocksPerSecond).toBe(10)
    expect(CCA_LAUNCH_CHAINS.arbitrum.launchBlocksPerSecond).toBe(4)
    for (const key of ['ethereum', 'base', 'unichain'] as const) {
      const chain = CCA_LAUNCH_CHAINS[key]
      expect(chain.launchBlocksPerSecond).toBe(0)
      expect(chain.launchBlockTimeSeconds).toBe(chain.blockTimeSeconds)
    }
    // bps chains leave the seconds field unused
    expect(CCA_LAUNCH_CHAINS.robinhood.launchBlockTimeSeconds).toBe(0)
    expect(CCA_LAUNCH_CHAINS.arbitrum.launchBlockTimeSeconds).toBe(0)
  })

  it('migration delay is 1 block everywhere', () => {
    for (const key of EXPECTED_KEYS) {
      expect(CCA_LAUNCH_CHAINS[key].migrationDelayBlocks).toBe(1)
    }
  })

  it('targets v2.1.0 on all new chains and records v1.1.0 for legacy Base', () => {
    expect(CCA_LAUNCH_CHAINS.base.targetCcaFactoryVersion).toBe('v1.1.0')
    for (const key of ['ethereum', 'unichain', 'arbitrum', 'robinhood'] as const) {
      expect(CCA_LAUNCH_CHAINS[key].targetCcaFactoryVersion).toBe('v2.1.0')
    }
  })

  it('records canonical factory addresses and the zero-protocol-fee gate', () => {
    expect(CCA_FACTORY_V110).toBe('0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5')
    expect(CCA_FACTORY_V210).toBe('0x000000001F26a0044BaA66024e7b6599c61963F8')
    for (const key of EXPECTED_KEYS) {
      const chain = CCA_LAUNCH_CHAINS[key]
      expect(chain.ccaFactoryV110).toBe(CCA_FACTORY_V110)
      expect(chain.ccaFactoryV210).toBe(CCA_FACTORY_V210)
      expect(chain.requireZeroCcaProtocolFee).toBe(true)
    }
  })

  it('does not expect empty CCA v2.1.0 factory on any launch chain', () => {
    for (const key of EXPECTED_KEYS) {
      expect(CCA_LAUNCH_CHAINS[key].ccaFactoryV210ExpectedEmptyPreBootstrap).toBe(false)
    }
  })

  it('pins Chainlink ETH/USD feeds for known chains and leaves Robinhood unset', () => {
    expect(CCA_LAUNCH_CHAINS.ethereum.chainlinkEthUsd).toBe(
      '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    )
    expect(CCA_LAUNCH_CHAINS.base.chainlinkEthUsd).toBe(
      '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    )
    expect(CCA_LAUNCH_CHAINS.arbitrum.chainlinkEthUsd).toBe(
      '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    )
    expect(CCA_LAUNCH_CHAINS.unichain.chainlinkEthUsd).toBe(
      '0xBcE70e194940a157f3A80566505a7E96f5238CCa',
    )
    expect(CCA_LAUNCH_CHAINS.robinhood.chainlinkEthUsd).toBe(
      '0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9',
    )
    expect(CCA_LAUNCH_CHAINS.arbitrum.sequencerUptimeFeed).not.toBe(ZERO_ADDRESS)
    expect(CCA_LAUNCH_CHAINS.base.sequencerUptimeFeed).not.toBe(ZERO_ADDRESS)
    expect(CCA_LAUNCH_CHAINS.ethereum.sequencerUptimeFeed).toBe(ZERO_ADDRESS)
  })

  it('uses non-canonical LZ EndpointV2 on Unichain and Robinhood', () => {
    expect(CCA_LAUNCH_CHAINS.unichain.lzEndpointV2).toBe(LZ_ENDPOINT_V2_NONCANONICAL)
    expect(CCA_LAUNCH_CHAINS.robinhood.lzEndpointV2).toBe(LZ_ENDPOINT_V2_NONCANONICAL)
    expect(CCA_LAUNCH_CHAINS.base.lzEndpointV2).toBe(LZ_ENDPOINT_V2_CANONICAL)
    expect(CCA_LAUNCH_CHAINS.ethereum.lzEndpointV2).toBe(LZ_ENDPOINT_V2_CANONICAL)
    expect(CCA_LAUNCH_CHAINS.arbitrum.lzEndpointV2).toBe(LZ_ENDPOINT_V2_CANONICAL)
  })

  it('pins Base taxHook and leaves spoke taxHooks at zero for no-hook migrate', () => {
    expect(CCA_LAUNCH_CHAINS.base.taxHook).toBe('0xca975B9dAF772C71161f3648437c3616E5Be0088')
    for (const key of ['ethereum', 'unichain', 'arbitrum', 'robinhood'] as const) {
      expect(CCA_LAUNCH_CHAINS[key].taxHook).toBe(ZERO_ADDRESS)
    }
  })

  it('pins wrappedNative (WETH) on every launch chain', () => {
    expect(CCA_LAUNCH_CHAINS.ethereum.wrappedNative).toBe(
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    )
    expect(CCA_LAUNCH_CHAINS.base.wrappedNative).toBe(
      '0x4200000000000000000000000000000000000006',
    )
    expect(CCA_LAUNCH_CHAINS.arbitrum.wrappedNative).toBe(
      '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    )
    expect(CCA_LAUNCH_CHAINS.unichain.wrappedNative).toBe(
      '0x4200000000000000000000000000000000000006',
    )
    expect(CCA_LAUNCH_CHAINS.robinhood.wrappedNative).toBe(
      '0x4200000000000000000000000000000000000006',
    )
  })

  it('pins Uniswap v4 PositionManager on every launch chain', () => {
    expect(CCA_LAUNCH_CHAINS.ethereum.positionManagerV4).toBe(
      '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e',
    )
    expect(CCA_LAUNCH_CHAINS.base.positionManagerV4).toBe(
      '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    )
    expect(CCA_LAUNCH_CHAINS.unichain.positionManagerV4).toBe(
      '0x4529A01c7A0410167c5740C487a8de60232617bf',
    )
    expect(CCA_LAUNCH_CHAINS.arbitrum.positionManagerV4).toBe(
      '0xd88F38F930b7952f2Db2432Cb002E7abbf3DD869',
    )
    expect(CCA_LAUNCH_CHAINS.robinhood.positionManagerV4).toBe(
      '0x58Daec3116AAe6d93017bAaEA7749052e8A04Fa7',
    )
  })
})
