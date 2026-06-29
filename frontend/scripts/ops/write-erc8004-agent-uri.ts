import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { createPublicClient, encodeFunctionData, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

import { buildAgentRegistrationDataUri } from '../../server/_lib/agent/agentRegistration.js'
import { IDENTITY_REGISTRY_ABI } from '../../server/_lib/agent/erc8004.js'
import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from '../../server/_lib/wallet/canonicalCswEnv.js'
import {
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from '../../server/_lib/wallet/privyCoinbaseSmartWallet.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(scriptDir, '../..')
const origin = (process.env.ERC8004_PUBLIC_ORIGIN || 'https://4626.fun').replace(/\/+$/, '')
const agentId = Number(process.env.ERC8004_AGENT_ID || '2205')
const registry = (process.env.ERC8004_AGENT_REGISTRY || '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432').trim()
const rpcCandidates = [
  (process.env.BASE_RPC_URL || '').trim(),
  'https://mainnet.base.org',
].filter(Boolean)

function createBasePublicClient() {
  let lastError: unknown
  for (const rpcUrl of rpcCandidates) {
    try {
      return createPublicClient({ chain: base, transport: http(rpcUrl) })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No usable Base RPC URL configured.')
}
const privateKey = (process.env.PRIVATE_KEY || '').trim()
const dryRun = process.argv.includes('--dry-run')
const submitCsw = process.argv.includes('--submit-csw')
const submitEoa = process.argv.includes('--submit-eoa')

function readBundlerUrl(): string | null {
  const candidates = [
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT,
    process.env.KPR_ERC4337_BUNDLER_URL,
    process.env.PAYMASTER_URL,
    process.env.BUNDLER_URL,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  return null
}

function readExpectedOwnerAddress(): Address | null {
  const candidates = [
    process.env.CANONICAL_CSW_OWNER_ADDRESS,
    process.env.KPR_ERC4337_OWNER,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
      return getAddress(value) as Address
    }
  }
  return null
}

async function writeDataUriFile(dataUri: string) {
  const outDir = path.join(frontendRoot, '.tmp')
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, 'erc8004-agent-2205-data-uri.txt')
  await fs.writeFile(outPath, `${dataUri}\n`)
  return outPath
}

async function submitViaCanonicalCsw(dataUri: string): Promise<void> {
  const smartWalletRaw = readCanonicalCswAddressEnv()
  const walletId = readCanonicalCswPrivyWalletIdEnv()
  const bundlerUrl = readBundlerUrl()
  const expectedOwnerAddress = readExpectedOwnerAddress()
  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv()
  const configuredOwnerIndex = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN

  if (!smartWalletRaw || !/^0x[a-fA-F0-9]{40}$/.test(smartWalletRaw)) {
    throw new Error('CANONICAL_CSW_ADDRESS missing or invalid for --submit-csw.')
  }
  if (!walletId) {
    throw new Error('CANONICAL_CSW_PRIVY_WALLET_ID missing for --submit-csw.')
  }
  if (!bundlerUrl) {
    throw new Error('Bundler URL missing (set CDP_PAYMASTER_URL or BUNDLER_URL).')
  }

  const smartWallet = getAddress(smartWalletRaw) as Address
  const registryAddress = getAddress(registry) as Address
  const publicClient = createBasePublicClient()
  const callData = encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'setAgentURI',
    args: [BigInt(agentId), dataUri],
  })

  const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
    publicClient,
    walletId,
    smartWallet,
    expectedOwnerAddress,
    configuredOwnerIndex: Number.isFinite(configuredOwnerIndex) ? configuredOwnerIndex : null,
    allowConfiguredOwnerIndexFallback: true,
    maxScan: 512,
  })

  console.log('[erc8004-write-uri] submitting setAgentURI via canonical CSW UserOp')
  console.log(`smartWallet=${smartWallet}`)
  console.log(`owner=${ownerContext.ownerAddress}`)
  console.log(`ownerIndex=${ownerContext.ownerIndex}`)

  const result = await sendPrivyCoinbaseSmartWalletUserOperation({
    publicClient,
    bundlerUrl,
    walletId,
    smartWallet,
    ownerAddress: ownerContext.ownerAddress,
    ownerIndex: ownerContext.ownerIndex,
    calls: [{ to: registryAddress, data: callData }],
    simulate: false,
  })

  console.log(`userOpHash=${result.userOpHash}`)
  console.log(`txHash=${result.txHash}`)
}

async function submitViaEoa(dataUri: string): Promise<void> {
  if (!privateKey) {
    throw new Error('PRIVATE_KEY missing for --submit-eoa.')
  }

  console.warn('[erc8004-write-uri] WARNING: agent #2205 owner is the canonical CSW, not an EOA.')
  console.warn('[erc8004-write-uri] Prefer --submit-csw unless you know the EOA can execute setAgentURI.')

  const args = [
    'send',
    registry,
    'setAgentURI(uint256,string)',
    String(agentId),
    dataUri,
    '--rpc-url',
    rpcCandidates[0] || 'https://mainnet.base.org',
    '--private-key',
    privateKey,
  ]
  const cast = spawnSync('cast', args, { stdio: 'inherit', encoding: 'utf8' })
  if (cast.status !== 0) {
    process.exit(typeof cast.status === 'number' ? cast.status : 1)
  }
}

async function main() {
  const result = buildAgentRegistrationDataUri(origin)
  if (!result.payload || !result.dataUri) {
    throw new Error(result.error || 'Failed to build agent registration payload.')
  }

  const registration = result.payload
  const dataUri = result.dataUri
  const outPath = await writeDataUriFile(dataUri)

  console.log('[erc8004-write-uri] canonical registration ready')
  console.log(`agentId=${agentId}`)
  console.log(`registry=${registry}`)
  console.log(`services=${Array.isArray(registration.services) ? registration.services.length : 0}`)
  console.log(`updatedAt=${registration.updatedAt ?? 'missing'}`)
  console.log(`x402Support=${registration.x402Support === true}`)
  console.log(`dataUriBytes=${Buffer.byteLength(dataUri, 'utf8')}`)
  console.log(`dataUriFile=${outPath}`)

  if (dryRun || (!submitCsw && !submitEoa)) {
    console.log('[erc8004-write-uri] no onchain submit requested.')
    console.log('[erc8004-write-uri] rerun with --submit-csw (recommended) or --submit-eoa after review.')
    return
  }

  if (submitCsw) {
    await submitViaCanonicalCsw(dataUri)
    return
  }

  await submitViaEoa(dataUri)
}

main().catch((error) => {
  console.error(`[erc8004-write-uri] failed: ${String(error instanceof Error ? error.message : error)}`)
  process.exit(1)
})
