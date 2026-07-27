#!/usr/bin/env tsx
/**
 * Execute a Phase-1-only Akita deploy plan from the operator CSW via Privy UserOps.
 *
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/execute-akita-phase1-from-plan.ts \
 *     --plan artifacts/akita-phase1-plan-20260727.json
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from '../../server/_lib/wallet/canonicalCswEnv.js'
import {
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from '../../server/_lib/wallet/privyCoinbaseSmartWallet.js'

type PlanCall = { to: string; value?: string; data: string }
type Plan = {
  smartWallet?: string
  ownerAddress?: string
  creatorToken?: string
  version?: string
  phase1Calls?: PlanCall[]
  vanity?: { expectedAddresses?: Record<string, string> }
}

function getArg(name: string): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return ''
  return v
}

function readBundlerUrl(): string {
  for (const candidate of [
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT,
  ]) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  throw new Error('Bundler URL missing (CDP_PAYMASTER_URL).')
}

const erc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const

async function main() {
  const planPath = resolve(process.cwd(), getArg('--plan') || 'artifacts/akita-phase1-plan-20260727.json')
  const expectedPath = resolve(
    process.cwd(),
    getArg('--expected') || 'artifacts/akita-phase1-expected-20260727.json',
  )
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan
  const expectedFromFile = JSON.parse(readFileSync(expectedPath, 'utf8')) as Record<string, string>
  const calls = plan.phase1Calls ?? []
  if (calls.length === 0) throw new Error(`No phase1Calls in ${planPath}`)

  const smartWalletRaw = readCanonicalCswAddressEnv() || plan.smartWallet || plan.ownerAddress
  const walletId = readCanonicalCswPrivyWalletIdEnv()
  if (!smartWalletRaw || !isAddress(smartWalletRaw)) throw new Error('CANONICAL_CSW_ADDRESS missing')
  if (!walletId) throw new Error('CANONICAL_CSW_PRIVY_WALLET_ID missing')

  const smartWallet = getAddress(smartWalletRaw)
  const publicClient = createPublicClient({
    chain: base,
    transport: http(
      process.env.BASE_RPC_URL?.replace(/^wss:/, 'https:')
        .replace(/^ws:/, 'http:')
        .replace('/ws/', '/rpc/') || 'https://mainnet.base.org',
    ),
  })

  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv()
  const configuredOwnerIndex = ownerIndexRaw ? Number(ownerIndexRaw) : Number.NaN
  const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
    publicClient,
    walletId,
    smartWallet,
    expectedOwnerAddress: null,
    configuredOwnerIndex: Number.isFinite(configuredOwnerIndex) ? configuredOwnerIndex : null,
    allowConfiguredOwnerIndexFallback: true,
    maxScan: 512,
  })

  const expected = {
    ...(plan.vanity?.expectedAddresses ?? {}),
    ...expectedFromFile,
  }
  delete expected.version
  console.log(
    JSON.stringify(
      {
        planPath,
        expectedPath,
        version: plan.version || expectedFromFile.version,
        smartWallet,
        ownerAddress: ownerContext.ownerAddress,
        ownerIndex: ownerContext.ownerIndex,
        phase1Calls: calls.length,
        expectedAddresses: expected,
      },
      null,
      2,
    ),
  )

  // Ensure batcher allowance for creator token if Phase 1 pulls deposit.
  const creatorToken = plan.creatorToken && isAddress(plan.creatorToken) ? getAddress(plan.creatorToken) : null
  const batcher = getAddress(calls[0]!.to)
  if (creatorToken) {
    const allowance = await publicClient.readContract({
      address: creatorToken,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [smartWallet, batcher],
    })
    const need = 50_000_000n * 10n ** 18n
    if (allowance < need) {
      console.log(`approving batcher for ${need.toString()} creator tokens (current=${allowance.toString()})`)
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [batcher, need],
      })
      const approveResult = await sendPrivyCoinbaseSmartWalletUserOperation({
        publicClient,
        bundlerUrl: readBundlerUrl(),
        walletId,
        smartWallet,
        ownerAddress: ownerContext.ownerAddress,
        ownerIndex: ownerContext.ownerIndex,
        calls: [{ to: creatorToken, data: approveData, value: 0n }],
        simulate: true,
      })
      console.log('approve_userOp', approveResult)
    } else {
      console.log(`allowance_ok=${allowance.toString()}`)
    }
  }

  for (const [i, call] of calls.entries()) {
    const to = getAddress(call.to)
    const data = call.data as Hex
    const value = BigInt(call.value ?? '0')
    console.log(`sending phase1 call ${i + 1}/${calls.length} to=${to} selector=${data.slice(0, 10)}`)
    const result = await sendPrivyCoinbaseSmartWalletUserOperation({
      publicClient,
      bundlerUrl: readBundlerUrl(),
      walletId,
      smartWallet,
      ownerAddress: ownerContext.ownerAddress,
      ownerIndex: ownerContext.ownerIndex,
      calls: [{ to, data, value }],
      simulate: true,
    })
    console.log(`phase1_call_${i + 1}`, result)

    // Wait for expected CREATE2 contracts after finalize call.
    if (i === calls.length - 1 && expected.shareOFT && isAddress(expected.shareOFT)) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const code = await publicClient.getBytecode({ address: getAddress(expected.shareOFT) })
        if (code && code !== '0x') {
          console.log(`shareOFT_deployed=${expected.shareOFT}`)
          break
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  const checks: Record<string, string> = {}
  for (const [label, addr] of Object.entries(expected)) {
    if (!addr || !isAddress(addr)) continue
    const code = await publicClient.getBytecode({ address: getAddress(addr) })
    checks[label] = code && code !== '0x' ? getAddress(addr) : 'MISSING'
  }
  console.log(JSON.stringify({ deployed: checks }, null, 2))

  // Phase-1-only deploys vault/wrapper/ShareOFT. Gauge/CCA/oracle land in later phases.
  const required = ['vault', 'wrapper', 'shareOFT'] as const
  const missing = required.filter((label) => !checks[label] || checks[label] === 'MISSING')
  if (missing.length > 0) {
    throw new Error(`Phase 1 incomplete; missing: ${missing.join(',')}`)
  }
  console.log('PHASE1_OK')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
