#!/usr/bin/env node
/**
 * Mirror DeployVault bytecodeInfraQuery against live batcher + store.
 */
import { createPublicClient, http, isAddress, keccak256, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import { BASE_DEFAULTS } from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'

const BATCHER = BASE_DEFAULTS.creatorVaultBatcher as Address
const ZERO = '0x0000000000000000000000000000000000000000' as Address

const BATCHER_ABI = [
  { name: 'bytecodeStore', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'create2Deployer', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const POINTERS_ABI = [
  {
    name: 'pointers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const

const CHUNK_ABI = [
  {
    name: 'chunkCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const deployCodeIds = {
  vault: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex),
  wrapper: keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex),
  shareOFT: keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex),
  gauge: keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex),
  cca: keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex),
  oracle: keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex),
  oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
  payoutRouter: keccak256(DEPLOY_BYTECODE.PayoutRouter as Hex),
  vaultShareBurnStream: keccak256(DEPLOY_BYTECODE.VaultShareBurnStream as Hex),
  creatorCoinPolicyController: keccak256(DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex),
  creatorCharmStrategy: keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex),
  ajnaVaultAuth: keccak256(DEPLOY_BYTECODE.AjnaVaultAuth as Hex),
  ajnaVault: keccak256(DEPLOY_BYTECODE.AjnaERC4626Vault as Hex),
  erc4626StrategyAdapter: keccak256(DEPLOY_BYTECODE.ERC4626StrategyAdapter as Hex),
  solanaStrategy: keccak256(DEPLOY_BYTECODE.SolanaStrategy as Hex),
} as const

const codeEntries = [
  { label: 'OFTBootstrapRegistry', codeId: deployCodeIds.oftBootstrap },
  { label: 'CreatorShareOFT', codeId: deployCodeIds.shareOFT },
  { label: 'CreatorOVault', codeId: deployCodeIds.vault },
  { label: 'CreatorOVaultWrapper', codeId: deployCodeIds.wrapper },
  { label: 'CreatorGaugeController', codeId: deployCodeIds.gauge },
  { label: 'CCALaunchStrategy', codeId: deployCodeIds.cca },
  { label: 'CreatorOracle', codeId: deployCodeIds.oracle },
  { label: 'VaultShareBurnStream', codeId: deployCodeIds.vaultShareBurnStream },
  { label: 'PayoutRouter', codeId: deployCodeIds.payoutRouter },
  { label: 'CreatorCoinPolicyController', codeId: deployCodeIds.creatorCoinPolicyController },
  { label: 'CreatorCharmStrategy', codeId: deployCodeIds.creatorCharmStrategy },
  { label: 'AjnaVaultAuth', codeId: deployCodeIds.ajnaVaultAuth },
  { label: 'AjnaERC4626Vault', codeId: deployCodeIds.ajnaVault },
  { label: 'ERC4626StrategyAdapter', codeId: deployCodeIds.erc4626StrategyAdapter },
  { label: 'SolanaStrategy', codeId: deployCodeIds.solanaStrategy },
] as const

async function run(rpc: string): Promise<void> {
  const client = createPublicClient({ chain: base, transport: http(rpc) })
  const bytecodeStore = (await client.readContract({
    address: BATCHER,
    abi: BATCHER_ABI,
    functionName: 'bytecodeStore',
  })) as Address

  let storeSupportsChunking = false
  try {
    await client.readContract({
      address: bytecodeStore,
      abi: CHUNK_ABI,
      functionName: 'chunkCount',
      args: [deployCodeIds.vault],
    })
    storeSupportsChunking = true
  } catch {
    storeSupportsChunking = false
  }

  const pointerResults = await client.multicall({
    allowFailure: true,
    contracts: codeEntries.map((c) => ({
      address: bytecodeStore,
      abi: POINTERS_ABI,
      functionName: 'pointers',
      args: [c.codeId],
    })),
  })

  const missing: string[] = []
  for (let i = 0; i < codeEntries.length; i++) {
    const entry = codeEntries[i]!
    const r = pointerResults[i]!
    const pointer = r.status === 'success' ? (r.result as Address) : ZERO
    const ok = r.status === 'success' && pointer !== ZERO
    if (!ok) missing.push(entry.label)
    console.log(
      `[${rpc.includes('matrixed') ? 'paid' : 'public'}] ${entry.label}: status=${r.status} pointer=${pointer} codeId=${entry.codeId.slice(0, 12)}…`,
    )
  }

  console.log(
    `[${rpc.includes('matrixed') ? 'paid' : 'public'}] store=${bytecodeStore} chunking=${storeSupportsChunking} missing=${missing.join(', ') || '(none)'}`,
  )
}

async function main(): Promise<void> {
  console.log('vault codeId', deployCodeIds.vault)
  await run(process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org')
  await run('https://eu.endpoints.matrixed.link/rpc/base?auth=p886of4gitu82')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
