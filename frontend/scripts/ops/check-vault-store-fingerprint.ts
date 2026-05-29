#!/usr/bin/env node
import { createPublicClient, http, keccak256, type Hex } from 'viem'
import { base } from 'viem/chains'

import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'

const STORE = '0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4' as const
const STORE_ABI = [
  {
    type: 'function',
    name: 'chunkCount',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'chunk',
    stateMutability: 'view',
    inputs: [
      { name: 'codeId', type: 'bytes32' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes' }],
  },
] as const

const V2 = '7a6188099910b3b4cfa6f24f38be69b82af519e6df485cea5a3fbf7b8c2979cd'
const CURRENT = '5eb708a9ab88376b85bd5f223156970408271564850a004f54260f9145400e64'

async function main() {
  const rpc =
    process.env.BASE_RPC_URL?.replace('wss://', 'https://').replace('/ws/', '/rpc/') ??
    'https://mainnet.base.org'
  const client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 60_000 }) })
  const codeId = keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex)
  const count = Number(
    await client.readContract({ address: STORE, abi: STORE_ABI, functionName: 'chunkCount', args: [codeId] }),
  )
  let hex = '0x'
  for (let i = 0; i < count; i++) {
    const chunk = (await client.readContract({
      address: STORE,
      abi: STORE_ABI,
      functionName: 'chunk',
      args: [codeId, BigInt(i)],
    })) as Hex
    hex += chunk.slice(2)
  }
  const lower = hex.toLowerCase()
  process.stdout.write(
    JSON.stringify(
      {
        codeId,
        storeBytes: (hex.length - 2) / 2,
        localBytes: (DEPLOY_BYTECODE.CreatorOVault.length - 2) / 2,
        storeHasV2: lower.includes(V2),
        storeHasCurrent: lower.includes(CURRENT),
        localHasV2: DEPLOY_BYTECODE.CreatorOVault.toLowerCase().includes(V2),
        localHasCurrent: DEPLOY_BYTECODE.CreatorOVault.toLowerCase().includes(CURRENT),
        localHashMatchesCodeId: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex) === codeId,
      },
      null,
      2,
    ) + '\n',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
