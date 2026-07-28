#!/usr/bin/env tsx
/**
 * After Phase 1 — verify new ShareOFT is ready for finalize bridge + print ops commands.
 *
 *   pnpm -C frontend ops:verify-post-phase1-mesh \
 *     --share-oft 0xNewShareOFT \
 *     --vault 0x... --wrapper 0x...
 *
 * Exit 0 = LZ quoteSend + ops:verify-share-mesh-lz ULN gate green. Exit 1 = blocked (peer/quote/ULN).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PublicKey } from '@solana/web3.js'
import { createPublicClient, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import {
  AKITA_DEFAULTS,
  BASE_DEFAULTS,
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
} from '../../src/config/contracts.defaults.js'
import {
  buildFinalizePhase2CallData,
  quoteFinalizeShareBridgeNativeFee,
  type FinalizePhase2Params,
} from '../../src/lib/deploy/finalizeShareBridgeFee.js'
import { readShareBridgeOftWiringStatus } from '../../src/lib/deploy/shareBridgeOftWiring.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')

const RETIRED_B1_SHARE_MESH_MINT = '5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv'
const RETIRED_B1_OFT_STORE = 'G3rfXFKvARH8emUVkiu6RrdSkXZQFGfsqKbF9P7EqXeN'
const RETIRED_B1_SHARE_PEER =
  '0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f'

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
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

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

function requireAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`Invalid ${label}: ${value}`)
  return getAddress(value)
}

async function main(): Promise<void> {
  const shareOftRaw = getArg('--share-oft')
  const vaultRaw = getArg('--vault')
  const wrapperRaw = getArg('--wrapper')
  const shareMeshMintRaw = getArg('--share-mesh-mint')
  const oftStoreRaw = getArg('--oft-store')
  const sharePeerRaw = getArg('--solana-share-peer').toLowerCase()
  if (!shareOftRaw || !vaultRaw || !wrapperRaw || !shareMeshMintRaw || !oftStoreRaw || !sharePeerRaw) {
    process.stdout.write(
      'Usage: pnpm -C frontend ops:verify-post-phase1-mesh \\\n' +
        '  --share-oft 0xNewShareOFT --vault 0xNewVault --wrapper 0xNewWrapper \\\n' +
        '  --share-mesh-mint <FRESH_TOKEN_2022_MINT> --oft-store <FRESH_OFT_STORE> \\\n' +
        '  --solana-share-peer <FRESH_OFT_STORE_BYTES32> \\\n' +
        '  [--creator 0x5b6741…] [--owner 0xYourCSW]\n',
    )
    process.exit(1)
  }

  const creator = requireAddress(getArg('--creator', AKITA_DEFAULTS.token), 'creator')
  const shareOft = requireAddress(shareOftRaw, 'share-oft')
  const vault = requireAddress(vaultRaw, 'vault')
  const wrapper = requireAddress(wrapperRaw, 'wrapper')
  const batcher = requireAddress(getArg('--batcher', SPLIT_PHASE1_DEPLOYMENT_BATCHER), 'batcher')
  const owner = requireAddress(
    getArg('--owner', '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'),
    'owner',
  )
  let shareMeshMint: PublicKey
  let oftStore: PublicKey
  try {
    shareMeshMint = new PublicKey(shareMeshMintRaw)
    oftStore = new PublicKey(oftStoreRaw)
  } catch {
    throw new Error('Invalid share-mesh mint or OFT Store Solana public key')
  }
  const sharePeer = sharePeerRaw
  const expectedPeer = `0x${Buffer.from(oftStore.toBytes()).toString('hex')}`
  if (!/^0x[0-9a-f]{64}$/.test(sharePeer) || sharePeer !== expectedPeer) {
    throw new Error(`OFT Store/peer mismatch: expected ${expectedPeer}`)
  }
  if (
    shareMeshMint.toBase58() === RETIRED_B1_SHARE_MESH_MINT ||
    oftStore.toBase58() === RETIRED_B1_OFT_STORE ||
    sharePeer === RETIRED_B1_SHARE_PEER
  ) {
    throw new Error('Retired AKITA B1 mint/store/peer cannot satisfy the B2 post-Phase-1 gate')
  }

  const rpc =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.VITE_BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'

  const client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 30_000 }) })

  const finalizeParams: FinalizePhase2Params = {
    creatorToken: creator,
    owner,
    vault,
    wrapper,
    shareOFT: shareOft,
    gaugeController: AKITA_DEFAULTS.gaugeController as Address,
    ccaLaunchArm: AKITA_DEFAULTS.ccaLaunchArm as Address,
    oracle: AKITA_DEFAULTS.oracle as Address,
    version: getArg('--version', 'v1.2.3x-akita-redeploy'),
    depositAmount: BigInt(getArg('--deposit-amount', String(50_000_000n * 10n ** 18n))),
    requiredRaise: BigInt(getArg('--required-raise', '100000000000000000')),
    floorPriceQ96: BigInt(getArg('--floor-price-q96', '1')),
    auctionSteps: '0x' as Hex,
  }

  const finalizeCallData = buildFinalizePhase2CallData(finalizeParams)

  process.stdout.write('\n=== Post–Phase 1 mesh readiness ===\n\n')
  process.stdout.write(`ShareOFT: ${shareOft}\n`)
  process.stdout.write(`Batcher:  ${batcher}\n`)
  process.stdout.write(`B2 mint:  ${shareMeshMint.toBase58()}\n`)
  process.stdout.write(`OFT Store:${oftStore.toBase58()}\n`)
  process.stdout.write(`RPC:      ${rpc}\n\n`)

  const wiring = await readShareBridgeOftWiringStatus({
    publicClient: client,
    batcherAddress: batcher,
    finalizeCallData,
    registryAddress: BASE_DEFAULTS.registry as Address,
  })

  if ('code' in wiring) {
    process.stdout.write(`✗ wiring: ${wiring.code} — ${wiring.message}\n\n`)
    if (wiring.code === 'oft_peer_not_configured') {
      process.stdout.write(
        'Fix: seed Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer) before finalize.\n' +
          'Batcher shell readiness (destination + OVault runtime): verify-batcher-pipe-a-readiness.ts\n' +
          'Runbook: docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md\n\n',
      )
    }
    process.exit(1)
  }

  process.stdout.write(`✓ registry peer:     ${wiring.registryPeer ?? 'unset'}\n`)
  process.stdout.write(`✓ effective peer:    ${wiring.effectivePeer ?? 'unset'}\n`)
  process.stdout.write(`  ShareOFT peers():  ${wiring.shareOftPeer ?? 'unset (finalize may set)'}\n`)

  const quote = await quoteFinalizeShareBridgeNativeFee({
    publicClient: client,
    batcherAddress: batcher,
    finalizeCallData,
    registryAddress: BASE_DEFAULTS.registry as Address,
  })

  if ('code' in quote) {
    process.stdout.write(`\n✗ LZ quote: ${quote.code} — ${quote.message}\n\n`)
    process.stdout.write('Most common fix after Phase 1:\n')
    process.stdout.write('  1. In your LZ scaffold, point layerzero.config.ts at this ShareOFT address\n')
    process.stdout.write('  2. pnpm hardhat lz:oft:solana:init-config --oapp-config layerzero.config.ts\n')
    process.stdout.write('  3. pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts\n')
    process.stdout.write('  4. Re-run this script until quoteSend succeeds\n\n')
    process.exit(1)
  }

  if (!quote.required) {
    process.stdout.write('\nℹ Bridge not required for this finalize shape (OVault runtime off or zero allocation).\n\n')
    process.exit(0)
  }

  process.stdout.write(`\n✓ LZ quoteSend native fee: ${quote.nativeFee} wei\n`)
  process.stdout.write(`✓ Bridge amount (30%):      ${quote.solanaAmount} LD\n`)

  process.stdout.write('\n=== Share-mesh LZ ULN pathway gate ===\n')
  const gate = spawnSync(
    'pnpm',
    [
      'exec',
      'tsx',
      'scripts/ops/verify-share-mesh-lz-pathway.ts',
      '--share-oft',
      shareOft,
      '--oft-store',
      oftStore.toBase58(),
      '--mint',
      shareMeshMint.toBase58(),
      ...(process.env.SOLANA_SHARE_DEST ? ['--dest', process.env.SOLANA_SHARE_DEST] : ['--skip-dest-ata']),
    ],
    { cwd: FRONTEND_ROOT, encoding: 'utf8', env: process.env },
  )
  if (gate.stdout) process.stdout.write(gate.stdout)
  if (gate.stderr) process.stderr.write(gate.stderr)
  if (gate.status !== 0) {
    process.stdout.write('\n✗ Share-mesh LZ ULN gate failed — do not finalize Pipe A until green.\n')
    process.stdout.write('  Fix: wire layerzero-share-mesh.config.ts [15,32] then re-run.\n\n')
    process.exit(1)
  }

  process.stdout.write('\nSAFE TO FINALIZE (with mesh enabled) when Deploy UI Pipe A panel shows ready.\n\n')

  process.stdout.write('--- Vultr (after finalize, for keeper ticks) ---\n')
  process.stdout.write(
    `Merge into SOLANA_SHARE_OFT_MAPPING on /etc/4626/solana-keeper-orchestrator.env:\n`,
  )
  process.stdout.write(
    `  SOLANA_SHARE_OFT_MAPPING='{"${shareMeshMint.toBase58()}":"${shareOft.toLowerCase()}"}'\n`,
  )
  process.stdout.write(`  (keep existing keys if other creators are live)\n`)
  process.stdout.write(`  sudo systemctl restart solana-keeper-orchestrator\n\n`)

  process.stdout.write('--- Composer mesh + registry peer ---\n')
  process.stdout.write(
    `Seed Registry4626.setRemoteOFTPeerBytes32(creator, 30168, peer) then:\n` +
      `pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts \\\n` +
      `  --share-mesh ${shareOft} \\\n` +
      `  --solana-share-peer ${sharePeer} \\\n` +
      `  --solana-eid 30168\n\n`,
  )

  process.stdout.write('--- Config / keeper (after addresses land) ---\n')
  process.stdout.write('  Update AKITA_DEFAULTS + pnpm -C frontend exec tsx scripts/ops/backfill-keepr-vault.ts --execute\n\n')
  process.exit(0)
}

main().catch((err) => {
  process.stdout.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
