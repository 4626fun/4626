#!/usr/bin/env tsx
/**
 * Read AKITA OVault mesh wiring on Base mainnet (LayerZero ShareOFT).
 *
 *   pnpm -C frontend exec tsx scripts/ops/read-akita-ovault-mesh-onchain.ts
 */
import { createPublicClient, http, type Address, zeroAddress } from 'viem'
import { base } from 'viem/chains'
import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'
import { SPLIT_PHASE1_DEPLOYMENT_BATCHER, BASE_DEFAULTS } from '../../src/config/contracts.defaults.js'

const HUB_COMPOSER = (process.env.OVAULT_HUB_COMPOSER ??
  '0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1') as Address

const rpc =
  process.env.BASE_READ_RPC_URL ??
  process.env.BASE_RPC_URL?.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace('/ws/', '/rpc/') ??
  'https://mainnet.base.org'

const client = createPublicClient({ chain: base, transport: http(rpc) })

const composerAbi = [
  {
    type: 'function',
    name: 'tokenMesh',
    stateMutability: 'view',
    inputs: [{ name: 'creatorToken', type: 'address' }],
    outputs: [
      { name: 'vault', type: 'address' },
      { name: 'assetMeshToken', type: 'address' },
      { name: 'shareMeshToken', type: 'address' },
      { name: 'solanaEid', type: 'uint32' },
      { name: 'solanaAssetPeer', type: 'bytes32' },
      { name: 'solanaSharePeer', type: 'bytes32' },
      { name: 'paused', type: 'bool' },
    ],
  },
] as const

const batcherAbi = [
  {
    type: 'function',
    name: 'getOVaultRuntimeConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'hubComposer', type: 'address' },
      { name: 'solanaEid', type: 'uint32' },
      { name: 'enabled', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const

const registryPeerAbi = [
  {
    type: 'function',
    name: 'getRemoteOFTPeerBytes32',
    stateMutability: 'view',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_chainEid', type: 'uint32' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
] as const

const SOLANA_EID = 30168
const REGISTRY = BASE_DEFAULTS.registry as Address
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`

const wrapperAbi = [
  {
    type: 'function',
    name: 'isBeneficiaryOperator',
    stateMutability: 'view',
    inputs: [{ name: 'operator', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const shareOftAbi = [
  { type: 'function', name: 'isHub', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'peers',
    stateMutability: 'view',
    inputs: [{ name: 'eid', type: 'uint32' }],
    outputs: [{ type: 'bytes32' }],
  },
] as const

function isZero(a: string) {
  return a.toLowerCase() === zeroAddress.toLowerCase()
}

async function main() {
  console.log('RPC:', rpc)
  console.log('AKITA creator:', AKITA_DEFAULTS.token)
  console.log('Hub composer:', HUB_COMPOSER)
  console.log('Split batcher:', SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  console.log('Bridge model: LayerZero ShareOFT')
  console.log('')

  const [composerCode, mesh, batcherCfg, batcherDestination, wrapperCode] = await Promise.all([
    client.getBytecode({ address: HUB_COMPOSER }),
    client.readContract({
      address: HUB_COMPOSER,
      abi: composerAbi,
      functionName: 'tokenMesh',
      args: [AKITA_DEFAULTS.token],
    }),
    client.readContract({
      address: SPLIT_PHASE1_DEPLOYMENT_BATCHER,
      abi: batcherAbi,
      functionName: 'getOVaultRuntimeConfig',
    }),
    client.readContract({
      address: SPLIT_PHASE1_DEPLOYMENT_BATCHER,
      abi: batcherAbi,
      functionName: 'solanaDestination',
    }),
    client.getBytecode({ address: AKITA_DEFAULTS.wrapper }),
  ])

  console.log('=== OVaultHubComposer ===')
  console.log('deployed:', composerCode && composerCode !== '0x' ? 'yes' : 'no')
  console.log('tokenMesh.vault:', mesh[0])
  console.log('tokenMesh.assetMeshToken:', mesh[1])
  console.log('tokenMesh.shareMeshToken:', mesh[2])
  console.log('tokenMesh.solanaEid:', mesh[3])
  console.log('tokenMesh.solanaAssetPeer:', mesh[4])
  console.log('tokenMesh.solanaSharePeer:', mesh[5])
  console.log('tokenMesh.paused:', mesh[6])
  console.log(
    'mesh configured:',
    !isZero(mesh[0]) && !isZero(mesh[2]) && mesh[3] > 0 ? 'yes' : 'NO',
  )
  console.log('')

  console.log('=== DeploymentBatcher (split Phase 1) ===')
  console.log('hubComposer:', batcherCfg[0])
  console.log('solanaEid:', batcherCfg[1])
  console.log('enabled:', batcherCfg[2])
  console.log('solanaDestination():', batcherDestination)
  console.log(
    'pipe-a destination gate:',
    String(batcherDestination).toLowerCase() !== ZERO_BYTES32 ? 'configured' : 'BLOCKED (zero)',
  )
  console.log('')

  console.log('=== AKITA wrapper ===')
  console.log('deployed:', wrapperCode && wrapperCode !== '0x' ? 'yes' : 'no')
  let composerIsOperator = false
  let wrapperShareOft: Address | null = null
  if (wrapperCode && wrapperCode !== '0x') {
    try {
      composerIsOperator = await client.readContract({
        address: AKITA_DEFAULTS.wrapper,
        abi: wrapperAbi,
        functionName: 'isBeneficiaryOperator',
        args: [HUB_COMPOSER],
      })
      wrapperShareOft = await client.readContract({
        address: AKITA_DEFAULTS.wrapper,
        abi: wrapperAbi,
        functionName: 'shareOFT',
      })
    } catch {
      console.log('isBeneficiaryOperator: (not on this wrapper revision)')
    }
  }
  console.log('composer isBeneficiaryOperator:', composerIsOperator)
  console.log('wrapper.shareOFT():', wrapperShareOft ?? 'n/a')
  console.log('')

  const shareCode = await client.getBytecode({ address: AKITA_DEFAULTS.shareOFT })
  console.log('=== ShareOFT + Registry4626 peer ===')
  console.log('deployed:', shareCode && shareCode !== '0x' ? 'yes' : 'no')
  let registrySharePeer: `0x${string}` | null = null
  try {
    registrySharePeer = await client.readContract({
      address: REGISTRY,
      abi: registryPeerAbi,
      functionName: 'getRemoteOFTPeerBytes32',
      args: [AKITA_DEFAULTS.token, SOLANA_EID],
    })
    console.log(`registry.getRemoteOFTPeerBytes32(AKITA, ${SOLANA_EID}):`, registrySharePeer)
    console.log(
      'registry peer gate:',
      registrySharePeer && registrySharePeer.toLowerCase() !== ZERO_BYTES32
        ? 'configured'
        : 'BLOCKED (zero) — seed setRemoteOFTPeerBytes32',
    )
  } catch {
    console.log('registry peer read: failed')
  }
  try {
    const shareHub = await client.readContract({
      address: AKITA_DEFAULTS.shareOFT,
      abi: shareOftAbi,
      functionName: 'isHub',
    })
    const shareSupply = await client.readContract({
      address: AKITA_DEFAULTS.shareOFT,
      abi: shareOftAbi,
      functionName: 'totalSupply',
    })
    console.log('isHub:', shareHub)
    console.log('totalSupply:', shareSupply.toString())
  } catch {
    console.log('isHub/totalSupply: (pre-OFT mesh revision or non-ShareOFT bytecode at address)')
  }
  try {
    const shareOftSolanaPeer = await client.readContract({
      address: AKITA_DEFAULTS.shareOFT,
      abi: shareOftAbi,
      functionName: 'peers',
      args: [SOLANA_EID],
    })
    console.log(`ShareOFT.peers(${SOLANA_EID}):`, shareOftSolanaPeer)
  } catch {
    console.log(`ShareOFT.peers(${SOLANA_EID}): (no peers() on this revision)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
