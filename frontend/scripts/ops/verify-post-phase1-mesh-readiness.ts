#!/usr/bin/env tsx
/**
 * After Phase 1 — verify new ShareOFT is ready for finalize bridge + print ops commands.
 *
 *   pnpm -C frontend ops:verify-post-phase1-mesh \
 *     --share-oft 0xNewShareOFT \
 *     --vault 0x... --wrapper 0x...
 *
 * Exit 0 = LZ quoteSend works (safe to finalize with mesh). Exit 1 = blocked (usually missing LZ Base wire).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const SHARE_MESH_MINT = '5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv'
const BATCHER_DEFAULT_PEER =
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
  if (!shareOftRaw || !vaultRaw || !wrapperRaw) {
    process.stdout.write(
      'Usage: pnpm -C frontend ops:verify-post-phase1-mesh \\\n' +
        '  --share-oft 0xNewShareOFT --vault 0xNewVault --wrapper 0xNewWrapper \\\n' +
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
    ccaStrategy: AKITA_DEFAULTS.ccaStrategy as Address,
    oracle: AKITA_DEFAULTS.oracle as Address,
    version: getArg('--version', 'v1.2.3x-akita-redeploy'),
    depositAmount: BigInt(getArg('--deposit-amount', String(50_000_000n * 10n ** 18n))),
    requiredRaise: BigInt(getArg('--required-raise', '100000000000000000')),
    floorPriceQ96: BigInt(getArg('--floor-price-q96', '1')),
    auctionSteps: '0x' as Hex,
    meteoraAlphaVault: `0x${'00'.repeat(32)}` as Hex,
    solanaIxs: [],
  }

  const finalizeCallData = buildFinalizePhase2CallData(finalizeParams)

  process.stdout.write('\n=== Post–Phase 1 mesh readiness ===\n\n')
  process.stdout.write(`ShareOFT: ${shareOft}\n`)
  process.stdout.write(`Batcher:  ${batcher}\n`)
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
        'Fix: batcher solanaShareOftPeer should already be set from Pipe A cutover. Re-run verify-batcher-pipe-a-readiness.\n\n',
      )
    }
    process.exit(1)
  }

  process.stdout.write(`✓ batcher default peer: ${wiring.batcherDefaultPeer ?? 'unset'}\n`)
  process.stdout.write(`✓ effective peer:     ${wiring.effectivePeer ?? 'unset'}\n`)
  process.stdout.write(`  ShareOFT peers():   ${wiring.shareOftPeer ?? 'unset (finalize may set)'}\n`)

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
  process.stdout.write(`✓ Bridge amount (30%):      ${quote.solanaAmount} LD\n\n`)
  process.stdout.write('SAFE TO FINALIZE (with mesh enabled) when Deploy UI Pipe A panel shows ready.\n\n')

  process.stdout.write('--- Vultr (after finalize, for keeper ticks) ---\n')
  process.stdout.write(
    `Merge into SOLANA_SHARE_OFT_MAPPING on /etc/4626/solana-keeper-orchestrator.env:\n`,
  )
  process.stdout.write(
    `  SOLANA_SHARE_OFT_MAPPING='{"${SHARE_MESH_MINT}":"${shareOft.toLowerCase()}"}'\n`,
  )
  process.stdout.write(`  (keep existing keys if other creators are live)\n`)
  process.stdout.write(`  sudo systemctl restart solana-keeper-orchestrator\n\n`)

  process.stdout.write('--- Composer mesh (protocol treasury Safe) ---\n')
  process.stdout.write(
    `pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts \\\n` +
      `  --share-mesh ${shareOft} \\\n` +
      `  --solana-share-peer ${BATCHER_DEFAULT_PEER} \\\n` +
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
