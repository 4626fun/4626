#!/usr/bin/env node
/**
 * One Dollar Audit — x402 paid AI Solidity review ($1 USDC on Base).
 *
 * Docs: https://www.onedollaraudit.com/
 * Endpoint: POST https://leftclaw.services/api/audit
 *
 * Runtime deps are declared on `frontend/package.json` (`viem`, `@x402/*`).
 *
 * Usage (from repo root or frontend):
 *   pnpm -C frontend security:one-dollar-audit -- --description "…"
 *   # or:
 *   node scripts/security/one-dollar-audit.mjs --description "…"   # root shim
 *
 * Optional:
 *   --context "extra notes"
 *   --callback-url https://…
 *   --poll          # block until complete / declined
 *   --job <id>      # poll existing job only (no payment)
 *
 * Persist jobId before the process exits — do not re-pay to re-check.
 */

import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch'
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm'

const AUDIT_URL = 'https://leftclaw.services/api/audit'
const JOB_URL = (id) => `https://www.onedollaraudit.com/api/jobs/${id}`

function parseArgs(argv) {
  const out = { description: '', context: '', callbackUrl: '', job: '', poll: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--description') out.description = argv[++i] ?? ''
    else if (a === '--context') out.context = argv[++i] ?? ''
    else if (a === '--callback-url') out.callbackUrl = argv[++i] ?? ''
    else if (a === '--job') out.job = argv[++i] ?? ''
    else if (a === '--poll') out.poll = true
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

async function pollJob(jobId) {
  for (;;) {
    const res = await fetch(JOB_URL(jobId), { headers: { Accept: 'application/json' } })
    const body = await res.json().catch(() => ({}))
    if (res.status === 404) {
      console.error('job not found yet; retrying…')
      await new Promise((r) => setTimeout(r, 15_000))
      continue
    }
    if (!res.ok) throw new Error(`job poll HTTP ${res.status}: ${JSON.stringify(body)}`)
    console.log(JSON.stringify({ status: body.status, stage: body.stage, jobId: body.jobId }, null, 2))
    if (body.status === 'complete') {
      console.log('reportUrl:', body.reportUrl ?? body.report)
      console.log('reportHtmlUrl:', body.reportHtmlUrl)
      console.log('trackUrl:', body.trackUrl ?? `https://onedollaraudit.com/audit/${jobId}`)
      return body
    }
    if (body.status === 'declined' || body.status === 'cancelled') {
      throw new Error(`job ${body.status}`)
    }
    const wait = Number(body.pollIntervalSeconds ?? 30) * 1000
    await new Promise((r) => setTimeout(r, wait))
  }
}

async function commission({ description, context, callbackUrl }) {
  const raw = process.env.PRIVATE_KEY?.trim()
  if (!raw) throw new Error('PRIVATE_KEY missing')
  const pk = /** @type {`0x${string}`} */ (raw.startsWith('0x') ? raw : `0x${raw}`)

  const account = privateKeyToAccount(pk)
  const transport = http(process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org')
  const publicClient = createPublicClient({ chain: base, transport })
  const walletClient = createWalletClient({ account, chain: base, transport })
  const rawSigner = toClientEvmSigner(walletClient, publicClient)
  const signer = { ...rawSigner, address: account.address }
  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: 'eip155:8453', client: new ExactEvmScheme(signer) }],
  })

  const body = { description }
  if (context) body.context = context
  if (callbackUrl) body.callbackUrl = callbackUrl

  console.error(`paying from ${account.address} …`)
  const response = await fetchWithPayment(AUDIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`non-JSON ${response.status}: ${text.slice(0, 500)}`)
  }
  if (!response.ok) throw new Error(`Failed ${response.status}: ${text.slice(0, 2000)}`)
  console.log(JSON.stringify(json, null, 2))
  if (json.jobId == null) throw new Error('response missing jobId')
  console.error(`PERSIST jobId=${json.jobId} track=${json.jobUrl ?? `https://onedollaraudit.com/audit/${json.jobId}`}`)
  return json
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(
      `Usage: pnpm -C frontend security:one-dollar-audit -- --description "…" [--poll]\n` +
        `   or: node scripts/security/one-dollar-audit.mjs --description "…"  (root shim)`,
    )
    process.exit(0)
  }
  if (args.job) {
    await pollJob(args.job)
    return
  }
  if (!args.description || args.description.length < 10) {
    throw new Error('--description required (min 10 chars): verified address or pasted source summary')
  }
  const result = await commission(args)
  if (args.poll) await pollJob(result.jobId)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
