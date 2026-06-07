#!/usr/bin/env tsx
/**
 * Trace predicted vs on-chain wrapper for AKITA redeploy debugging.
 * Usage: pnpm -C frontend exec tsx scripts/ops/trace-wrapper-address.ts --wrapper 0x92e3...
 */
import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  getCreate2Address,
  http,
  isAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'
import { AKITA_DEFAULTS, SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'

declare const process: { argv: string[]; env: Record<string, string | undefined>; exit: (n?: number) => never; stdout: { write: (s: string) => void } }

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return next.trim()
}

function deriveBaseSalt(creatorToken: Address, owner: Address, chainId: number, version: string): Hex {
  return keccak256(
    encodePacked(['address', 'address', 'uint256', 'string'], [
      creatorToken,
      owner,
      BigInt(chainId),
      `4626:deploy:${version}`,
    ]),
  )
}

function saltFor(baseSalt: Hex, label: string): Hex {
  return keccak256(encodePacked(['bytes32', 'string'], [baseSalt, label]))
}

function predict(create2Deployer: Address, salt: Hex, initCode: Hex): Address {
  return getCreate2Address({ from: create2Deployer, salt, bytecode: initCode })
}

const BATCHER_ABI = [
  { type: 'function', name: 'create2Deployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'phase1SplitStates',
    stateMutability: 'view',
    inputs: [{ name: 'baseSalt', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'coreStarted', type: 'bool' },
          { name: 'coreDone', type: 'bool' },
          { name: 'shareStarted', type: 'bool' },
          { name: 'shareDone', type: 'bool' },
        ],
      },
    ],
  },
] as const

async function main(): Promise<void> {
  const wrapperRaw = getArg('--wrapper', '0x92e3345382595Ec033708F1c8Ff8e8151f25f89B')
  if (!isAddress(wrapperRaw)) {
    process.stdout.write('Invalid --wrapper\n')
    process.exit(1)
  }
  const TARGET = getAddress(wrapperRaw)
  const CREATOR = getAddress(AKITA_DEFAULTS.token as Address)
  const BATCHER = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const ownerArg = getArg('--owner')
  const versionArg = getArg('--version')

  const rpc =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.VITE_BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'

  const client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 30_000 }) })
  const create2Deployer = (await client.readContract({
    address: BATCHER,
    abi: BATCHER_ABI,
    functionName: 'create2Deployer',
  })) as Address

  const targetCode = await client.getBytecode({ address: TARGET })
  process.stdout.write(`\nTarget wrapper: ${TARGET}\n`)
  process.stdout.write(`Bytecode: ${targetCode && targetCode !== '0x' ? `${(targetCode.length - 2) / 2} bytes` : 'NONE (counterfactual)'}\n`)
  process.stdout.write(`Batcher: ${BATCHER}\n`)
  process.stdout.write(`create2Deployer: ${create2Deployer}\n\n`)

  const owners = ownerArg && isAddress(ownerArg)
    ? [getAddress(ownerArg)]
    : [
        getAddress('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'),
        getAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5'),
      ]

  const versions = versionArg
    ? [versionArg]
    : ['v1.13.0', 'v1.12.1', 'v1.12.0', 'v1.2.3x', 'v1.2.3x-akita-redeploy', 'v1.7.1-dryrun']

  const vaultNames = ['AKITA Vault', 'Akita Vault', 'akita vault', '4626 AKITA Vault', 'AKITA', 'akita']
  const vaultSymbols = ['vAKITA', 'VAKITA', 'akita', 'AKITA', 'vakita']

  let hits = 0
  for (const owner of owners) {
    for (const version of versions) {
      const baseSalt = deriveBaseSalt(CREATOR, owner, 8453, version)
      const vaultSalt = saltFor(baseSalt, 'vault')
      const wrapperSalt = saltFor(baseSalt, 'wrapper')

      for (const vaultName of vaultNames) {
        for (const vaultSymbol of vaultSymbols) {
          const vaultArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
            CREATOR,
            BATCHER,
            vaultName,
            vaultSymbol,
          ])
          const vaultInit = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultArgs])
          const vault = predict(create2Deployer, vaultSalt, vaultInit)
          const wrapperArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [
            CREATOR,
            vault,
            BATCHER,
          ])
          const wrapperInit = concatHex([DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex, wrapperArgs])
          const wrapper = predict(create2Deployer, wrapperSalt, wrapperInit)
          if (wrapper.toLowerCase() !== TARGET.toLowerCase()) continue

          hits++
          process.stdout.write('=== PREDICTION MATCH ===\n')
          process.stdout.write(JSON.stringify({ owner, version, vaultName, vaultSymbol, baseSalt, vault, wrapper }, null, 2))
          process.stdout.write('\n')

          const vaultCode = await client.getBytecode({ address: vault })
          process.stdout.write(`vault ${vault} deployed: ${Boolean(vaultCode && vaultCode !== '0x')}\n`)

          try {
            const state = await client.readContract({
              address: BATCHER,
              abi: BATCHER_ABI,
              functionName: 'phase1SplitStates',
              args: [baseSalt],
            })
            process.stdout.write(`phase1SplitStates: ${JSON.stringify(state, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}\n`)
          } catch (e) {
            process.stdout.write(`phase1SplitStates read failed: ${e instanceof Error ? e.message : String(e)}\n`)
          }
        }
      }
    }
  }

  if (hits === 0) {
    process.stdout.write('No CREATE2 prediction match in scanned owner/version/name grid.\n')
    process.stdout.write('Pass --owner <CSW> and --version from deploy UI URL (?deploymentVersion=…).\n')
  }

  process.stdout.write(`\nDone (${hits} prediction match(es)).\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
