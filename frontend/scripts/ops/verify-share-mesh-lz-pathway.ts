#!/usr/bin/env tsx
/**
 * Read-only gate: Base ShareOFT ↔ Solana OFT store LayerZero pathway.
 *
 *   pnpm -C frontend ops:verify-share-mesh-lz \
 *     --share-oft 0x… \
 *     --oft-store Asa8… \
 *     [--mint <TOKEN2022>] \
 *     [--dest <SOLANA_WALLET>] \
 *     [--skip-dest-ata]
 *
 * Mint/dest have no defaults — ATA is checked only when both are passed
 * (fail-closed unless --skip-dest-ata).
 *
 * Exit 0 = pathway matches template policy [15,32] + 3-of-5 + peers both ways.
 * Exit 1 = blocked (do not Pipe A / share bridge until fixed).
 *
 * Incident class: outbound confirmations < inbound → LZ BLOCKED, Base burn
 * with Solana supply still 0.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PEER_SEED, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  createPublicClient,
  decodeAbiParameters,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { SOLANA_PROTOCOL_PROGRAMS } from '../../src/config/solanaProtocol.js'
import {
  SHARE_MESH_BASE_EID,
  SHARE_MESH_SOLANA_EID,
  asPaddedEvmPeer,
  assessShareMeshLzPathway,
  enforcedOptionsMatchSolanaTemplate,
  normalizeBaseUlnSlice,
  resolveEffectiveSolanaUlnSlice,
  type UlnConfirmationsSlice,
} from '../../src/lib/deploy/shareMeshLzPathwayPolicy.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')

const BASE_ENDPOINT = getAddress('0x1a44076050125825900e736c501f859c50fE728c')
const ULN_CONFIG_TYPE = 2
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const OFT_PROGRAM = new PublicKey(SOLANA_PROTOCOL_PROGRAMS.layerZeroOft)

const ULN_CONFIG_ABI = [
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
] as const

const ENDPOINT_ABI = parseAbi([
  'function getSendLibrary(address sender, uint32 dstEid) view returns (address lib)',
  'function getReceiveLibrary(address receiver, uint32 srcEid) view returns (address lib, bool isDefault)',
  'function getConfig(address oapp, address lib, uint32 eid, uint32 configType) view returns (bytes config)',
  'function delegates(address oapp) view returns (address)',
])

const SHARE_OFT_ABI = parseAbi([
  'function peers(uint32 eid) view returns (bytes32)',
  'function enforcedOptions(uint32 eid, uint16 msgType) view returns (bytes)',
  'function owner() view returns (address)',
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

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function requireAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`Invalid ${label}: ${value}`)
  return getAddress(value)
}

function decodeUln(encoded: Hex): UlnConfirmationsSlice {
  const [decoded] = decodeAbiParameters(ULN_CONFIG_ABI, encoded)
  return normalizeBaseUlnSlice({
    confirmations: decoded.confirmations,
    requiredDvnCount: decoded.requiredDvnCount,
    optionalDvnCount: decoded.optionalDvnCount,
    optionalDvnThreshold: decoded.optionalDvnThreshold,
  })
}

function solanaUlnSlice(raw: {
  confirmations?: { toString(): string } | number | bigint
  requiredDvnCount?: number
  optionalDvnCount?: number
  optionalDvnThreshold?: number
} | null | undefined): UlnConfirmationsSlice | null {
  if (!raw) return null
  return {
    confirmations: BigInt(raw.confirmations?.toString() ?? '0'),
    requiredDvnCount: Number(raw.requiredDvnCount ?? 0),
    optionalDvnCount: Number(raw.optionalDvnCount ?? 0),
    optionalDvnThreshold: Number(raw.optionalDvnThreshold ?? 0),
  }
}

function oftStoreBytes32(store: PublicKey): Hex {
  return `0x${Buffer.from(store.toBytes()).toString('hex')}` as Hex
}

function deriveOftPeerPda(store: PublicKey, dstEid: number): PublicKey {
  const eidBuf = Buffer.alloc(4)
  eidBuf.writeUInt32BE(dstEid)
  const seed = typeof PEER_SEED === 'string' ? Buffer.from(PEER_SEED) : Buffer.from('Peer')
  return PublicKey.findProgramAddressSync([seed, store.toBuffer(), eidBuf], OFT_PROGRAM)[0]
}

async function readSolanaPeerBytes32(
  connection: Connection,
  store: PublicKey,
  dstEid: number,
): Promise<Hex | null> {
  const peerPda = deriveOftPeerPda(store, dstEid)
  const info = await connection.getAccountInfo(peerPda, 'confirmed')
  if (!info || info.data.length < 40) return null
  return `0x${Buffer.from(info.data.subarray(8, 40)).toString('hex')}` as Hex
}

async function main(): Promise<void> {
  const shareOftRaw = getArg('--share-oft')
  const oftStoreRaw = getArg('--oft-store')
  if (!shareOftRaw || !oftStoreRaw) {
    throw new Error('usage: --share-oft 0x… --oft-store <SolanaOFTStore> required (no defaults)')
  }
  const shareOft = requireAddress(shareOftRaw, 'share-oft')
  const mintRaw = getArg('--mint')
  const destRaw = getArg('--dest')
  const skipDestAta =
    process.argv.includes('--skip-dest-ata') && !process.argv.includes('--require-dest-ata')

  let oftStore: PublicKey
  let mint: PublicKey | null = null
  let dest: PublicKey | null = null
  try {
    oftStore = new PublicKey(oftStoreRaw)
  } catch {
    throw new Error(`Invalid --oft-store: ${oftStoreRaw}`)
  }
  if (Boolean(mintRaw) !== Boolean(destRaw)) {
    throw new Error('mint_and_dest_must_be_provided_together')
  }
  if (mintRaw) {
    try {
      mint = new PublicKey(mintRaw)
    } catch {
      throw new Error(`Invalid --mint: ${mintRaw}`)
    }
  }
  if (destRaw) {
    try {
      dest = new PublicKey(destRaw)
    } catch {
      throw new Error(`Invalid --dest: ${destRaw}`)
    }
  }

  const baseRpc = (process.env.BASE_RPC_URL || '').split(',')[0]?.trim()
  if (!baseRpc) throw new Error('missing_BASE_RPC_URL')
  const solanaRpc =
    (process.env.SOLANA_RPC_URL || process.env.RPC_URL_SOLANA || '').trim() ||
    'https://api.mainnet-beta.solana.com'

  const client = createPublicClient({ chain: base, transport: http(baseRpc) })
  const connection = new Connection(solanaRpc, 'confirmed')
  const uln = new UlnProgram.Uln(UlnProgram.PROGRAM_ID)

  const [peer, enforcedOptions, owner, delegate, sendLib, receiveLibResult] = await Promise.all([
    client.readContract({
      address: shareOft,
      abi: SHARE_OFT_ABI,
      functionName: 'peers',
      args: [SHARE_MESH_SOLANA_EID],
    }),
    client.readContract({
      address: shareOft,
      abi: SHARE_OFT_ABI,
      functionName: 'enforcedOptions',
      args: [SHARE_MESH_SOLANA_EID, 1],
    }),
    client.readContract({ address: shareOft, abi: SHARE_OFT_ABI, functionName: 'owner' }),
    client.readContract({
      address: BASE_ENDPOINT,
      abi: ENDPOINT_ABI,
      functionName: 'delegates',
      args: [shareOft],
    }),
    client.readContract({
      address: BASE_ENDPOINT,
      abi: ENDPOINT_ABI,
      functionName: 'getSendLibrary',
      args: [shareOft, SHARE_MESH_SOLANA_EID],
    }),
    client.readContract({
      address: BASE_ENDPOINT,
      abi: ENDPOINT_ABI,
      functionName: 'getReceiveLibrary',
      args: [shareOft, SHARE_MESH_SOLANA_EID],
    }),
  ])

  const [receiveLib] = receiveLibResult
  const [
    baseSendRaw,
    baseReceiveRaw,
    solanaSendCustom,
    solanaReceiveCustom,
    solanaSendDefault,
    solanaReceiveDefault,
    solanaPeer,
  ] = await Promise.all([
    client.readContract({
      address: BASE_ENDPOINT,
      abi: ENDPOINT_ABI,
      functionName: 'getConfig',
      args: [shareOft, sendLib, SHARE_MESH_SOLANA_EID, ULN_CONFIG_TYPE],
    }) as Promise<Hex>,
    client.readContract({
      address: BASE_ENDPOINT,
      abi: ENDPOINT_ABI,
      functionName: 'getConfig',
      args: [shareOft, receiveLib, SHARE_MESH_SOLANA_EID, ULN_CONFIG_TYPE],
    }) as Promise<Hex>,
    uln.getSendConfigState(connection, oftStore, SHARE_MESH_BASE_EID, 'finalized'),
    uln.getReceiveConfigState(connection, oftStore, SHARE_MESH_BASE_EID, 'finalized'),
    uln.getDefaultSendConfigState(connection, SHARE_MESH_BASE_EID, 'finalized'),
    uln.getDefaultReceiveConfigState(connection, SHARE_MESH_BASE_EID, 'finalized'),
    readSolanaPeerBytes32(connection, oftStore, SHARE_MESH_BASE_EID),
  ])

  if (!solanaSendDefault?.uln || !solanaReceiveDefault?.uln) {
    throw new Error('solana_default_uln_unavailable')
  }

  const baseSend = decodeUln(baseSendRaw)
  const baseReceive = decodeUln(baseReceiveRaw)
  const solanaSend = resolveEffectiveSolanaUlnSlice(
    solanaUlnSlice(solanaSendDefault.uln),
    solanaUlnSlice(solanaSendCustom?.uln),
  )
  const solanaReceive = resolveEffectiveSolanaUlnSlice(
    solanaUlnSlice(solanaReceiveDefault.uln),
    solanaUlnSlice(solanaReceiveCustom?.uln),
  )

  const pathway = assessShareMeshLzPathway({
    baseSend,
    solanaReceive,
    solanaSend,
    baseReceive,
  })

  const expectedPeer = oftStoreBytes32(oftStore)
  const expectedReversePeer = asPaddedEvmPeer(shareOft)
  const peerOk = peer.toLowerCase() === expectedPeer.toLowerCase() && peer !== ZERO_BYTES32
  const reversePeerOk =
    Boolean(solanaPeer) && solanaPeer!.toLowerCase() === expectedReversePeer.toLowerCase()
  const enforcedOk = enforcedOptionsMatchSolanaTemplate(enforcedOptions)

  const extraChecks: { id: string; ok: boolean; detail: string }[] = [
    {
      id: 'shareoft_peer_matches_oft_store',
      ok: peerOk,
      detail: `peers(${SHARE_MESH_SOLANA_EID})=${peer} expected=${expectedPeer}`,
    },
    {
      id: 'solana_peer_matches_shareoft',
      ok: reversePeerOk,
      detail: `solanaPeer(${SHARE_MESH_BASE_EID})=${solanaPeer ?? 'missing'} expected=${expectedReversePeer}`,
    },
    {
      id: 'shareoft_enforced_options_template',
      ok: enforcedOk,
      detail: `enforcedOptions=${enforcedOptions} (expect gas=${200_000} value=${2_039_280})`,
    },
  ]

  let destAta: string | null = null
  let destAtaExists: boolean | null = null
  if (mint && dest) {
    const ata = getAssociatedTokenAddressSync(mint, dest, true, TOKEN_2022_PROGRAM_ID)
    destAta = ata.toBase58()
    const info = await connection.getAccountInfo(ata, 'confirmed')
    destAtaExists = Boolean(info)
    extraChecks.push({
      id: 'dest_ata_exists',
      ok: skipDestAta ? true : destAtaExists,
      detail: `ata=${destAta} exists=${destAtaExists}${skipDestAta ? ' (skipped via --skip-dest-ata)' : ''}`,
    })
  }

  const checks = [...pathway.checks, ...extraChecks]
  const ok = checks.every((c) => c.ok)

  const report = {
    ok,
    shareOft,
    oftStore: oftStore.toBase58(),
    owner,
    delegate,
    sendLib,
    receiveLib,
    eids: { base: SHARE_MESH_BASE_EID, solana: SHARE_MESH_SOLANA_EID },
    uln: {
      baseSend,
      solanaReceive,
      solanaSend,
      baseReceive,
    },
    solanaPeer,
    destAta,
    destAtaExists,
    checks,
    remediation: ok
      ? null
      : [
          'Copy docs/_internal/operations/templates/layerzero-share-mesh.config.ts → scaffold layerzero.config.ts',
          'Confirm pathway tuple is [15, 32] (never leave Base→Solana on default 10 while Solana inbound is 15)',
          'pnpm hardhat lz:oft:solana:init-config --oapp-config layerzero.config.ts --ci',
          'pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts --ci',
          'Ensure Solana OFT Peer(Base) = left-padded ShareOFT address',
          'Re-run this gate before Pipe A / finalize share bridge',
          'Ensure destination Token-2022 ATA exists (and TransferHook does not brick executor lzReceive)',
        ],
  }

  process.stdout.write(`${JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}\n`)
  if (!ok) {
    process.stderr.write('share-mesh LZ pathway NOT ready — do not bridge shares until green\n')
    process.exit(1)
  }
  process.stdout.write('share-mesh LZ pathway ready\n')
}

main().catch((error) => {
  process.stderr.write(
    `verify-share-mesh-lz-pathway failed: ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exit(1)
})
