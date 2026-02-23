#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

import { createPublicClient, encodeAbiParameters, getAddress, http, isAddress } from 'viem'
import { base } from 'viem/chains'

const DEFAULT_ORIGIN = process.env.CANONICAL_ORIGIN || 'http://localhost:5173'
const DEFAULT_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const DEFAULT_BATCHER = '0x4184D9118ec31061cEDd6041B6bD676ac19F29a5'
const DEFAULT_STORE = '0x1268f550E794e235e4eFCE7B2D3fd7a30bb62d13'
const DEFAULT_DEPLOYER = '0x74183076C7D33346880A5bf0e263B761FB4d38BA'

const SELECTOR_PHASE1_CORE = '1331378b'
const SELECTOR_PHASE1_CORE_WITH_SALT = '4154f24e'
const SELECTOR_PHASE1_FINALIZE = 'a98ec9d8'
const SELECTOR_PHASE1_FINALIZE_WITH_SALT = '3bc09a8b'

const OWNER_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
]

const BATCHER_VIEW_ABI = [
  { type: 'function', name: 'bytecodeStore', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'create2Deployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
]

const STORE_CHUNKCOUNT_ABI = [
  { type: 'function', name: 'chunkCount', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function getArg(name, fallback = '') {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return fallback
  return v
}

function usage() {
  console.log(`Usage:
  pnpm -C frontend run deploy:autopilot -- \
    --origin https://4626.fun \
    --plan ./path/to/deploy-plan.json \
    --auth-bearer <cv_auth_session_token>

Auth options:
  --auth-bearer <token>   (recommended)
  --cookie "cv_auth_session=..."

Optional:
  --rpc <url>                         (default: ${DEFAULT_RPC})
  --batcher <addr>                    (default: ${DEFAULT_BATCHER})
  --expected-store <addr>             (default: ${DEFAULT_STORE})
  --expected-deployer <addr>          (default: ${DEFAULT_DEPLOYER})
  --poll-ms <n>                       (default: 4000)
  --timeout-ms <n>                    (default: 900000)
  --skip-preflight
  --no-drive-continue
  --no-wait-owner-install`)
}

function requireAddress(label, value) {
  if (!isAddress(String(value || '').trim())) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return getAddress(String(value).trim())
}

function ownerBytes(owner) {
  return encodeAbiParameters([{ type: 'address' }], [owner]).toLowerCase()
}

function buildHeaders({ bearer, cookie }) {
  const headers = { 'Content-Type': 'application/json' }
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  if (cookie) headers.Cookie = cookie
  return headers
}

async function apiPost({ origin, path, headers, body }) {
  const url = `${origin.replace(/\/+$/, '')}/api/${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, json, url }
}

async function isOwnerInstalled({ client, smartWallet, ownerAddress, maxScan = 256 }) {
  const countRaw = await client.readContract({
    address: smartWallet,
    abi: OWNER_ABI,
    functionName: 'ownerCount',
  })
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return false

  const expected = ownerBytes(ownerAddress)
  const limit = Math.min(count, Math.max(1, maxScan))
  for (let i = 0; i < limit; i++) {
    const b = await client.readContract({
      address: smartWallet,
      abi: OWNER_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(i)],
    })
    if (String(b).toLowerCase() === expected) return true
  }
  return false
}

async function runPreflight({ client, batcher, expectedStore, expectedDeployer }) {
  const code = await client.getBytecode({ address: batcher })
  if (!code || code === '0x') throw new Error(`Batcher has no code: ${batcher}`)
  const codeLc = String(code).toLowerCase()

  const bytecodeStore = getAddress(
    await client.readContract({ address: batcher, abi: BATCHER_VIEW_ABI, functionName: 'bytecodeStore' }),
  )
  const create2Deployer = getAddress(
    await client.readContract({ address: batcher, abi: BATCHER_VIEW_ABI, functionName: 'create2Deployer' }),
  )

  if (bytecodeStore !== expectedStore) {
    throw new Error(`batcher.bytecodeStore mismatch (expected ${expectedStore}, got ${bytecodeStore})`)
  }
  if (create2Deployer !== expectedDeployer) {
    throw new Error(`batcher.create2Deployer mismatch (expected ${expectedDeployer}, got ${create2Deployer})`)
  }

  const requiredSelectors = [
    SELECTOR_PHASE1_CORE,
    SELECTOR_PHASE1_CORE_WITH_SALT,
    SELECTOR_PHASE1_FINALIZE,
    SELECTOR_PHASE1_FINALIZE_WITH_SALT,
  ]
  for (const s of requiredSelectors) {
    if (!codeLc.includes(s)) throw new Error(`batcher missing split selector 0x${s}`)
  }

  await client.readContract({
    address: expectedStore,
    abi: STORE_CHUNKCOUNT_ABI,
    functionName: 'chunkCount',
    args: ['0x0000000000000000000000000000000000000000000000000000000000000000'],
  })

  console.log('preflight ok')
  console.log(`batcher=${batcher}`)
  console.log(`store=${bytecodeStore}`)
  console.log(`deployer=${create2Deployer}`)
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const origin = String(getArg('--origin', DEFAULT_ORIGIN)).trim()
  const planPath = String(getArg('--plan', '')).trim()
  const bearer = String(getArg('--auth-bearer', process.env.CV_AUTH_SESSION_TOKEN || '')).trim()
  const cookie = String(getArg('--cookie', process.env.CV_AUTH_COOKIE || '')).trim()

  if (!planPath) throw new Error('Missing --plan')
  if (!bearer && !cookie) throw new Error('Missing auth: provide --auth-bearer or --cookie')

  const rpc = String(getArg('--rpc', DEFAULT_RPC)).trim()
  const batcher = requireAddress('batcher', getArg('--batcher', DEFAULT_BATCHER))
  const expectedStore = requireAddress('expected-store', getArg('--expected-store', DEFAULT_STORE))
  const expectedDeployer = requireAddress('expected-deployer', getArg('--expected-deployer', DEFAULT_DEPLOYER))
  const pollMs = Number(getArg('--poll-ms', '4000'))
  const timeoutMs = Number(getArg('--timeout-ms', '900000'))
  const driveContinue = !hasFlag('--no-drive-continue')
  const waitOwnerInstall = !hasFlag('--no-wait-owner-install')
  const skipPreflight = hasFlag('--skip-preflight')

  if (!Number.isFinite(pollMs) || pollMs < 1000) throw new Error('Invalid --poll-ms (must be >= 1000)')
  if (!Number.isFinite(timeoutMs) || timeoutMs < 30_000) throw new Error('Invalid --timeout-ms (must be >= 30000)')

  const raw = await fs.readFile(path.resolve(process.cwd(), planPath), 'utf8')
  const plan = JSON.parse(raw)

  const smartWallet = requireAddress('plan.smartWallet', plan.smartWallet)
  requireAddress('plan.creatorToken', plan.creatorToken)
  requireAddress('plan.ownerAddress', plan.ownerAddress)

  const hasWork =
    (Array.isArray(plan.phase1Calls) && plan.phase1Calls.length > 0) ||
    (Array.isArray(plan.phase2CoreCalls) && plan.phase2CoreCalls.length > 0) ||
    (Array.isArray(plan.phase2FinalizeCalls) && plan.phase2FinalizeCalls.length > 0) ||
    (Array.isArray(plan.phase2Calls) && plan.phase2Calls.length > 0) ||
    (Array.isArray(plan.phase3Calls) && plan.phase3Calls.length > 0) ||
    (Array.isArray(plan.phase4Calls) && plan.phase4Calls.length > 0)
  if (!hasWork) throw new Error('Plan has no deploy calls')

  const client = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 12_000 }),
  })

  if (!skipPreflight) {
    await runPreflight({ client, batcher, expectedStore, expectedDeployer })
  } else {
    console.log('preflight skipped')
  }

  const headers = buildHeaders({ bearer, cookie })
  const started = await apiPost({
    origin,
    path: 'deploy/session/start',
    headers,
    body: { ...plan, autoContinue: true },
  })
  if (!started.ok || !started.json?.success || !started.json?.data?.sessionId) {
    throw new Error(`start failed (${started.status}): ${JSON.stringify(started.json)}`)
  }

  const sessionId = String(started.json.data.sessionId)
  const sessionOwner = requireAddress('sessionOwner', started.json.data.sessionOwner)
  console.log(`session created id=${sessionId} owner=${sessionOwner} next=${started.json.data.nextAction}`)

  const startedAt = Date.now()
  const deadline = startedAt + timeoutMs

  if (started.json.data.nextAction === 'wait_for_owner_install' && waitOwnerInstall) {
    console.log('waiting for owner install (addOwnerAddress)...')
    while (Date.now() < deadline) {
      const installed = await isOwnerInstalled({ client, smartWallet, ownerAddress: sessionOwner, maxScan: 256 })
      if (installed) {
        console.log('owner installed; triggering continue')
        const continued = await apiPost({
          origin,
          path: 'deploy/session/continue',
          headers,
          body: { sessionId },
        })
        console.log(`continue status=${continued.status}`)
        break
      }
      await sleep(pollMs)
    }
  }

  const continueReady = new Set([
    'created',
    'phase1_confirmed',
    'phase1_finalize_confirmed',
    'phase2_core_confirmed',
    'phase2_confirmed',
    'phase3_confirmed',
    'phase4_confirmed',
  ])
  const inFlight = new Set([
    'phase1_sent',
    'phase1_finalize_sent',
    'phase2_core_sent',
    'phase2_sent',
    'phase3_sent',
    'phase4_sent',
    'cleanup_sent',
  ])
  const terminal = new Set(['completed', 'failed', 'cancelled'])
  let lastStep = ''
  let lastContinueAttemptAt = 0

  while (Date.now() < deadline) {
    const st = await apiPost({
      origin,
      path: 'deploy/session/status',
      headers,
      body: { sessionId },
    })
    if (!st.ok || !st.json?.success) {
      console.log(`status error (${st.status}) ${JSON.stringify(st.json)}`)
      await sleep(pollMs)
      continue
    }

    const data = st.json.data || {}
    const step = String(data.step || '')
    if (step !== lastStep) {
      console.log(`step=${step} userOp=${data.lastUserOpHash || '-'} tx=${data.lastTxHash || '-'}`)
      lastStep = step
    }

    if (terminal.has(step)) {
      if (step === 'completed') {
        console.log('deploy completed')
        process.exit(0)
      }
      console.error(`deploy ended in ${step}: ${data.lastError || 'unknown_error'}`)
      process.exit(1)
    }

    const now = Date.now()
    if (driveContinue && continueReady.has(step) && !inFlight.has(step) && now - lastContinueAttemptAt > 12_000) {
      lastContinueAttemptAt = now
      const continued = await apiPost({
        origin,
        path: 'deploy/session/continue',
        headers,
        body: { sessionId },
      })
      console.log(`continue attempt status=${continued.status}`)
    }

    await sleep(pollMs)
  }

  throw new Error(`timeout waiting for completion (${timeoutMs}ms)`)
}

main().catch((err) => {
  const message = err?.message ? String(err.message) : String(err)
  console.error(`deploy-autopilot failed: ${message}`)
  process.exit(1)
})
