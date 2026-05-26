#!/usr/bin/env tsx
/**
 * Read-only Phase A checklist for AKITA share mesh + optional calldata preview.
 *
 *   pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts
 *
 * When Solana mesh mints/peers exist, pass them to preview Safe calldata:
 *
 *   pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts \\
 *     --asset-mesh 0x... --share-mesh 0x... \\
 *     --solana-asset-peer 0x... --solana-share-peer 0x... \\
 *     --solana-eid 30168
 */
import { encodeFunctionData, getAddress, isAddress, type Address, zeroAddress } from 'viem'
import { AKITA_DEFAULTS, BASE_DEFAULTS, SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { spawnSync } from 'node:child_process'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const HUB_COMPOSER = (process.env.OVAULT_HUB_COMPOSER ??
  '0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1') as Address

const configureCreatorMeshAbi = [
  {
    type: 'function',
    name: 'configureCreatorMesh',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'creatorToken', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'assetMeshToken', type: 'address' },
      { name: 'shareMeshToken', type: 'address' },
      { name: 'solanaEid', type: 'uint32' },
      { name: 'solanaAssetPeer', type: 'bytes32' },
      { name: 'solanaSharePeer', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

const setOVaultRuntimeConfigAbi = [
  {
    type: 'function',
    name: 'setOVaultRuntimeConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_hubComposer', type: 'address' },
      { name: '_solanaEid', type: 'uint32' },
      { name: '_enabled', type: 'bool' },
    ],
    outputs: [],
  },
] as const

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function normalizeAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`Invalid ${label}: ${value}`)
  return getAddress(value) as Address
}

function assertBytes32(raw: string, label: string): `0x${string}` {
  const value = raw.trim().toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(value)) throw new Error(`Invalid ${label}: ${raw}`)
  return value as `0x${string}`
}

function parseUint32(raw: string, label: string): number {
  const n = Number(raw.trim())
  if (!Number.isFinite(n) || n < 0 || n > 0xffffffff || !Number.isInteger(n)) {
    throw new Error(`Invalid ${label}: ${raw}`)
  }
  return n
}

function main() {
  if (hasFlag('--help')) {
    process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts [options]

Options:
  --asset-mesh <address>         Base asset mesh OFT (required for calldata preview)
  --share-mesh <address>         Base share mesh OFT (required for calldata preview)
  --solana-asset-peer <bytes32>  LZ peer for asset mesh on Solana
  --solana-share-peer <bytes32>  LZ peer for share mesh on Solana
  --solana-eid <n>               Solana EID (default: OVAULT_SOLANA_EID or 30168)
  --skip-onchain-read            Skip read-akita-ovault-mesh-onchain.ts subprocess
  --help                         Show this help
`)
    return
  }

  const creator = AKITA_DEFAULTS.token as Address
  const vault = AKITA_DEFAULTS.vault as Address
  const shareOft = AKITA_DEFAULTS.shareOFT as Address
  const wrapper = AKITA_DEFAULTS.wrapper as Address
  const batcher = SPLIT_PHASE1_DEPLOYMENT_BATCHER as Address
  const adapter = BASE_DEFAULTS.solanaBridgeAdapter as Address
  const solanaEid = parseUint32(getArg('--solana-eid', process.env.OVAULT_SOLANA_EID || '30168'), 'solana-eid')

  process.stdout.write('\n=== AKITA share-mesh Phase A plan ===\n\n')
  process.stdout.write(`Policy: docs/operations/solana-share-mesh-lottery-policy.md\n`)
  process.stdout.write(`Creator:  ${creator}\n`)
  process.stdout.write(`Vault:    ${vault}\n`)
  process.stdout.write(`Wrapper:  ${wrapper}\n`)
  process.stdout.write(`ShareOFT: ${shareOft}\n`)
  process.stdout.write(`Composer: ${HUB_COMPOSER}\n`)
  process.stdout.write(`Batcher:  ${batcher}\n`)
  process.stdout.write(`Adapter:  ${adapter}\n\n`)

  if (!hasFlag('--skip-onchain-read')) {
    process.stdout.write('--- On-chain read (read-akita-ovault-mesh-onchain.ts) ---\n\n')
    const read = spawnSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/ops/read-akita-ovault-mesh-onchain.ts'],
      { cwd: new URL('../..', import.meta.url).pathname, stdio: 'inherit', env: process.env },
    )
    if (read.status !== 0) {
      process.stdout.write('\nOn-chain read failed — continue with checklist using last known audit.\n\n')
    }
  }

  process.stdout.write('--- Known blockers (2026-05-25 audit) ---\n\n')
  process.stdout.write('1. creatorMesh(AKITA) unset on OVaultHubComposer\n')
  process.stdout.write('2. Split batcher OVault runtime disabled (hubComposer=0)\n')
  process.stdout.write('3. Grandfathered AKITA wrapper lacks isBeneficiaryOperator — configureCreatorMesh reverts until wrapper upgrade/wiring\n')
  process.stdout.write('4. Solana LZ asset mesh + share mesh mints/peers not recorded in repo env yet\n')
  process.stdout.write('5. ShareOFT not registered on canonical SolanaBridgeAdapter\n')
  process.stdout.write('6. relay_entries paused on Vultr; Vercel cron should omit relay_entries\n\n')

  process.stdout.write('--- Operator sequence ---\n\n')
  process.stdout.write('A. Deploy/peers: Solana asset mesh + share mesh OFTs (LayerZero), record Base addresses + Solana peers\n')
  process.stdout.write('B. Wrapper: upgrade AKITA wrapper OR set composer as beneficiary operator (ComposerNotBeneficiaryOperator guard)\n')
  process.stdout.write('C. Composer owner: configureCreatorMesh(...)\n')
  process.stdout.write('D. Batcher owner: setOVaultRuntimeConfig(hubComposer, 30168, true)\n')
  process.stdout.write('E. Bridge ShareOFT Base → Solana share mesh (seed LP later in Phase B)\n\n')

  const assetMesh = getArg('--asset-mesh')
  const shareMesh = getArg('--share-mesh')
  const assetPeer = getArg('--solana-asset-peer')
  const sharePeer = getArg('--solana-share-peer')

  if (!assetMesh || !shareMesh || !assetPeer || !sharePeer) {
    process.stdout.write(
      'Calldata preview skipped — pass --asset-mesh, --share-mesh, --solana-asset-peer, --solana-share-peer when mesh tokens exist.\n',
    )
    process.stdout.write(
      'Existing helper: pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts --only-ovault-runtime --ovault-hub-composer <composer> --ovault-solana-eid 30168\n\n',
    )
    return
  }

  const configureData = encodeFunctionData({
    abi: configureCreatorMeshAbi,
    functionName: 'configureCreatorMesh',
    args: [
      creator,
      vault,
      normalizeAddress(assetMesh, 'asset-mesh'),
      normalizeAddress(shareMesh, 'share-mesh'),
      solanaEid,
      assertBytes32(assetPeer, 'solana-asset-peer'),
      assertBytes32(sharePeer, 'solana-share-peer'),
    ],
  })

  const runtimeData = encodeFunctionData({
    abi: setOVaultRuntimeConfigAbi,
    functionName: 'setOVaultRuntimeConfig',
    args: [HUB_COMPOSER, solanaEid, true],
  })

  process.stdout.write('--- Calldata preview (submit via protocol treasury Safe) ---\n\n')
  process.stdout.write(`configureCreatorMesh → ${HUB_COMPOSER}\n${configureData}\n\n`)
  process.stdout.write(`setOVaultRuntimeConfig → ${batcher}\n${runtimeData}\n\n`)
  process.stdout.write(
    'Warning: configureCreatorMesh reverts with ComposerNotBeneficiaryOperator until AKITA wrapper wires the composer as beneficiary operator.\n',
  )
}

main()
