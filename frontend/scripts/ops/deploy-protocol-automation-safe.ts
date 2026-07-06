#!/usr/bin/env tsx
/**
 * Deploy the hot protocol automation Safe (Charm manager / Ajna admin lane).
 *
 * Default: broadcast SafeProxy deployment **via the cold protocol treasury Safe**
 * (`executeViaProtocolTreasurySafe`), so the hot Safe is created under treasury governance.
 *
 * Usage:
 *   pnpm -C frontend ops:deploy-protocol-automation-safe -- --dry-run
 *   pnpm -C frontend ops:deploy-protocol-automation-safe -- --execute
 *   pnpm -C frontend ops:deploy-protocol-automation-safe -- --execute --direct
 *   pnpm -C frontend ops:deploy-protocol-automation-safe -- --execute --remove-keeper-from-treasury
 *
 * Requires PRIVATE_KEY or PROTOCOL_TREASURY_SAFE_OWNER_PK for treasury-lane deploy.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import Safe from '@safe-global/protocol-kit'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { CANONICAL_KEEPER_AUTOMATION_EOA } from '../../server/_lib/wallet/keeperAutomationPolicy.js'
import {
  executeViaProtocolTreasurySafe,
  resolveProtocolTreasuryAddress,
  resolveProtocolTreasurySafeOwnerPrivateKey,
} from '../../server/_lib/wallet/protocolTreasurySafe.js'

const SALT_LABEL = '4626-protocol-automation-hot-v1' as const
const SALT_NONCE = keccak256(toHex(SALT_LABEL))
const MANIFEST_PATH = resolve(
  import.meta.dirname,
  '../../../docs/_internal/operations/wallet/protocol-automation-safe-manifest.json',
)

const SAFE_OWNER_MGMT_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isOwner',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'removeOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'prevOwner', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: '_threshold', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const SENTINEL = '0x0000000000000000000000000000000000000001' as const

type CliArgs = {
  dryRun: boolean
  execute: boolean
  direct: boolean
  removeKeeperFromTreasury: boolean
  backupAdmin: boolean
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const execute = argv.includes('--execute')
  return {
    dryRun: argv.includes('--dry-run') || !execute,
    execute,
    direct: argv.includes('--direct'),
    removeKeeperFromTreasury: argv.includes('--remove-keeper-from-treasury'),
    backupAdmin: argv.includes('--backup-admin'),
  }
}

function readAdminAddress(): Address | null {
  const pk = resolveProtocolTreasurySafeOwnerPrivateKey()
  if (!pk) return null
  return getAddress(privateKeyToAccount(pk).address)
}

function buildOwnerSet(backupAdmin: boolean): Address[] {
  const owners = [getAddress(CANONICAL_KEEPER_AUTOMATION_EOA)]
  if (backupAdmin) {
    const admin = readAdminAddress()
    if (!admin) {
      throw new Error('backup_admin_requested_but_treasury_admin_key_missing')
    }
    owners.push(admin)
  }
  return owners
}

async function resolvePredictedAutomationSafe(params: {
  rpcUrl: string
  owners: Address[]
  threshold: number
}): Promise<{
  predictedAddress: Address
  deploymentTx: { to: Address; data: Hex; value: bigint }
  alreadyDeployed: boolean
}> {
  const treasuryPk = resolveProtocolTreasurySafeOwnerPrivateKey()
  if (!treasuryPk) {
    throw new Error('protocol_treasury_safe_owner_key_missing')
  }

  const protocolKit = await Safe.init({
    provider: params.rpcUrl,
    signer: treasuryPk,
    predictedSafe: {
      safeAccountConfig: {
        owners: params.owners,
        threshold: params.threshold,
      },
      safeDeploymentConfig: {
        saltNonce: SALT_NONCE,
      },
    },
  })

  const predictedAddress = getAddress(await protocolKit.getAddress())
  const alreadyDeployed = await protocolKit.isSafeDeployed()
  const deploymentTx = await protocolKit.createSafeDeploymentTransaction()

  return {
    predictedAddress,
    alreadyDeployed,
    deploymentTx: {
      to: getAddress(deploymentTx.to as Address),
      data: deploymentTx.data as Hex,
      value: BigInt(deploymentTx.value ?? 0),
    },
  }
}

async function resolveRemoveKeeperCalldata(params: {
  publicClient: ReturnType<typeof createPublicClient>
  treasurySafe: Address
  keeper: Address
}): Promise<{ data: Hex; threshold: bigint }> {
  const [ownersRaw, threshold] = await Promise.all([
    params.publicClient.readContract({
      address: params.treasurySafe,
      abi: SAFE_OWNER_MGMT_ABI,
      functionName: 'getOwners',
    }),
    params.publicClient.readContract({
      address: params.treasurySafe,
      abi: SAFE_OWNER_MGMT_ABI,
      functionName: 'getThreshold',
    }),
  ])

  const owners = (ownersRaw as Address[]).map((owner) => getAddress(owner))
  const keeperIndex = owners.findIndex((owner) => owner.toLowerCase() === params.keeper.toLowerCase())
  if (keeperIndex === -1) {
    throw new Error('keeper_not_treasury_safe_owner')
  }

  const prevOwner = keeperIndex === 0 ? getAddress(SENTINEL) : owners[keeperIndex - 1]!
  const data = encodeFunctionData({
    abi: SAFE_OWNER_MGMT_ABI,
    functionName: 'removeOwner',
    args: [prevOwner, params.keeper, threshold],
  }) as Hex

  return { data, threshold }
}

async function main(): Promise<void> {
  const args = parseArgs()
  const rpcUrl = (process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const treasurySafe = resolveProtocolTreasuryAddress()
  const owners = buildOwnerSet(args.backupAdmin)
  const threshold = 1

  const { predictedAddress, alreadyDeployed, deploymentTx } = await resolvePredictedAutomationSafe({
    rpcUrl,
    owners,
    threshold,
  })

  console.log('=== Protocol automation Safe deploy plan ===')
  console.log(`Treasury Safe (deploy executor): ${treasurySafe}`)
  console.log(`Predicted hot Safe:             ${predictedAddress}`)
  console.log(`Salt label:                     ${SALT_LABEL}`)
  console.log(`Salt nonce:                     ${SALT_NONCE}`)
  console.log(`Owners (${threshold}-of-${owners.length}):`)
  for (const owner of owners) {
    console.log(`  - ${owner}`)
  }
  console.log(`Already deployed:               ${alreadyDeployed}`)
  console.log(`Deploy lane:                    ${args.direct ? 'direct admin EOA' : 'via protocol treasury Safe'}`)
  console.log(`Factory target:                 ${deploymentTx.to}`)
  console.log(`Factory calldata length:        ${deploymentTx.data.length} bytes`)
  console.log(`Factory value:                  ${deploymentTx.value} wei`)

  if (args.dryRun) {
    console.log('\nDry run only. Re-run with --execute to broadcast.')
    console.log('\nAfter deploy, set:')
    console.log(`  PROTOCOL_AUTOMATION_SAFE=${predictedAddress}`)
    console.log(`  VITE_PROTOCOL_AUTOMATION=${predictedAddress}`)
    return
  }

  if (alreadyDeployed) {
    console.log('\nHot automation Safe already deployed at predicted address — skipping factory deploy.')
  } else if (args.direct) {
    const pk = resolveProtocolTreasurySafeOwnerPrivateKey()
    if (!pk) throw new Error('protocol_treasury_safe_owner_key_missing')
    const account = privateKeyToAccount(pk)
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(rpcUrl),
    })
    const txHash = await walletClient.sendTransaction({
      to: deploymentTx.to,
      data: deploymentTx.data,
      value: deploymentTx.value,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
    if (receipt.status !== 'success') throw new Error('direct_safe_deploy_reverted')
    console.log(`\nDeployed hot Safe directly. Tx: ${txHash}`)
  } else {
    const result = await executeViaProtocolTreasurySafe({
      publicClient,
      rpcUrl,
      to: deploymentTx.to,
      data: deploymentTx.data,
      value: deploymentTx.value,
    })
    console.log(`\nDeployed hot Safe via treasury Safe.`)
    console.log(`Signer: ${result.signerAddress}`)
    console.log(`Tx: ${result.txHash}`)
    console.log(`https://basescan.org/tx/${result.txHash}`)
  }

  const code = await publicClient.getBytecode({ address: predictedAddress })
  if (!code || code === '0x') {
    throw new Error(`hot_safe_not_deployed:${predictedAddress}`)
  }

  const manifest = {
    deployedAt: new Date().toISOString(),
    chainId: base.id,
    saltLabel: SALT_LABEL,
    saltNonce: SALT_NONCE,
    protocolTreasurySafe: treasurySafe,
    protocolAutomationSafe: predictedAddress,
    owners,
    threshold,
    keeperAutomationEoa: CANONICAL_KEEPER_AUTOMATION_EOA,
    env: {
      PROTOCOL_AUTOMATION_SAFE: predictedAddress,
      VITE_PROTOCOL_AUTOMATION: predictedAddress,
    },
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`\nWrote manifest: ${MANIFEST_PATH}`)

  if (args.removeKeeperFromTreasury) {
    const isOwner = await publicClient.readContract({
      address: treasurySafe,
      abi: SAFE_OWNER_MGMT_ABI,
      functionName: 'isOwner',
      args: [getAddress(CANONICAL_KEEPER_AUTOMATION_EOA)],
    })
    if (!isOwner) {
      console.log('\nKeeper is not a treasury Safe owner — skip removeOwner.')
    } else {
      const { data } = await resolveRemoveKeeperCalldata({
        publicClient,
        treasurySafe,
        keeper: getAddress(CANONICAL_KEEPER_AUTOMATION_EOA),
      })
      const removeResult = await executeViaProtocolTreasurySafe({
        publicClient,
        rpcUrl,
        to: treasurySafe,
        data,
        value: 0n,
      })
      console.log('\nRemoved keeper EOA from treasury Safe owners.')
      console.log(`Tx: ${removeResult.txHash}`)
      console.log(`https://basescan.org/tx/${removeResult.txHash}`)
    }
  }

  console.log('\nNext steps:')
  console.log(`  1. Set PROTOCOL_AUTOMATION_SAFE=${predictedAddress} on Vercel production + local .env`)
  console.log(`  2. Redeploy production`)
  console.log(`  3. Wire grandfathered vault Charm/Ajna manager/admin to the hot Safe (separate ops)`)
  if (!args.removeKeeperFromTreasury) {
    console.log(`  4. Optional: re-run with --remove-keeper-from-treasury to shrink cold Safe blast radius`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
