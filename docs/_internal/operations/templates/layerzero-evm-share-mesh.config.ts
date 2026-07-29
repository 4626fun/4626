/**
 * TEMPLATE — Platform LayerZero Simple Config — Base hub ↔ EVM share-mesh spokes
 * (Ethereum, Arbitrum, Unichain, Robinhood Chain), per creator.
 *
 * THIS FILE IS A TEMPLATE. Copy into your Hardhat `create-lz-oapp` scaffold as
 * `layerzero.config.ts` to use. Re-verify DVN names against
 * https://metadata.layerzero-api.com/v1/metadata/dvns?chains=base,ethereum,arbitrum,unichain,robinhood
 * before every mainnet wire — names must exist on BOTH chains in each pathway row.
 *
 * Policy: 3-of-5 optional DVNs on every pathway (NEVER single-DVN 1-of-1).
 * EVM↔EVM confirmations: [15, 15] both directions (precedent:
 * layerzero-robinhood-share-mesh.config.ts). Never rely on library defaults —
 * wire both sides explicitly (B2 incident class: outbound < inbound → LZ BLOCKED).
 *
 * Runbook: docs/_internal/operations/operations/robinhood/robinhood-share-mesh-provisioning.md
 */

import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

/** Base ↔ Ethereum / Arbitrum / Unichain — 3-of-5 optional (widely available on EVM mainnets). */
export const MAINNET_EVM_INTERSECT_FIVE = [
  'LayerZero Labs',
  'Google',
  'Nethermind',
  'Horizen',
  'Deutsche Telekom',
] as const

/** Base ↔ Robinhood — 3-of-5 optional (intersection verified on mainnet metadata). */
export const MAINNET_BASE_ROBINHOOD_INTERSECT_FIVE = [
  'LayerZero Labs',
  'Nethermind',
  'Horizen',
  'BitGo',
  'Canary',
] as const

export const MAINNET_EVM_OPTIONAL_THRESHOLD = 3

/** Robinhood mainnet EID until @layerzerolabs/lz-definitions adds ROBINHOOD_V2_MAINNET. */
export const ROBINHOOD_V2_MAINNET_EID = 30416 as const

const baseShareOft: OmniPointHardhat = {
  eid: EndpointId.BASE_V2_MAINNET,
  contractName: 'MyOFT',
}

const ethereumShareOft: OmniPointHardhat = {
  eid: EndpointId.ETHEREUM_V2_MAINNET,
  contractName: 'MyOFTEthereum',
}

const arbitrumShareOft: OmniPointHardhat = {
  eid: EndpointId.ARBITRUM_V2_MAINNET,
  contractName: 'MyOFTArbitrum',
}

const unichainShareOft: OmniPointHardhat = {
  eid: EndpointId.UNICHAIN_V2_MAINNET,
  contractName: 'MyOFTUnichain',
}

const robinhoodShareOft: OmniPointHardhat = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- numeric EID until lz-definitions ships Robinhood
  eid: ROBINHOOD_V2_MAINNET_EID as any,
  contractName: 'MyOFTRobinhood',
}

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1,
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: 80_000,
    value: 0,
  },
]

// Simple Config tuple: [ requiredDVN[], [ optionalDVN[], threshold ] ]
const EVM_DVN: [[], [readonly string[], number]] = [
  [],
  [[...MAINNET_EVM_INTERSECT_FIVE], MAINNET_EVM_OPTIONAL_THRESHOLD],
]

const BASE_ROBINHOOD_DVN: [[], [readonly string[], number]] = [
  [],
  [[...MAINNET_BASE_ROBINHOOD_INTERSECT_FIVE], MAINNET_EVM_OPTIONAL_THRESHOLD],
]

export default async function () {
  const connections = await generateConnectionsConfig([
    // HARD: never lower confirmations to paper over library defaults — wire both
    // sides to 15 so outbound >= inbound on every EVM↔EVM pathway.
    [baseShareOft, ethereumShareOft, EVM_DVN, [15, 15], [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS]],
    [baseShareOft, arbitrumShareOft, EVM_DVN, [15, 15], [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS]],
    [baseShareOft, unichainShareOft, EVM_DVN, [15, 15], [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS]],
    [
      baseShareOft,
      robinhoodShareOft,
      BASE_ROBINHOOD_DVN,
      [15, 15],
      [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
    ],
  ])

  return {
    contracts: [
      { contract: baseShareOft },
      { contract: ethereumShareOft },
      { contract: arbitrumShareOft },
      { contract: unichainShareOft },
      { contract: robinhoodShareOft },
    ],
    connections,
  }
}
