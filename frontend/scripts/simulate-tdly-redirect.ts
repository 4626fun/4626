#!/usr/bin/env tsx
/**
 * Decode a Base App / Coinbase tdly-redirect URL and run it on Tenderly Simulate API.
 *
 * Requires in frontend/.env (server-side only — never VITE_*):
 *   TENDERLY_API_URL=https://api.tenderly.co/api/v1/account/{user}/project/{slug}/
 *   TENDERLY_ACCESS_TOKEN=
 *
 * Usage:
 *   pnpm -C frontend tenderly:simulate-redirect -- \
 *     --url 'https://base.github.io/tdly-redirect/?q=H4sI...'
 *
 *   pnpm -C frontend tenderly:simulate-redirect -- --q 'H4sI...'
 *
 * Exit codes:
 *   0 — simulation succeeded (status true)
 *   1 — usage / config / HTTP error
 *   2 — simulation reverted (status false)
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buildTenderlyDashboardUrl,
  decodeTdlyRedirectQuery,
  extractTdlyRedirectQueryFromUrl,
  parseTenderlyApiUrl,
  type TdlyRedirectParams,
} from '../server/_lib/debug/tdlyRedirect.js'

type SimulateResponse = {
  simulation?: {
    id?: string
    slug?: string
    status?: boolean
    error_message?: string | null
  }
  transaction?: {
    error_message?: string | null
    transaction_info?: {
      call_trace?: CallTraceNode
    }
  }
}

type CallTraceNode = {
  to?: string
  contract_name?: string
  function_name?: string
  error?: string | null
  calls?: CallTraceNode[]
}

function loadEnvFile(path: string): void {
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend tenderly:simulate-redirect -- --url '<tdly-redirect-url>'
  pnpm -C frontend tenderly:simulate-redirect -- --q '<base64url-gzip-payload>'

Options:
  --url <url>       Full https://base.github.io/tdly-redirect/?q=... URL
  --q <payload>     Raw q= payload (base64url gzip of query string)
  --json            Print full Tenderly JSON response
  --no-save         Do not save simulation to Tenderly dashboard
  --help            Show this help
`)
}

function parseArgs(argv: string[]): {
  url: string | null
  q: string | null
  json: boolean
  save: boolean
  help: boolean
} {
  const map = new Map<string, string>()
  const flags = new Set<string>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      flags.add(key)
    } else {
      map.set(key, next)
      i += 1
    }
  }
  return {
    url: map.get('url') ?? null,
    q: map.get('q') ?? null,
    json: flags.has('json'),
    save: !flags.has('no-save'),
    help: flags.has('help') || flags.has('h'),
  }
}

function buildSimulateBody(params: TdlyRedirectParams, save: boolean): Record<string, unknown> {
  return {
    network_id: params.network,
    block_number: Number.parseInt(params.block, 10),
    from: params.from,
    to: params.contractAddress,
    gas: Number.parseInt(params.gas, 10),
    gas_price: 0,
    value: 0,
    input: params.rawFunctionInput,
    simulation_type: 'full',
    save,
    save_if_fails: save,
  }
}

function collectCallTraceErrors(node: CallTraceNode | undefined, depth = 0, out: string[] = []): string[] {
  if (!node) return out
  if (node.error) {
    const label = node.contract_name || node.to || 'unknown'
    out.push(`${'  '.repeat(depth)}${label} :: ${node.function_name ?? '?'} :: ${node.error}`)
  }
  for (const child of node.calls ?? []) collectCallTraceErrors(child, depth + 1, out)
  return out
}

function extractAaErrorCodes(payload: SimulateResponse): string[] {
  const haystacks: string[] = []
  const sim = payload.simulation
  const tx = payload.transaction
  if (sim?.error_message) haystacks.push(sim.error_message)
  if (tx?.error_message) haystacks.push(tx.error_message)

  const walk = (node: CallTraceNode | undefined): void => {
    if (!node) return
    if (node.error) haystacks.push(node.error)
    for (const child of node.calls ?? []) walk(child)
  }
  walk(tx?.transaction_info?.call_trace)

  const matches = haystacks.join('\n').match(/AA\d+[^,\n]*/g) ?? []
  return [...new Set(matches.map((m) => m.replace(/\u0000/g, '').trim()))]
}

async function main(): Promise<number> {
  loadEnvFile(resolve(process.cwd(), '.env'))

  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return 0
  }

  const q = args.q ?? (args.url ? extractTdlyRedirectQueryFromUrl(args.url) : null)
  if (!q) {
    usage()
    process.stderr.write('\nError: pass --url or --q\n')
    return 1
  }

  const token = process.env.TENDERLY_ACCESS_TOKEN?.trim()
  const apiUrl = process.env.TENDERLY_API_URL?.trim()
  if (!token) {
    process.stderr.write('Error: TENDERLY_ACCESS_TOKEN is missing (set in frontend/.env)\n')
    return 1
  }
  if (!apiUrl) {
    process.stderr.write('Error: TENDERLY_API_URL is missing (set in frontend/.env)\n')
    return 1
  }

  let params: TdlyRedirectParams
  try {
    params = decodeTdlyRedirectQuery(q)
  } catch (error) {
    process.stderr.write(`Error decoding tdly-redirect payload: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }

  const inputByteLen = (params.rawFunctionInput.length - 2) / 2
  if (inputByteLen < 1500) {
    process.stderr.write(
      `Warning: rawFunctionInput is only ~${inputByteLen} bytes — redirect q= may be truncated; signature validation sims can be incomplete.\n`,
    )
  }

  let tenderlyRoute: ReturnType<typeof parseTenderlyApiUrl>
  try {
    tenderlyRoute = parseTenderlyApiUrl(apiUrl)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }

  const body = buildSimulateBody(params, args.save)
  process.stdout.write(
    `Simulating network=${params.network} block=${params.block} to=${params.contractAddress}\n`,
  )

  let response: Response
  try {
    response = await fetch(tenderlyRoute.simulateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': token,
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    process.stderr.write(`Tenderly request failed: ${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }

  const text = await response.text()
  if (!response.ok) {
    process.stderr.write(`Tenderly HTTP ${response.status}\n${text.slice(0, 4000)}\n`)
    return 1
  }

  let data: SimulateResponse
  try {
    data = JSON.parse(text) as SimulateResponse
  } catch {
    process.stderr.write('Tenderly returned non-JSON response\n')
    return 1
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
    return data.simulation?.status ? 0 : 2
  }

  const sim = data.simulation ?? {}
  const tx = data.transaction ?? {}
  const status = sim.status === true
  const simId = sim.id ?? sim.slug
  const errorMessage = sim.error_message ?? tx.error_message ?? '(none)'

  process.stdout.write(`status: ${status}\n`)
  process.stdout.write(`error_message: ${errorMessage}\n`)
  if (simId) {
    process.stdout.write(
      `dashboard: ${buildTenderlyDashboardUrl(tenderlyRoute.account, tenderlyRoute.project, simId)}\n`,
    )
  }

  const aaCodes = extractAaErrorCodes(data)
  if (aaCodes.length) process.stdout.write(`aa_errors: ${aaCodes.join(', ')}\n`)

  const traceErrors = collectCallTraceErrors(tx.transaction_info?.call_trace)
  if (traceErrors.length) {
    process.stdout.write('call_trace:\n')
    for (const line of traceErrors.slice(0, 12)) process.stdout.write(`${line}\n`)
  }

  return status ? 0 : 2
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exit(1)
  })
