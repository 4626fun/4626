#!/usr/bin/env tsx
/**
 * FriendKey #1659 seamless sell helper (CREATE2 sink).
 *
 * Flow:
 *   1) Base: factory.deploySink(user) once
 *   2) RH: wrap.send(BaseEid=30184, sinkOf(user), amount, options, refund)
 *      → hub unlocks FriendKey into sink → sellFromSink → Across USDC→USDG to user
 *
 *   pnpm sell -- --user=0x...
 *
 * Env: BASE_RPC_URL, FRIENDKEY_SINK_FACTORY (or deployments/base.friendkey-oerc1155.json)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPublicClient, getAddress, http, isAddress, parseAbi, type Address } from 'viem'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = resolve(__dirname, '..')
/** Live multi-id FriendKeyOERC1155 wrap (NOT legacy FriendKey1659 0xa1fa…1659). */
const DEFAULT_WRAP = '0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155' as const
const DEFAULT_SINK_FACTORY = '0x61De09Cb8CcAa249E6273Baeb904EAfA78CDAC70' as const
const BASE_EID = 30184

const factoryAbi = parseAbi([
  'function sinkOf(address user) view returns (address)',
  'function deploySink(address user) returns (address)',
  'function executor() view returns (address)',
])

function getArg(name: string, fallback = ''): string {
  const eqPrefix = `${name}=`
  for (const arg of process.argv) {
    if (arg.startsWith(eqPrefix)) return arg.slice(eqPrefix.length).trim()
  }
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

type Pins = {
  sinkFactory?: string
  sellExecutor?: string
  wrap?: string
  sell?: { sinkFactory?: string; sellExecutor?: string }
}

function loadPins(): Pins {
  const path = resolve(PKG_ROOT, 'deployments/base.friendkey-oerc1155.json')
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf8')) as Pins
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(PKG_ROOT, '.env.local'))
loadEnvFile(resolve(PKG_ROOT, '.env'))

async function main(): Promise<void> {
  const userRaw = getArg('--user') || process.env.USER_ADDRESS || ''
  if (!isAddress(userRaw)) {
    console.error('Usage: --user=0x... (EOA / CSW that holds RH wrap)')
    process.exit(1)
  }
  const user = getAddress(userRaw)
  const pins = loadPins()
  const factoryAddr = getAddress(
    process.env.FRIENDKEY_SINK_FACTORY ||
      pins.sinkFactory ||
      pins.sell?.sinkFactory ||
      DEFAULT_SINK_FACTORY,
  )
  const rpc = process.env.BASE_RPC_URL
  if (!rpc) {
    console.error('BASE_RPC_URL required')
    process.exit(1)
  }

  const client = createPublicClient({ transport: http(rpc) })
  const sink = (await client.readContract({
    address: factoryAddr,
    abi: factoryAbi,
    functionName: 'sinkOf',
    args: [user],
  })) as Address
  const executor = (await client.readContract({
    address: factoryAddr,
    abi: factoryAbi,
    functionName: 'executor',
  })) as Address
  const code = await client.getCode({ address: sink })
  const wrap = getAddress(process.env.EXPECTED_WRAP || process.env.WRAP || pins.wrap || DEFAULT_WRAP)

  console.log(
    JSON.stringify(
      {
        user,
        sinkFactory: factoryAddr,
        sellExecutor: executor,
        sinkOfUser: sink,
        sinkDeployed: Boolean(code && code !== '0x'),
        wrap,
        baseEid: BASE_EID,
        ops: {
          deploySinkOnce: `cast send ${factoryAddr} 'deploySink(address)' ${user} --rpc-url $BASE_RPC_URL --private-key $PRIVATE_KEY`,
          robinhoodWrapSend: `wrap.send(dstEid=${BASE_EID}, to=${sink}, tokenId, amount) on RH wrap ${DEFAULT_WRAP} — unlock lands in sink → auto sell+Across USDG`,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
