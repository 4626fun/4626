import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPublicClient, decodeFunctionResult, encodeFunctionData, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'
import { isDeprecatedCreatorVaultBatcherAddress } from '../src/config/contracts.defaults.js'
import { deploymentBatcherNotConfiguredMessage } from '../src/lib/deploy/deploymentBatcherConfigError.js'

const DEFAULT_SOURCE_BATCHER = '0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8' as Address
// Anvil account #0. Local-only default used to deploy the replacement batcher onto the fork.
const DEFAULT_ANVIL_DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')

const rpcUrl = (process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC ?? 'http://127.0.0.1:8545').trim()
const sourceBatcherRaw = (
  process.env.DEPLOY_DRY_RUN_SOURCE_BATCHER ??
  process.env.CREATOR_VAULT_BATCHER ??
  process.env.VITE_CREATOR_VAULT_BATCHER ??
  DEFAULT_SOURCE_BATCHER
).trim()
const deployerPrivateKey = (process.env.DEPLOY_DRY_RUN_DEPLOYER_PRIVATE_KEY ?? DEFAULT_ANVIL_DEPLOYER_PRIVATE_KEY).trim()

if (!isAddress(sourceBatcherRaw)) {
  throw new Error(`Invalid DEPLOY_DRY_RUN_SOURCE_BATCHER: ${sourceBatcherRaw || '(empty)'}`)
}
if (isDeprecatedCreatorVaultBatcherAddress(sourceBatcherRaw)) {
  throw new Error(
    `DEPLOY_DRY_RUN_SOURCE_BATCHER is a deprecated alias. ${deploymentBatcherNotConfiguredMessage(sourceBatcherRaw)}`,
  )
}
if (!/^0x[a-fA-F0-9]{64}$/.test(deployerPrivateKey)) {
  throw new Error('DEPLOY_DRY_RUN_DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key.')
}

const sourceBatcher = getAddress(sourceBatcherRaw) as Address
const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl, { timeout: 12_000 }),
})

function addressGetterAbi(name: string) {
  return [
    {
      type: 'function',
      name,
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'address' }],
    },
  ] as const
}

async function readAddressGetter(name: string): Promise<Address> {
  const abi = addressGetterAbi(name)
  const data = encodeFunctionData({ abi, functionName: name as never })
  const result = await publicClient.call({
    to: sourceBatcher,
    data,
  })
  const value = decodeFunctionResult({
    abi,
    functionName: name as never,
    data: result.data,
  }) as Address
  return getAddress(value) as Address
}

function runForgeCreate(constructorArgs: readonly string[]): Address {
  const forgeArgs = [
    'create',
    'contracts/helpers/batchers/DeploymentBatcher.sol:DeploymentBatcher',
    '--rpc-url',
    rpcUrl,
    '--private-key',
    deployerPrivateKey,
    '--broadcast',
    '--constructor-args',
    ...constructorArgs,
  ]

  try {
    const stdout = execFileSync('forge', forgeArgs, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        FOUNDRY_DISABLE_NIGHTLY_WARNING: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const match = stdout.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/i)
    if (!match) {
      throw new Error(`Could not parse deployed address from forge output:\n${stdout}`)
    }
    return getAddress(match[1] as Address) as Address
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdout = String((error as { stdout?: string | Buffer }).stdout ?? '')
      const stderr = String((error as { stderr?: string | Buffer }).stderr ?? '')
      throw new Error(`forge create failed.\n${stdout}\n${stderr}`.trim())
    }
    throw error
  }
}

async function main() {
  const constructorGetterNames = [
    'registry',
    'bytecodeStore',
    'create2Deployer',
    'protocolTreasury',
    'poolManager',
    'taxHook',
    'chainlinkEthUsd',
    'vaultActivationBatcher',
    'lotteryManager',
    'permit2',
    'usdc',
    'uniswapV3Factory',
    'uniswapRouter',
    'ajnaFactory',
    'vaultCoreModule',
    'vaultStrategiesModule',
    'vaultAdminModule',
  ] as const

  const constructorArgs = await Promise.all(constructorGetterNames.map((name) => readAddressGetter(name)))
  const deployedBatcher = runForgeCreate([
    ...constructorArgs,
    '0x0000000000000000000000000000000000000000',
  ])
  process.stdout.write(deployedBatcher)
}

await main()
