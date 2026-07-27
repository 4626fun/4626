#!/usr/bin/env tsx
/**
 * Execute Phase-2 (core → pre-finalize → finalize) from an Akita continuation plan
 * via the operator CSW + Privy UserOps.
 *
 * Requires a plan built with `--reuse-deployed-version` against the live Phase-1 stack
 * so `phase1Calls` is empty and expected CREATE2 addresses match on-chain.
 *
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/execute-akita-phase2-from-plan.ts \
 *     --plan artifacts/akita-phase2-continue-20260727.json \
 *     --expected artifacts/akita-phase2-expected-20260727.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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
  phase1Calls?: PlanCall[]
  phase2CoreCalls?: PlanCall[]
  phase2PreFinalizeCalls?: PlanCall[]
  phase2FinalizeCalls?: PlanCall[]
  solanaOvault?: { shareMeshMint?: string; mode?: string }
}

type Through = 'core' | 'prefinalize' | 'finalize'

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

function parseThrough(raw: string): Through {
  const v = (raw || 'finalize').trim().toLowerCase()
  if (v === 'core' || v === 'prefinalize' || v === 'finalize') return v
  throw new Error(`Invalid --through ${raw}; use core|prefinalize|finalize`)
}

async function sendCalls(params: {
  label: string
  calls: PlanCall[]
  publicClient: ReturnType<typeof createPublicClient>
  bundlerUrl: string
  walletId: string
  smartWallet: Address
  ownerAddress: Address
  ownerIndex: number
}): Promise<Array<{ userOpHash: Hex; txHash: Hex }>> {
  const out: Array<{ userOpHash: Hex; txHash: Hex }> = []
  for (const [i, call] of params.calls.entries()) {
    const to = getAddress(call.to)
    const data = call.data as Hex
    const value = BigInt(call.value ?? '0')
    console.log(
      `sending ${params.label} ${i + 1}/${params.calls.length} to=${to} value=${value.toString()} selector=${data.slice(0, 10)}`,
    )
    const result = await sendPrivyCoinbaseSmartWalletUserOperation({
      publicClient: params.publicClient,
      bundlerUrl: params.bundlerUrl,
      walletId: params.walletId,
      smartWallet: params.smartWallet,
      ownerAddress: params.ownerAddress,
      ownerIndex: params.ownerIndex,
      calls: [{ to, data, value }],
      simulate: true,
    })
    console.log(`${params.label}_${i + 1}`, result)
    out.push({ userOpHash: result.userOpHash, txHash: result.txHash })
  }
  return out
}

async function waitForCode(
  publicClient: ReturnType<typeof createPublicClient>,
  address: Address,
  label: string,
  attempts = 40,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const code = await publicClient.getBytecode({ address })
    if (code && code !== '0x') {
      console.log(`${label}_deployed=${address}`)
      return true
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

async function main() {
  const planPath = resolve(
    process.cwd(),
    getArg('--plan') || 'artifacts/akita-phase2-continue-20260727.json',
  )
  const expectedPath = resolve(
    process.cwd(),
    getArg('--expected') || 'artifacts/akita-phase2-expected-20260727.json',
  )
  const through = parseThrough(getArg('--through'))
  // VaultAuxiliaryDeployBatcher requires vault.owner == params.owner (CSW),
  // but ownership only moves in finalizePhase2 — so finalize must precede aux.
  const finalizeBeforePrefinalize = hasFlag('--finalize-before-prefinalize')
  const skipCore = hasFlag('--skip-core')
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan
  const expectedFromFile = JSON.parse(readFileSync(expectedPath, 'utf8')) as Record<string, string>

  if ((plan.phase1Calls?.length ?? 0) > 0) {
    throw new Error(
      `Plan still has phase1Calls (${plan.phase1Calls!.length}). Rebuild with --reuse-deployed-version against the live stack.`,
    )
  }

  const coreCalls = skipCore ? [] : (plan.phase2CoreCalls ?? [])
  const preCalls = plan.phase2PreFinalizeCalls ?? []
  const finalizeCalls = plan.phase2FinalizeCalls ?? []
  if (coreCalls.length === 0 && preCalls.length === 0 && finalizeCalls.length === 0) {
    throw new Error(`No Phase-2 calls in ${planPath}`)
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
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpc),
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

  const expected = { ...expectedFromFile }
  delete expected.version

  const shareOft = expected.shareOFT && isAddress(expected.shareOFT) ? getAddress(expected.shareOFT) : null
  if (shareOft) {
    const code = await publicClient.getBytecode({ address: shareOft })
    if (!code || code === '0x') {
      throw new Error(`Live ShareOFT missing at ${shareOft}; refusing Phase 2`)
    }
  }

  const finalizeNative = finalizeCalls.reduce((acc, c) => acc + BigInt(c.value ?? '0'), 0n)
  const cswBalance = await publicClient.getBalance({ address: smartWallet })
  console.log(
    JSON.stringify(
      {
        planPath,
        expectedPath,
        through,
        skipCore,
        finalizeBeforePrefinalize,
        version: plan.version || expectedFromFile.version,
        smartWallet,
        ownerAddress: ownerContext.ownerAddress,
        ownerIndex: ownerContext.ownerIndex,
        counts: {
          phase2Core: coreCalls.length,
          phase2PreFinalize: preCalls.length,
          phase2Finalize: finalizeCalls.length,
        },
        finalizeNativeWei: finalizeNative.toString(),
        cswBalanceWei: cswBalance.toString(),
        expectedAddresses: expected,
      },
      null,
      2,
    ),
  )
  if (through === 'finalize' && finalizeNative > cswBalance) {
    throw new Error(
      `CSW balance ${cswBalance} < finalize native fee ${finalizeNative}; top up ETH on ${smartWallet}`,
    )
  }

  const bundlerUrl = readBundlerUrl()
  const txs: Record<string, string[]> = {
    phase2Core: [],
    phase2PreFinalize: [],
    phase2Finalize: [],
  }

  const common = {
    publicClient,
    bundlerUrl,
    walletId,
    smartWallet,
    ownerAddress: ownerContext.ownerAddress,
    ownerIndex: ownerContext.ownerIndex,
  }

  if (coreCalls.length > 0) {
    const results = await sendCalls({ ...common, label: 'phase2Core', calls: coreCalls })
    txs.phase2Core = results.map((r) => r.txHash)
    for (const label of ['gaugeController', 'ccaLaunchArm', 'oracle'] as const) {
      const addr = expected[label]
      if (addr && isAddress(addr)) {
        const ok = await waitForCode(publicClient, getAddress(addr), label)
        if (!ok) throw new Error(`${label} not deployed at ${addr} after phase2Core`)
      }
    }
  }

  if (through === 'core') {
    console.log('PHASE2_CORE_OK')
    return
  }

  const runPrefinalize = async () => {
    if (preCalls.length === 0) return
    const results = await sendCalls({ ...common, label: 'phase2PreFinalize', calls: preCalls })
    txs.phase2PreFinalize = results.map((r) => r.txHash)
    for (const label of ['burnStream', 'payoutRouter', 'creatorCoinPolicyController'] as const) {
      const addr = expected[label]
      if (addr && isAddress(addr)) {
        const ok = await waitForCode(publicClient, getAddress(addr), label)
        if (!ok) console.warn(`WARN: ${label} not yet coded at ${addr} after prefinalize`)
      }
    }
  }

  const runFinalize = async () => {
    if (finalizeCalls.length === 0) return
    const results = await sendCalls({ ...common, label: 'phase2Finalize', calls: finalizeCalls })
    txs.phase2Finalize = results.map((r) => r.txHash)
  }

  if (finalizeBeforePrefinalize) {
    if (through === 'finalize' || through === 'prefinalize') {
      await runFinalize()
    }
    if (through === 'prefinalize' || through === 'finalize') {
      await runPrefinalize()
    }
  } else {
    if (through === 'prefinalize' || through === 'finalize') {
      await runPrefinalize()
    }
    if (through === 'prefinalize') {
      console.log('PHASE2_PREFINALIZE_OK')
      return
    }
    await runFinalize()
  }

  const checks: Record<string, string> = {}
  for (const [label, addr] of Object.entries(expected)) {
    if (!addr || !isAddress(addr)) continue
    const code = await publicClient.getBytecode({ address: getAddress(addr) })
    checks[label] = code && code !== '0x' ? getAddress(addr) : 'MISSING'
  }
  console.log(JSON.stringify({ deployed: checks }, null, 2))

  const required = [
    'vault',
    'wrapper',
    'shareOFT',
    'gaugeController',
    'ccaLaunchArm',
    'oracle',
  ] as const
  const missing = required.filter((label) => !checks[label] || checks[label] === 'MISSING')
  if (missing.length > 0) {
    throw new Error(`Phase 2 incomplete; missing: ${missing.join(',')}`)
  }

  let peer: Hex | null = null
  if (shareOft) {
    peer = (await publicClient.readContract({
      address: shareOft,
      abi: [
        {
          type: 'function',
          name: 'peers',
          stateMutability: 'view',
          inputs: [{ name: 'eid', type: 'uint32' }],
          outputs: [{ type: 'bytes32' }],
        },
      ] as const,
      functionName: 'peers',
      args: [30168],
    })) as Hex
    console.log(`shareOFT.peers(30168)=${peer}`)
    if (peer === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('Phase 2 finalize did not set ShareOFT peer for eid 30168')
    }
  }

  const statePath = resolve(
    process.cwd(),
    'scripts/ops/.akita-redeploy-state/post-phase2.json',
  )
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(
    statePath,
    JSON.stringify(
      {
        phase: 'post-phase2',
        recordedAt: new Date().toISOString(),
        version: plan.version || expectedFromFile.version,
        creatorToken: plan.creatorToken,
        shareMeshMint: plan.solanaOvault?.shareMeshMint ?? null,
        ...Object.fromEntries(
          Object.entries(expected).map(([k, v]) => [k === 'shareOFT' ? 'shareOft' : k, v]),
        ),
        shareOftPeer30168: peer,
        txs,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`state_written=${statePath}`)
  console.log('PHASE2_OK')
}

main().catch((error) => {
  const err = error as Error & { code?: string; cause?: unknown; details?: unknown; shortMessage?: string }
  console.error(err?.message ?? error)
  if (err?.code) console.error('code=', err.code)
  if (err?.shortMessage) console.error('shortMessage=', err.shortMessage)
  if (err?.details) console.error('details=', err.details)
  if (err?.cause) {
    const cause = err.cause as Error & { shortMessage?: string; details?: unknown; data?: unknown }
    console.error('cause=', cause?.message ?? cause)
    if (cause?.shortMessage) console.error('cause.shortMessage=', cause.shortMessage)
    if (cause?.details) console.error('cause.details=', cause.details)
    if (cause?.data) console.error('cause.data=', cause.data)
  }
  process.exit(1)
})
