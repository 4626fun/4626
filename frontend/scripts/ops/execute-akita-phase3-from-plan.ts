#!/usr/bin/env tsx
/**
 * Execute Phase-3 (+ optional Phase-4) calls from an Akita continuation plan
 * via the operator CSW + Privy UserOps.
 *
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/execute-akita-phase3-from-plan.ts \
 *     --plan artifacts/akita-phase2-continue-20260727.json \
 *     [--include-phase4] [--start-index 0] [--stop-index 15]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  createPublicClient,
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
  phase3Calls?: PlanCall[]
  phase4Calls?: PlanCall[]
  solanaOvault?: { shareMeshMint?: string }
}

function getArg(name: string): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return ''
  return v
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
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

async function main() {
  const planPath = resolve(
    process.cwd(),
    getArg('--plan') || 'artifacts/akita-phase2-continue-20260727.json',
  )
  const includePhase4 = hasFlag('--include-phase4')
  const startIndex = Number(getArg('--start-index') || '0')
  const stopIndexRaw = getArg('--stop-index')
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan
  const phase3 = plan.phase3Calls ?? []
  const phase4 = includePhase4 ? (plan.phase4Calls ?? []) : []
  if (phase3.length === 0 && phase4.length === 0) {
    throw new Error(`No phase3/phase4 calls in ${planPath}`)
  }

  const smartWalletRaw = readCanonicalCswAddressEnv() || plan.smartWallet || plan.ownerAddress
  const walletId = readCanonicalCswPrivyWalletIdEnv()
  if (!smartWalletRaw || !isAddress(smartWalletRaw)) throw new Error('CANONICAL_CSW_ADDRESS missing')
  if (!walletId) throw new Error('CANONICAL_CSW_PRIVY_WALLET_ID missing')
  const smartWallet = getAddress(smartWalletRaw)

  const rpc =
    process.env.BASE_RPC_URL?.replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:')
      .replace('/ws/', '/rpc/') || 'https://mainnet.base.org'
  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
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
  const bundlerUrl = readBundlerUrl()

  const stopIndex = stopIndexRaw ? Number(stopIndexRaw) : phase3.length - 1
  const selectedPhase3 = phase3.slice(startIndex, stopIndex + 1)
  console.log(
    JSON.stringify(
      {
        planPath,
        version: plan.version,
        smartWallet,
        ownerAddress: ownerContext.ownerAddress,
        ownerIndex: ownerContext.ownerIndex,
        phase3Selected: `${startIndex}..${stopIndex} (${selectedPhase3.length})`,
        phase4: phase4.length,
      },
      null,
      2,
    ),
  )

  const txs: string[] = []
  const failed: Array<{ label: string; error: string }> = []

  const skipPreflight = hasFlag('--skip-preflight')
  const noSimulate = hasFlag('--no-simulate')
  const preflightGas = BigInt(getArg('--preflight-gas') || '15000000')

  const sendOne = async (label: string, call: PlanCall) => {
    const to = getAddress(call.to)
    const data = call.data as Hex
    const value = BigInt(call.value ?? '0')
    console.log(`sending ${label} to=${to} value=${value.toString()} selector=${data.slice(0, 10)}`)
    if (!skipPreflight) {
      try {
        // Phase3 strategy fan-out needs ~12M gas; default eth_call gas can OOG mid-CREATE2.
        await publicClient.call({ account: smartWallet, to, data, value, gas: preflightGas })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`${label}_preflight_failed`, msg.slice(0, 300))
        failed.push({ label, error: `preflight: ${msg.slice(0, 200)}` })
        return false
      }
    }
    try {
      const result = await sendPrivyCoinbaseSmartWalletUserOperation({
        publicClient,
        bundlerUrl,
        walletId,
        smartWallet,
        ownerAddress: ownerContext.ownerAddress,
        ownerIndex: ownerContext.ownerIndex,
        calls: [{ to, data, value }],
        // Large CREATE2 fan-outs can fail the helper's gasless eth_call simulate.
        simulate: !noSimulate,
      })
      console.log(label, result)
      txs.push(result.txHash)
      return true
    } catch (error) {
      const err = error as Error & { causeMessage?: string; cause?: Error }
      const msg = err.causeMessage || err.message || String(error)
      console.error(`${label}_failed`, msg.slice(0, 400))
      if (err.cause) console.error('cause=', (err.cause as Error).message?.slice(0, 400))
      failed.push({ label, error: msg.slice(0, 240) })
      return false
    }
  }

  for (const [i, call] of selectedPhase3.entries()) {
    const ok = await sendOne(`phase3_${startIndex + i}`, call)
    if (!ok && hasFlag('--stop-on-error')) break
  }
  for (const [i, call] of phase4.entries()) {
    const ok = await sendOne(`phase4_${i}`, call)
    if (!ok && hasFlag('--stop-on-error')) break
  }

  const statePath = resolve(process.cwd(), 'scripts/ops/.akita-redeploy-state/post-phase3.json')
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        phase: 'post-phase3',
        recordedAt: new Date().toISOString(),
        version: plan.version,
        creatorToken: plan.creatorToken,
        shareMeshMint: plan.solanaOvault?.shareMeshMint ?? null,
        txs,
        failed,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`state_written=${statePath}`)
  console.log(JSON.stringify({ ok: failed.length === 0, txs: txs.length, failed }, null, 2))
  if (failed.length > 0) process.exit(1)
  console.log('PHASE3_OK')
}

main().catch((error) => {
  const err = error as Error & { causeMessage?: string; cause?: unknown }
  console.error(err?.message ?? error)
  if (err?.causeMessage) console.error('causeMessage=', err.causeMessage)
  if (err?.cause) console.error('cause=', err.cause)
  process.exit(1)
})
