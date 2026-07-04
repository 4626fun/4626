/**
 * Platform LayerZero Simple Config template — Base ↔ Robinhood share mesh (per creator).
 *
 * Copy into your Hardhat `create-lz-oapp` scaffold as `layerzero.config.ts`.
 * Re-verify DVN names against https://metadata.layerzero-api.com/v1/metadata/dvns?chains=base,robinhood
 * before every mainnet wire.
 *
 * Policy: 3-of-5 optional DVNs shared on Base and Robinhood (never 1-of-1).
 * Runbook: docs/_internal/operations/operations/robinhood/robinhood-share-mesh-provisioning.md
 */

import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

/** Base ↔ Robinhood — 3-of-5 optional (intersection verified on mainnet metadata). */
export const MAINNET_BASE_ROBINHOOD_INTERSECT_FIVE = [
  'LayerZero Labs',
  'Nethermind',
  'Horizen',
  'BitGo',
  'Canary',
] as const

export const MAINNET_BASE_ROBINHOOD_OPTIONAL_THRESHOLD = 3

/** Robinhood mainnet EID until @layerzerolabs/lz-definitions adds ROBINHOOD_V2_MAINNET. */
export const ROBINHOOD_V2_MAINNET_EID = 30416 as const

const baseShareOft: OmniPointHardhat = {
  eid: EndpointId.BASE_V2_MAINNET,
  contractName: 'MyOFT',
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

const BASE_ROBINHOOD_DVN: [[], [readonly string[], number]] = [
  [],
  [[...MAINNET_BASE_ROBINHOOD_INTERSECT_FIVE], MAINNET_BASE_ROBINHOOD_OPTIONAL_THRESHOLD],
]

export default async function () {
  const connections = await generateConnectionsConfig([
    [
      baseShareOft,
      robinhoodShareOft,
      BASE_ROBINHOOD_DVN,
      [15, 15],
      [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
    ],
  ])

  return {
    contracts: [{ contract: baseShareOft }, { contract: robinhoodShareOft }],
    connections,
  }
}
