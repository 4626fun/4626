#!/usr/bin/env tsx

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  type Address,
} from 'viem'
import { base } from 'viem/chains'

const FACTORY = getAddress('0x08156CF52BBD983Daf99a26508462d3593c5f6bf')
const TREASURY_SAFE = getAddress('0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3')
const CANONICAL_SEEDER = getAddress('0xAb6d5C10b03300326CD7fAb7267Ae192842967b5')
const CREATOR_COIN = getAddress('0x5b674196812451B7cEC024FE9d22D2c0b172fa75')
const TOKEN_ID = 1659n

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'allPoolsLength',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'poolCreatorAllowed',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'pairAllowed',
    stateMutability: 'view',
    inputs: [
      { name: 'creatorCoin', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setPoolCreatorAllowed',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setPairAllowed',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'creatorCoin', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
] as const

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    throw new Error('PRIVATE_KEY must be a 32-byte 0x-prefixed key')
  }
  return trimmed as `0x${string}`
}

async function readPolicy(
  client: ReturnType<typeof createPublicClient>,
): Promise<{
  owner: Address
  pools: bigint
  creatorAllowed: boolean
  pairAllowed: boolean
}> {
  const [owner, pools, creatorAllowed, pairAllowed] = await Promise.all([
    client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: 'owner' }),
    client.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: 'allPoolsLength',
    }),
    client.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: 'poolCreatorAllowed',
      args: [CANONICAL_SEEDER],
    }),
    client.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: 'pairAllowed',
      args: [CREATOR_COIN, TOKEN_ID],
    }),
  ])
  return { owner: getAddress(owner), pools, creatorAllowed, pairAllowed }
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const rpcUrl = process.env.BASE_RPC_URL?.trim() || 'https://base-rpc.publicnode.com'
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const before = await readPolicy(client)
  if (before.owner !== TREASURY_SAFE) throw new Error('factory_owner_mismatch')
  if (before.pools !== 0n) throw new Error('factory_registry_not_empty')

  const transactions = []
  if (!before.creatorAllowed) {
    transactions.push({
      to: FACTORY,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: FACTORY_ABI,
        functionName: 'setPoolCreatorAllowed',
        args: [CANONICAL_SEEDER, true],
      }),
    })
  }
  if (!before.pairAllowed) {
    transactions.push({
      to: FACTORY,
      value: '0',
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: FACTORY_ABI,
        functionName: 'setPairAllowed',
        args: [CREATOR_COIN, TOKEN_ID, true],
      }),
    })
  }

  console.log(
    JSON.stringify(
      {
        mode: execute ? 'execute' : 'dry-run',
        chainId: base.id,
        safe: TREASURY_SAFE,
        factory: FACTORY,
        canonicalSeeder: CANONICAL_SEEDER,
        pair: { creatorCoin: CREATOR_COIN, tokenId: TOKEN_ID.toString() },
        before: {
          ...before,
          pools: before.pools.toString(),
        },
        transactions,
      },
      null,
      2,
    ),
  )

  if (transactions.length === 0) {
    console.log('Factory allowlist is already configured.')
    return
  }
  if (!execute) {
    console.log('Dry-run complete. Re-run with --execute after reviewing both fixed calls.')
    return
  }

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: normalizePrivateKey(process.env.PRIVATE_KEY ?? ''),
    safeAddress: TREASURY_SAFE,
  })
  const signerAddress = await protocolKit.getSafeProvider().getSignerAddress()
  const owners = await protocolKit.getOwners()
  if (!signerAddress || !owners.some((owner) => getAddress(owner) === getAddress(signerAddress))) {
    throw new Error('configured_signer_is_not_treasury_safe_owner')
  }
  if ((await protocolKit.getThreshold()) !== 1) {
    throw new Error('treasury_safe_threshold_requires_external_confirmation')
  }

  const safeTransaction = await protocolKit.createTransaction({ transactions })
  const execution = await protocolKit.executeTransaction(safeTransaction)
  const hash = execution.hash ?? execution.transactionResponse?.hash
  if (!hash) throw new Error('safe_execution_hash_missing')
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as `0x${string}`,
    timeout: 120_000,
  })
  if (receipt.status !== 'success') throw new Error('safe_execution_reverted')

  const after = await readPolicy(client)
  if (!after.creatorAllowed || !after.pairAllowed || after.pools !== 0n) {
    throw new Error('factory_allowlist_postcondition_failed')
  }
  console.log(
    JSON.stringify(
      {
        executed: true,
        transactionHash: hash,
        blockNumber: receipt.blockNumber.toString(),
        after: { ...after, pools: after.pools.toString() },
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
