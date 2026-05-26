#!/usr/bin/env tsx
/**
 * Read AKITA OVault mesh + adapter wiring on Base mainnet.
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
    name: 'creatorMesh',
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
  {
    type: 'function',
    name: 'endpoint',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
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
] as const

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

const adapterAbi = [
  {
    type: 'function',
    name: 'tokenToSolanaMint',
    stateMutability: 'view',
    inputs: [{ name: 'baseToken', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'baseToken', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

const shareOftAbi = [
  { type: 'function', name: 'isHub', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

function isZero(a: string) {
  return a.toLowerCase() === zeroAddress.toLowerCase()
}

async function main() {
  console.log('RPC:', rpc)
  console.log('AKITA creator:', AKITA_DEFAULTS.token)
  console.log('Hub composer:', HUB_COMPOSER)
  console.log('Split batcher:', SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  console.log('Solana adapter:', BASE_DEFAULTS.solanaBridgeAdapter)
  console.log('')

  const [composerCode, mesh, batcherCfg, wrapperCode] = await Promise.all([
    client.getBytecode({ address: HUB_COMPOSER }),
    client.readContract({
      address: HUB_COMPOSER,
      abi: composerAbi,
      functionName: 'creatorMesh',
      args: [AKITA_DEFAULTS.token],
    }),
    client.readContract({
      address: SPLIT_PHASE1_DEPLOYMENT_BATCHER,
      abi: batcherAbi,
      functionName: 'getOVaultRuntimeConfig',
    }),
    client.getBytecode({ address: AKITA_DEFAULTS.wrapper }),
  ])

  console.log('=== OVaultHubComposer ===')
  console.log('deployed:', composerCode && composerCode !== '0x' ? 'yes' : 'no')
  console.log('creatorMesh.vault:', mesh[0])
  console.log('creatorMesh.assetMeshToken:', mesh[1])
  console.log('creatorMesh.shareMeshToken:', mesh[2])
  console.log('creatorMesh.solanaEid:', mesh[3])
  console.log('creatorMesh.solanaAssetPeer:', mesh[4])
  console.log('creatorMesh.solanaSharePeer:', mesh[5])
  console.log('creatorMesh.paused:', mesh[6])
  console.log(
    'mesh configured:',
    !isZero(mesh[0]) && !isZero(mesh[2]) && mesh[3] > 0 ? 'yes' : 'NO',
  )
  console.log('')

  console.log('=== DeploymentBatcher (split Phase 1) ===')
  console.log('hubComposer:', batcherCfg[0])
  console.log('solanaEid:', batcherCfg[1])
  console.log('enabled:', batcherCfg[2])
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

  const adapter = BASE_DEFAULTS.solanaBridgeAdapter as Address
  const [creatorMint, shareMint, creatorReg, shareReg] = await Promise.all([
    client.readContract({
      address: adapter,
      abi: adapterAbi,
      functionName: 'tokenToSolanaMint',
      args: [AKITA_DEFAULTS.token],
    }),
    client.readContract({
      address: adapter,
      abi: adapterAbi,
      functionName: 'tokenToSolanaMint',
      args: [AKITA_DEFAULTS.shareOFT],
    }),
    client.readContract({
      address: adapter,
      abi: adapterAbi,
      functionName: 'isRegistered',
      args: [AKITA_DEFAULTS.token],
    }),
    client.readContract({
      address: adapter,
      abi: adapterAbi,
      functionName: 'isRegistered',
      args: [AKITA_DEFAULTS.shareOFT],
    }),
  ])

  console.log('=== SolanaBridgeAdapter (canonical) ===')
  console.log('creator registered:', creatorReg)
  console.log('creator tokenToSolanaMint:', creatorMint)
  console.log('ShareOFT registered:', shareReg)
  console.log('ShareOFT tokenToSolanaMint:', shareMint)
  console.log('')

  const shareCode = await client.getBytecode({ address: AKITA_DEFAULTS.shareOFT })
  console.log('=== ShareOFT ===')
  console.log('deployed:', shareCode && shareCode !== '0x' ? 'yes' : 'no')
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
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
