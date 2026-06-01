import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getAddress, getContractAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

/** Anvil/Hardhat default account #0 — used for fork-only contract deploys. */
export const ANVIL_DEFAULT_DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const

export function isForgeCreateCollisionError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('createcollision') || normalized.includes('create collision')
}

function combineProcessOutput(result: { stdout?: string | Buffer | null; stderr?: string | Buffer | null }): string {
  const stdout = typeof result.stdout === 'string' ? result.stdout : result.stdout?.toString() ?? ''
  const stderr = typeof result.stderr === 'string' ? result.stderr : result.stderr?.toString() ?? ''
  return `${stdout}\n${stderr}`.trim()
}

function parseDeployedAddress(output: string): Address | null {
  const match = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/i)
  return match?.[1] ? getAddress(match[1] as Address) : null
}

/** @internal test helper */
export const parseDeployedAddressForTest = parseDeployedAddress

function runForgeCreate(params: {
  rpcUrl: string
  privateKey: Hex
  contractPath: string
  constructorArgs: readonly string[]
  repoRoot?: string
}): Address {
  const args = [
    'create',
    params.contractPath,
    '--rpc-url',
    params.rpcUrl,
    '--private-key',
    params.privateKey,
    '--legacy',
    '--broadcast',
    '--constructor-args',
    ...params.constructorArgs,
  ]
  const result = spawnSync('forge', args, {
    cwd: params.repoRoot ?? REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  const output = combineProcessOutput(result)
  if (result.status !== 0) {
    throw new Error(output.length > 0 ? output : `forge create exited with code ${result.status ?? 'unknown'}`)
  }
  const deployed = parseDeployedAddress(output)
  if (!deployed) {
    if (output.toLowerCase().includes('add --broadcast')) {
      throw new Error(
        'forge create simulated without broadcasting. This is an internal deploy helper misconfiguration.',
      )
    }
    throw new Error(`forge create did not report Deployed to address. Output tail:\n${output.slice(-2000)}`)
  }
  return deployed
}

function bumpDeployerNonce(params: { rpcUrl: string; privateKey: Hex; repoRoot?: string }): void {
  const deployer = privateKeyToAccount(params.privateKey).address
  const result = spawnSync(
    'cast',
    ['send', deployer, '--value', '0', '--rpc-url', params.rpcUrl, '--private-key', params.privateKey, '--legacy'],
    {
      cwd: params.repoRoot ?? REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    },
  )
  if (result.status !== 0) {
    const output = combineProcessOutput(result)
    throw new Error(output.length > 0 ? output : `cast send nonce bump failed with code ${result.status ?? 'unknown'}`)
  }
}

export async function findPredictedCreateAddress(params: {
  publicClient: { getTransactionCount: (args: { address: Address }) => Promise<number> }
  deployerPrivateKey: Hex
}): Promise<Address> {
  const deployer = privateKeyToAccount(params.deployerPrivateKey).address
  const nonce = BigInt(await params.publicClient.getTransactionCount({ address: deployer }))
  return getContractAddress({ from: deployer, nonce })
}

export async function scanDeployerCreateAddresses(params: {
  publicClient: {
    getTransactionCount: (args: { address: Address }) => Promise<number>
    getBytecode: (args: { address: Address }) => Promise<Hex | undefined>
  }
  deployerPrivateKey: Hex
  maxNonces?: number
}): Promise<Address[]> {
  const deployer = privateKeyToAccount(params.deployerPrivateKey).address
  const txCount = await params.publicClient.getTransactionCount({ address: deployer })
  const maxNonces = params.maxNonces ?? 64
  const upper = Math.min(Math.max(txCount, 1) + 32, maxNonces)
  const deployed: Address[] = []
  for (let nonce = 0; nonce < upper; nonce += 1) {
    const candidate = getContractAddress({ from: deployer, nonce: BigInt(nonce) })
    const bytecode = await params.publicClient.getBytecode({ address: candidate })
    if (bytecode && bytecode !== '0x') {
      deployed.push(candidate)
    }
  }
  return deployed
}

export function deployContractViaForgeCreate(params: {
  rpcUrl: string
  privateKey?: Hex
  contractPath: string
  constructorArgs: readonly string[]
  contractLabel: string
  repoRoot?: string
  maxCollisionAttempts?: number
}): Address {
  const privateKey = params.privateKey ?? ANVIL_DEFAULT_DEPLOYER_PRIVATE_KEY
  const maxAttempts = params.maxCollisionAttempts ?? 8
  let lastError = 'unknown forge create failure'

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return runForgeCreate({
        rpcUrl: params.rpcUrl,
        privateKey,
        contractPath: params.contractPath,
        constructorArgs: params.constructorArgs,
        repoRoot: params.repoRoot,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? 'forge create failed')
      lastError = message
      if (!isForgeCreateCollisionError(message) || attempt >= maxAttempts - 1) {
        throw new Error(
          message.includes('forge create')
            ? message
            : `forge create ${params.contractLabel} failed:\n${message.slice(-4000)}`,
        )
      }
      bumpDeployerNonce({ rpcUrl: params.rpcUrl, privateKey, repoRoot: params.repoRoot })
    }
  }

  throw new Error(`forge create ${params.contractLabel} failed after ${maxAttempts} attempts:\n${lastError.slice(-4000)}`)
}
