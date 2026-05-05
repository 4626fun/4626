#!/usr/bin/env node

import { createPublicClient, decodeAbiParameters, http, parseAbi } from 'viem'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

type RelayExecuteEnvelope = {
  success?: boolean
  error?: string
  data?: unknown
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx --env-file=.env scripts/smoke-relay-add-owner.ts \\
    --origin http://localhost:5173 \\
    --user 0x<canonical-csw> \\
    --csw 0x<canonical-csw> \\
    --data 0x<entrypoint-handleOps-calldata> \\
    --expected-owner 0x<owner-being-added>

Required:
  --user <address>            Relay /execute user (canonical CSW)
  --data <hex>                EntryPoint.handleOps calldata (already signed)
  --expected-owner <address>  Intended owner address embedded in addOwner payload

Optional:
  --origin <url>              App origin serving /api/relay/execute (default http://localhost:5173)
  --csw <address>             CSW contract to verify post-state (default --user)
  --entry-point <address>     EntryPoint target (default v0.6 on Base)
  --chain-id <number>         Chain id (default 8453)
  --rpc-url <url>             RPC for receipt/state checks (default https://mainnet.base.org)
  --poll-timeout-ms <ms>      Wait timeout for receipt (default 120000)

Notes:
  - This script does NOT sign anything; it submits the signed handleOps calldata.
  - Keep relay API key server-side; this script only hits your existing proxy route.
`)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isHex(value: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(value)
}

function toPositiveInt(raw: string, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function normalizeOrigin(raw: string): string {
  const value = raw.trim()
  if (!value) return 'http://localhost:5173'
  try {
    return new URL(value).origin
  } catch {
    throw new Error(`Invalid --origin: ${raw}`)
  }
}

function toLowerAddress(value: string): `0x${string}` {
  return value.toLowerCase() as `0x${string}`
}

function findFirstTxHashDeep(input: unknown): `0x${string}` | null {
  if (!input) return null
  if (typeof input === 'string') {
    return /^0x[0-9a-fA-F]{64}$/.test(input) ? (input as `0x${string}`) : null
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findFirstTxHashDeep(item)
      if (found) return found
    }
    return null
  }
  if (typeof input === 'object') {
    const record = input as Record<string, unknown>
    const directKeys = ['txHash', 'transactionHash', 'hash']
    for (const key of directKeys) {
      const value = record[key]
      if (typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)) {
        return value as `0x${string}`
      }
    }
    for (const value of Object.values(record)) {
      const found = findFirstTxHashDeep(value)
      if (found) return found
    }
  }
  return null
}

function payloadContainsAddOwnerTarget(handleOpsData: string, expectedOwner: string): boolean {
  const selector = '0f0f3f24'
  const encodedOwner = expectedOwner.toLowerCase().slice(2).padStart(64, '0')
  const needle = `${selector}${encodedOwner}`
  return handleOpsData.toLowerCase().includes(needle)
}

const CSW_OWNER_ABI = parseAbi([
  'function isOwnerAddress(address account) view returns (bool)',
  'function ownerAtIndex(uint256 index) view returns (bytes)',
])

function decodeOwnerBytesAsAddress(ownerBytes: `0x${string}`): `0x${string}` | null {
  try {
    const [decoded] = decodeAbiParameters([{ type: 'address' }], ownerBytes)
    return decoded.toLowerCase() as `0x${string}`
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const origin = normalizeOrigin(getArg('--origin', process.env.APP_ORIGIN ?? 'http://localhost:5173'))
  const chainId = toPositiveInt(getArg('--chain-id', '8453'), 8453)
  const user = getArg('--user')
  const csw = getArg('--csw', user)
  const entryPoint = getArg('--entry-point', '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')
  const data = getArg('--data')
  const expectedOwner = getArg('--expected-owner')
  const rpcUrl = getArg('--rpc-url', process.env.BASE_RPC_URL ?? 'https://mainnet.base.org')
  const pollTimeoutMs = toPositiveInt(getArg('--poll-timeout-ms', '120000'), 120000)

  if (!isAddress(user)) throw new Error('Missing/invalid --user')
  if (!isAddress(csw)) throw new Error('Missing/invalid --csw')
  if (!isAddress(entryPoint)) throw new Error('Missing/invalid --entry-point')
  if (!isAddress(expectedOwner)) throw new Error('Missing/invalid --expected-owner')
  if (!isHex(data) || !data.toLowerCase().startsWith('0x1fad948c')) {
    throw new Error('Missing/invalid --data (must be EntryPoint.handleOps calldata starting with 0x1fad948c)')
  }

  const addOwnerTargetFound = payloadContainsAddOwnerTarget(data, expectedOwner)
  if (!addOwnerTargetFound) {
    throw new Error('handleOps calldata does not contain addOwnerAddress(expectedOwner) payload')
  }

  const executeUrl = `${origin}/api/relay/execute`
  const relayBody = {
    chainId,
    to: toLowerAddress(entryPoint),
    data: data as `0x${string}`,
    value: '0',
    user: toLowerAddress(user),
  }

  process.stdout.write(`[relay-smoke] POST ${executeUrl}\n`)
  let res: Response
  try {
    res = await fetch(executeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(relayBody),
    })
  } catch (error) {
    const err = error as Error & { cause?: unknown }
    const causeMessage =
      err?.cause && typeof err.cause === 'object' && 'message' in (err.cause as Record<string, unknown>)
        ? String((err.cause as Record<string, unknown>).message ?? '')
        : ''
    throw new Error(
      `fetch failed to ${executeUrl}${causeMessage ? ` (${causeMessage})` : ''}. ` +
        `If using localhost, start the frontend server first: pnpm -C frontend dev`,
    )
  }
  const envelope = (await res.json().catch(() => ({}))) as RelayExecuteEnvelope
  if (!res.ok || envelope?.success === false) {
    throw new Error(
      `relay_execute_failed status=${res.status} error=${String(envelope?.error ?? 'unknown')}`,
    )
  }

  const txHash = findFirstTxHashDeep(envelope.data)
  if (!txHash) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          relayAccepted: true,
          txHash: null,
          note: 'No transaction hash found in relay response payload',
        },
        null,
        2,
      )}\n`,
    )
    return
  }

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  })

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: pollTimeoutMs,
  })

  const expectedOwnerLower = toLowerAddress(expectedOwner)
  const cswLower = toLowerAddress(csw)
  const ownerPresent = await publicClient.readContract({
    address: cswLower,
    abi: CSW_OWNER_ABI,
    functionName: 'isOwnerAddress',
    args: [expectedOwnerLower],
  })

  const matchedOwnerIndices: number[] = []
  for (let i = 0; i < 16; i += 1) {
    try {
      const ownerBytes = await publicClient.readContract({
        address: cswLower,
        abi: CSW_OWNER_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })
      const owner = decodeOwnerBytesAsAddress(ownerBytes as `0x${string}`)
      if (owner && owner === expectedOwnerLower) matchedOwnerIndices.push(i)
    } catch {
      break
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        txHash,
        chainId,
        relayExecuteUrl: executeUrl,
        payloadContainsExpectedAddOwnerTarget: addOwnerTargetFound,
        receiptStatus: receipt.status,
        ownerPresent,
        matchedOwnerIndices,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`[relay-smoke] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
