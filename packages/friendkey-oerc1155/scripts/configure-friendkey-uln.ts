#!/usr/bin/env tsx
/**
 * Configure LayerZero send/receive ULN for FriendKeyOERC1155 Base ↔ Robinhood.
 *
 * Policy (share-mesh EVM lane): confirmations [15, 15], 0 required DVNs,
 * 5 optional DVNs with threshold 3.
 *
 * Robinhood DVN set (Base ∩ Uni ∩ RH — Google/Telekom unavailable on RH):
 *   LayerZero Labs, Nethermind, Horizen, P2P, BitGo
 *
 * Defaults:
 *   --oapp 0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155
 *   --spoke robinhood
 *
 *   pnpm configure-uln
 *   pnpm configure-uln -- --execute
 *
 * Env: PRIVATE_KEY (must be OApp owner / endpoint delegate), BASE_RPC_URL,
 *      ROBINHOOD_RPC_URL (optional; defaults to public RH RPC)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  defineChain,
  encodeAbiParameters,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Chain,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  EXPECTED_EVM_LANE_CONFIRMATIONS,
  EXPECTED_OPTIONAL_DVN_COUNT,
  EXPECTED_OPTIONAL_DVN_THRESHOLD,
  NIL_REQUIRED_DVN_COUNT,
  SHARE_MESH_BASE_EID,
  SHARE_MESH_ROBINHOOD_EID,
  outboundMeetsInbound,
} from './lib/shareMeshLzPathwayPolicy.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = resolve(__dirname, '..')

const DEFAULT_OAPP = '0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155' as const
const ULN_CONFIG_TYPE = 2
const DEFAULT_DVN_METADATA_URL = 'https://metadata.layerzero-api.com/v1/metadata/deployments'
const DEFAULT_RH_RPC = 'https://rpc.mainnet.chain.robinhood.com'

/** Robinhood: Base∩Uni∩RH five. */
const ROBINHOOD_INTERSECT_FIVE = [
  'LayerZero Labs',
  'Nethermind',
  'Horizen',
  'P2P',
  'BitGo',
] as const

const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [DEFAULT_RH_RPC] } },
})

type UlnConfig = {
  confirmations: bigint
  requiredDvnCount: number
  optionalDvnCount: number
  optionalDvnThreshold: number
  requiredDvns: Address[]
  optionalDvns: Address[]
}

const ENDPOINT_ABI = parseAbi([
  'function delegates(address oapp) view returns (address)',
  'function getSendLibrary(address sender, uint32 dstEid) view returns (address)',
  'function getReceiveLibrary(address receiver, uint32 srcEid) view returns (address lib, bool isDefault)',
  'function getConfig(address oapp, address lib, uint32 eid, uint32 configType) view returns (bytes config)',
  'function setConfig(address oapp, address lib, (uint32 eid, uint32 configType, bytes config)[] params)',
])

const OAPP_ABI = parseAbi([
  'function owner() view returns (address)',
  'function endpoint() view returns (address)',
])

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

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

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

function normalizePrivateKey(raw: string): Hex {
  const value = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid_private_key')
  return value as Hex
}

function orderedAddresses(addresses: readonly Address[]): Address[] {
  return [...addresses].map((a) => getAddress(a)).sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
}

function exactAddressList(actual: readonly Address[], expected: readonly Address[]): boolean {
  if (actual.length !== expected.length) return false
  return actual.every((addr, i) => getAddress(addr) === getAddress(expected[i]!))
}

function decodeUlnConfig(encoded: Hex): UlnConfig {
  const [decoded] = decodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'confirmations', type: 'uint64' },
          { name: 'requiredDvnCount', type: 'uint8' },
          { name: 'optionalDvnCount', type: 'uint8' },
          { name: 'optionalDvnThreshold', type: 'uint8' },
          { name: 'requiredDvns', type: 'address[]' },
          { name: 'optionalDvns', type: 'address[]' },
        ],
      },
    ],
    encoded,
  ) as [UlnConfig]
  return {
    confirmations: BigInt(decoded.confirmations),
    requiredDvnCount: Number(decoded.requiredDvnCount),
    optionalDvnCount: Number(decoded.optionalDvnCount),
    optionalDvnThreshold: Number(decoded.optionalDvnThreshold),
    requiredDvns: decoded.requiredDvns.map((a) => getAddress(a)),
    optionalDvns: decoded.optionalDvns.map((a) => getAddress(a)),
  }
}

function encodeUlnConfig(config: UlnConfig): Hex {
  return encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'confirmations', type: 'uint64' },
          { name: 'requiredDvnCount', type: 'uint8' },
          { name: 'optionalDvnCount', type: 'uint8' },
          { name: 'optionalDvnThreshold', type: 'uint8' },
          { name: 'requiredDvns', type: 'address[]' },
          { name: 'optionalDvns', type: 'address[]' },
        ],
      },
    ],
    [
      {
        confirmations: config.confirmations,
        requiredDvnCount: config.requiredDvnCount,
        optionalDvnCount: config.optionalDvnCount,
        optionalDvnThreshold: config.optionalDvnThreshold,
        requiredDvns: config.requiredDvns,
        optionalDvns: config.optionalDvns,
      },
    ],
  )
}

function buildEvmLaneUlnConfig(dvns: readonly Address[]): UlnConfig {
  const optionalDvns = orderedAddresses(dvns)
  if (optionalDvns.length !== EXPECTED_OPTIONAL_DVN_COUNT) {
    throw new Error(`expected_${EXPECTED_OPTIONAL_DVN_COUNT}_dvns_got_${optionalDvns.length}`)
  }
  return {
    confirmations: EXPECTED_EVM_LANE_CONFIRMATIONS,
    requiredDvnCount: NIL_REQUIRED_DVN_COUNT,
    optionalDvnCount: EXPECTED_OPTIONAL_DVN_COUNT,
    optionalDvnThreshold: EXPECTED_OPTIONAL_DVN_THRESHOLD,
    requiredDvns: [],
    optionalDvns,
  }
}

function isExactEvmLaneUln(actual: UlnConfig, expected: UlnConfig): boolean {
  const requiredCount =
    actual.requiredDvnCount === NIL_REQUIRED_DVN_COUNT ? 0 : actual.requiredDvnCount
  return (
    actual.confirmations === expected.confirmations &&
    requiredCount === 0 &&
    actual.optionalDvnCount === expected.optionalDvnCount &&
    actual.optionalDvnThreshold === expected.optionalDvnThreshold &&
    exactAddressList(actual.optionalDvns, expected.optionalDvns) &&
    actual.requiredDvns.length === 0
  )
}

type DvnRecord = {
  canonicalName?: unknown
  version?: unknown
  deprecated?: unknown
  lzReadCompatible?: unknown
}

async function resolveChainDvns(chain: 'base' | 'robinhood', names: readonly string[]): Promise<Address[]> {
  const url = new URL(env('LZ_DVN_METADATA_URL') || DEFAULT_DVN_METADATA_URL)
  url.searchParams.set('version', 'v2')
  url.searchParams.set('stage', 'mainnet')
  url.searchParams.set('chains', chain)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`dvn_metadata_http_${res.status}`)
  const body = (await res.json()) as Record<string, { dvns?: Record<string, DvnRecord>; chainName?: unknown }>
  const entry =
    body[chain] ??
    Object.values(body).find((v) => String(v?.chainName ?? '').toLowerCase() === chain)
  if (!entry?.dvns) throw new Error(`dvn_metadata_missing_chain:${chain}`)

  return names.map((name) => {
    const matches = Object.entries(entry.dvns ?? {})
      .filter(([, value]) => {
        return (
          value?.canonicalName === name &&
          value?.version === 2 &&
          value?.deprecated !== true &&
          value?.lzReadCompatible !== true
        )
      })
      .map(([address]) => getAddress(address as Address))
    if (matches.length !== 1) throw new Error(`dvn_metadata_ambiguous:${chain}:${name}:${matches.length}`)
    return matches[0]!
  })
}

function firstRpc(...names: string[]): string {
  for (const name of names) {
    const value = env(name).split(',')[0]?.trim()
    if (value) return value
  }
  return ''
}

async function readSide(params: {
  label: string
  chain: Chain
  rpc: string
  oapp: Address
  remoteEid: number
  expectedDvns: readonly Address[]
}) {
  const client = createPublicClient({ chain: params.chain, transport: http(params.rpc) })
  if ((await client.getChainId()) !== params.chain.id) {
    throw new Error(`${params.label}_chain_id_mismatch`)
  }
  const endpoint = getAddress(
    await client.readContract({ address: params.oapp, abi: OAPP_ABI, functionName: 'endpoint' }),
  )
  const [owner, delegate, sendLibrary, receiveLibraryResult] = await Promise.all([
    client.readContract({ address: params.oapp, abi: OAPP_ABI, functionName: 'owner' }),
    client.readContract({ address: endpoint, abi: ENDPOINT_ABI, functionName: 'delegates', args: [params.oapp] }),
    client.readContract({
      address: endpoint,
      abi: ENDPOINT_ABI,
      functionName: 'getSendLibrary',
      args: [params.oapp, params.remoteEid],
    }),
    client.readContract({
      address: endpoint,
      abi: ENDPOINT_ABI,
      functionName: 'getReceiveLibrary',
      args: [params.oapp, params.remoteEid],
    }),
  ])
  const [receiveLibrary] = receiveLibraryResult
  const [sendRaw, receiveRaw] = await Promise.all([
    client.readContract({
      address: endpoint,
      abi: ENDPOINT_ABI,
      functionName: 'getConfig',
      args: [params.oapp, sendLibrary, params.remoteEid, ULN_CONFIG_TYPE],
    }),
    client.readContract({
      address: endpoint,
      abi: ENDPOINT_ABI,
      functionName: 'getConfig',
      args: [params.oapp, receiveLibrary, params.remoteEid, ULN_CONFIG_TYPE],
    }),
  ])
  const expected = buildEvmLaneUlnConfig(params.expectedDvns)
  const send = decodeUlnConfig(sendRaw)
  const receive = decodeUlnConfig(receiveRaw)
  return {
    label: params.label,
    chain: params.chain,
    rpc: params.rpc,
    oapp: params.oapp,
    remoteEid: params.remoteEid,
    endpoint,
    client,
    owner: getAddress(owner),
    delegate: getAddress(delegate),
    sendLibrary: getAddress(sendLibrary),
    receiveLibrary: getAddress(receiveLibrary),
    send,
    receive,
    expected,
    sendOk: isExactEvmLaneUln(send, expected),
    receiveOk: isExactEvmLaneUln(receive, expected),
  }
}

async function applySide(
  side: Awaited<ReturnType<typeof readSide>>,
  account: ReturnType<typeof privateKeyToAccount>,
): Promise<{ sendHash?: Hex; receiveHash?: Hex }> {
  const wallet = createWalletClient({
    account,
    chain: side.chain,
    transport: http(side.rpc),
  })
  const config = encodeUlnConfig(side.expected)
  const hashes: { sendHash?: Hex; receiveHash?: Hex } = {}
  const param = { eid: side.remoteEid, configType: ULN_CONFIG_TYPE, config }

  if (!side.sendOk) {
    const { request } = await side.client.simulateContract({
      address: side.endpoint,
      abi: ENDPOINT_ABI,
      functionName: 'setConfig',
      args: [side.oapp, side.sendLibrary, [param]],
      account,
    })
    hashes.sendHash = await wallet.writeContract(request)
    await side.client.waitForTransactionReceipt({ hash: hashes.sendHash, confirmations: 1, timeout: 180_000 })
  }

  if (!side.receiveOk) {
    const { request } = await side.client.simulateContract({
      address: side.endpoint,
      abi: ENDPOINT_ABI,
      functionName: 'setConfig',
      args: [side.oapp, side.receiveLibrary, [param]],
      account,
    })
    hashes.receiveHash = await wallet.writeContract(request)
    await side.client.waitForTransactionReceipt({ hash: hashes.receiveHash, confirmations: 1, timeout: 180_000 })
  }

  return hashes
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const spokeArg = (getArg('--spoke', 'robinhood') || 'robinhood').toLowerCase()
  if (spokeArg !== 'robinhood') {
    throw new Error('only --spoke=robinhood is supported in this kit script')
  }
  const oapp = getAddress(getArg('--oapp', env('EXPECTED_WRAP') || env('WRAP') || DEFAULT_OAPP))

  const baseRpc = firstRpc('BASE_RPC_URL')
  const spokeRpc = firstRpc('ROBINHOOD_RPC_URL', 'RH_RPC_URL') || DEFAULT_RH_RPC
  if (!baseRpc) throw new Error('missing_base_rpc_url')

  const [baseDvns, spokeDvns] = await Promise.all([
    resolveChainDvns('base', ROBINHOOD_INTERSECT_FIVE),
    resolveChainDvns('robinhood', ROBINHOOD_INTERSECT_FIVE),
  ])

  const [baseSide, spokeSide] = await Promise.all([
    readSide({
      label: 'base',
      chain: base,
      rpc: baseRpc,
      oapp,
      remoteEid: SHARE_MESH_ROBINHOOD_EID,
      expectedDvns: baseDvns,
    }),
    readSide({
      label: 'robinhood',
      chain: robinhood,
      rpc: spokeRpc,
      oapp,
      remoteEid: SHARE_MESH_BASE_EID,
      expectedDvns: spokeDvns,
    }),
  ])

  const pathwayOk =
    outboundMeetsInbound(baseSide.send.confirmations, spokeSide.receive.confirmations) &&
    outboundMeetsInbound(spokeSide.send.confirmations, baseSide.receive.confirmations)

  const report: Record<string, unknown> = {
    oapp,
    pathway: 'base↔robinhood',
    confirmations: [Number(EXPECTED_EVM_LANE_CONFIRMATIONS), Number(EXPECTED_EVM_LANE_CONFIRMATIONS)],
    optionalDvnCount: EXPECTED_OPTIONAL_DVN_COUNT,
    optionalDvnThreshold: EXPECTED_OPTIONAL_DVN_THRESHOLD,
    dvnNames: ROBINHOOD_INTERSECT_FIVE,
    baseDvns,
    robinhoodDvns: spokeDvns,
    base: {
      sendOk: baseSide.sendOk,
      receiveOk: baseSide.receiveOk,
      owner: baseSide.owner,
      delegate: baseSide.delegate,
      endpoint: baseSide.endpoint,
    },
    robinhood: {
      sendOk: spokeSide.sendOk,
      receiveOk: spokeSide.receiveOk,
      owner: spokeSide.owner,
      delegate: spokeSide.delegate,
      endpoint: spokeSide.endpoint,
    },
    pathwayOk,
    ready: baseSide.sendOk && baseSide.receiveOk && spokeSide.sendOk && spokeSide.receiveOk && pathwayOk,
    execute,
  }

  if (!execute) {
    console.log(JSON.stringify(report, null, 2))
    console.log('\nDry-run only. Pass --execute to apply missing ULN configs (owner/delegate key).')
    return
  }

  const pk = normalizePrivateKey(env('PRIVATE_KEY'))
  const account = privateKeyToAccount(pk)
  const hashes = {
    base: await applySide(baseSide, account),
    robinhood: await applySide(spokeSide, account),
  }
  report.hashes = hashes
  report.applied = true
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
