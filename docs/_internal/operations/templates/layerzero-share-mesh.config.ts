/**
 * Platform LayerZero Simple Config template — Solana share mesh (per creator).
 *
 * Copy this file into your `create-lz-oapp` scaffold as `layerzero.config.ts`
 * after `hardhat lz:oft:solana:create`. Replace contract placeholders with
 * hardhat-deploy names / Solana OFT store address from
 * `deployments/solana-mainnet/OFT.json` (or testnet equivalent).
 *
 * Policy: docs/operations/solana-share-mesh-lottery-policy.md
 * Runbook: docs/operations/solana-share-mesh-creator-provisioning.md
 *
 * Re-verify DVN names against https://metadata.layerzero-api.com/v1/metadata
 * before every mainnet wire — names must exist on BOTH chains in each pathway row.
 */

import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

import { getOftStoreAddress } from './tasks/solana'

/** Base ↔ Solana — 6-of-9 optional (all nine on both `base` and `solana` metadata keys). */
export const MAINNET_BASE_SOLANA_OPTIONAL_DVNS = [
  'LayerZero Labs',
  'Google',
  'Nethermind',
  'Horizen',
  'Deutsche Telekom',
  'Nansen',
  'Frax',
  'Wyoming',
  'P-OPS',
] as const

export const MAINNET_BASE_SOLANA_OPTIONAL_THRESHOLD = 6

/**
 * Base ↔ Hyperliquid (and Solana ↔ Hyperliquid if wired) — 6-of-6 optional.
 * Google, Wyoming, P-OPS are NOT on `hyperliquid` metadata; do not use the nine-name pool here.
 */
export const MAINNET_HYPE_INTERSECT_SIX = [
  'LayerZero Labs',
  'Nethermind',
  'Horizen',
  'Deutsche Telekom',
  'Nansen',
  'Frax',
] as const

export const MAINNET_HYPE_OPTIONAL_THRESHOLD = 6

/** Devnet arbsep ↔ solana-testnet — max 2-of-3 (only three shared DVNs in metadata). */
export const DEVNET_OPTIONAL_DVNS = ['LayerZero Labs', 'Paxos', 'Anchorage'] as const
export const DEVNET_OPTIONAL_THRESHOLD = 2

// --- EVM side: hardhat-deploy contract name for this creator's Base ShareOFT / MyOFT clone ---
const baseShareOft: OmniPointHardhat = {
  eid: EndpointId.BASE_V2_MAINNET, // devnet rehearsal: EndpointId.ARBSEP_V2_TESTNET + contractName 'MyOFT'
  contractName: 'MyOFT', // rename in production scaffold if needed
}

const solanaOftStore: OmniPointHardhat = {
  eid: EndpointId.SOLANA_V2_MAINNET, // devnet: EndpointId.SOLANA_V2_TESTNET
  address: getOftStoreAddress(EndpointId.SOLANA_V2_MAINNET),
}

// Optional third chain — uncomment when product enables Hyperliquid share leg
// const hyperliquidShareOft: OmniPointHardhat = {
//   eid: EndpointId.HYPERLIQUID_V2_MAINNET,
//   contractName: 'MyOFT', // deploy MyOFT on Hyperliquid in same scaffold or separate project
// }

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1,
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: 80_000,
    value: 0,
  },
]

const CU_LIMIT = 200_000
const SPL_TOKEN_ACCOUNT_RENT_VALUE = 2_039_280

const SOLANA_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1,
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: CU_LIMIT,
    value: SPL_TOKEN_ACCOUNT_RENT_VALUE,
  },
]

// Simple Config tuple: [ requiredDVN[], [ optionalDVN[], threshold ] ]
const BASE_SOLANA_DVN: [[], [readonly string[], number]] = [
  [],
  [[...MAINNET_BASE_SOLANA_OPTIONAL_DVNS], MAINNET_BASE_SOLANA_OPTIONAL_THRESHOLD],
]

const BASE_HYPE_DVN: [[], [readonly string[], number]] = [
  [],
  [[...MAINNET_HYPE_INTERSECT_SIX], MAINNET_HYPE_OPTIONAL_THRESHOLD],
]

export default async function () {
  const connections = await generateConnectionsConfig([
    // Pathway 1 — required for Pipe A (Base ShareOFT ↔ Solana share mesh)
    [
      baseShareOft,
      solanaOftStore,
      BASE_SOLANA_DVN,
      [15, 32], // [evm→solana confirmations, solana→evm confirmations]
      [SOLANA_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
    ],
    // Pathway 2 — optional Hyperliquid (separate DVN block; do not reuse nine-name pool)
    // [
    //   baseShareOft,
    //   hyperliquidShareOft,
    //   BASE_HYPE_DVN,
    //   [15, 15],
    //   [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
    // ],
    // Pathway 3 — optional Solana ↔ Hyperliquid (same HYPE_INTERSECT_SIX pool)
    // [solanaOftStore, hyperliquidShareOft, BASE_HYPE_DVN, [32, 15], [EVM_ENFORCED_OPTIONS, SOLANA_ENFORCED_OPTIONS]],
  ])

  return {
    contracts: [{ contract: baseShareOft }, { contract: solanaOftStore }],
    connections,
  }
}
