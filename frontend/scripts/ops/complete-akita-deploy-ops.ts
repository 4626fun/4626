#!/usr/bin/env tsx
/**
 * AKITA redeploy — run all automatable ops after deploy milestones.
 *
 *   # Before you start
 *   pnpm -C frontend ops:complete-akita-deploy prelaunch
 *
 *   # Right after Phase 1 (paste addresses from deploy UI)
 *   pnpm -C frontend ops:complete-akita-deploy post-phase1 \\
 *     --share-oft 0x... --vault 0x... --wrapper 0x... \\
 *     --gauge 0x... --cca 0x... --oracle 0x... \\
 *     --update-vultr
 *
 *   # Right after finalize + settlement
 *   pnpm -C frontend ops:complete-akita-deploy post-finalize \\
 *     --share-oft 0x... --vault 0x... --wrapper 0x... \\
 *     --gauge 0x... --cca 0x... --oracle 0x... \\
 *     --update-vultr --backfill --write-defaults
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { encodeFunctionData, getAddress, isAddress, type Address } from 'viem'

import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')
const SHARE_MESH_MINT = '5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv'
const BATCHER_DEFAULT_PEER =
  '0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f'
const HUB_COMPOSER = '0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1'

type DeployAddresses = {
  shareOft: Address
  vault: Address
  wrapper: Address
  gauge: Address
  cca: Address
  oracle: Address
  creator: Address
}

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

function run(cmd: string, args: string[], cwd = REPO_ROOT): boolean {
  process.stdout.write(`\n$ ${cmd} ${args.join(' ')}\n`)
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'inherit' })
  return result.status === 0
}

function requireAddresses(): DeployAddresses {
  const required = [
    ['--share-oft', 'shareOft'],
    ['--vault', 'vault'],
    ['--wrapper', 'wrapper'],
  ] as const
  const out: Partial<DeployAddresses> = {
    creator: getAddress(AKITA_DEFAULTS.token as Address),
  }
  for (const [flag, key] of required) {
    const raw = getArg(flag)
    if (!raw || !isAddress(raw)) {
      process.stdout.write(`Missing or invalid ${flag}\n`)
      process.exit(1)
    }
    out[key] = getAddress(raw)
  }
  out.gauge = isAddress(getArg('--gauge'))
    ? getAddress(getArg('--gauge'))
    : (AKITA_DEFAULTS.gaugeController as Address)
  out.cca = isAddress(getArg('--cca'))
    ? getAddress(getArg('--cca'))
    : (AKITA_DEFAULTS.ccaStrategy as Address)
  out.oracle = isAddress(getArg('--oracle'))
    ? getAddress(getArg('--oracle'))
    : (AKITA_DEFAULTS.oracle as Address)
  return out as DeployAddresses
}

function printLzWireBlock(shareOft: Address): void {
  process.stdout.write('\n--- MANUAL (once per new ShareOFT): LayerZero Base wire ---\n')
  process.stdout.write(`Target ShareOFT: ${shareOft}\n`)
  process.stdout.write('In your LZ scaffold (e.g. /tmp/4626-oft-mainnet):\n')
  process.stdout.write('  1. Point layerzero.config.ts at this ShareOFT contract\n')
  process.stdout.write('  2. pnpm hardhat lz:oft:solana:init-config --oapp-config layerzero.config.ts\n')
  process.stdout.write('  3. pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts\n')
  process.stdout.write('  4. Re-run post-phase1 until mesh verify passes\n\n')
}

function printComposerBlock(addrs: DeployAddresses): void {
  const setBeneficiaryData = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'setBeneficiaryOperator',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'operator', type: 'address' },
          { name: 'status', type: 'bool' },
        ],
        outputs: [],
      },
    ],
    functionName: 'setBeneficiaryOperator',
    args: [getAddress(HUB_COMPOSER), true],
  })

  process.stdout.write('\n--- After finalize: wrapper owner tx (your CSW) ---\n')
  process.stdout.write(`Wrapper ${addrs.wrapper} → setBeneficiaryOperator(${HUB_COMPOSER}, true)\n`)
  process.stdout.write(`${setBeneficiaryData}\n\n`)

  process.stdout.write('--- After finalize: protocol treasury Safe ---\n')
  process.stdout.write(
    `pnpm -C frontend exec tsx scripts/ops/plan-akita-share-mesh-phase-a.ts \\\n` +
      `  --share-mesh ${addrs.shareOft} \\\n` +
      `  --solana-share-peer ${BATCHER_DEFAULT_PEER} \\\n` +
      `  --solana-eid 30168\n\n`,
  )
}

function writeDefaultsPatch(addrs: DeployAddresses): void {
  const defaultsPath = resolve(FRONTEND_ROOT, 'src/config/contracts.defaults.ts')
  let text = readFileSync(defaultsPath, 'utf8')
  const replaceAddr = (label: string, oldVal: string, newVal: Address) => {
    const pattern = new RegExp(`(${label}:\\s*addr\\(')[a-fA-F0-9]{40}('\\))`, 'g')
    text = text.replace(pattern, `$1${newVal.slice(2)}$2`)
  }
  replaceAddr('vault', AKITA_DEFAULTS.vault.slice(2), addrs.vault)
  replaceAddr('wrapper', AKITA_DEFAULTS.wrapper.slice(2), addrs.wrapper)
  replaceAddr('shareOFT', AKITA_DEFAULTS.shareOFT.slice(2), addrs.shareOft)
  replaceAddr('gaugeController', AKITA_DEFAULTS.gaugeController.slice(2), addrs.gauge)
  replaceAddr('ccaStrategy', AKITA_DEFAULTS.ccaStrategy.slice(2), addrs.cca)
  replaceAddr('oracle', AKITA_DEFAULTS.oracle.slice(2), addrs.oracle)
  writeFileSync(defaultsPath, text)
  process.stdout.write(`✓ Updated ${defaultsPath} (AKITA_DEFAULTS + ERC4626_DEFAULTS aliases)\n`)
}

function saveStateFile(phase: string, addrs: DeployAddresses): void {
  const outDir = resolve(FRONTEND_ROOT, 'scripts/ops/.akita-redeploy-state')
  mkdirSync(outDir, { recursive: true })
  const path = resolve(outDir, `${phase}.json`)
  writeFileSync(
    path,
    `${JSON.stringify({ phase, savedAt: new Date().toISOString(), addresses: addrs, shareMeshMint: SHARE_MESH_MINT }, null, 2)}\n`,
  )
  process.stdout.write(`Saved state: ${path}\n`)
}

function cmdPrelaunch(): void {
  const ok = run('pnpm', ['-C', 'frontend', 'ops:verify-akita-prelaunch', '--production'])
  process.exit(ok ? 0 : 1)
}

function cmdPostPhase1(): void {
  const addrs = requireAddresses()
  saveStateFile('post-phase1', addrs)

  const meshOk = run('pnpm', [
    '-C',
    'frontend',
    'exec',
    'tsx',
    'scripts/ops/verify-post-phase1-mesh-readiness.ts',
    '--share-oft',
    addrs.shareOft,
    '--vault',
    addrs.vault,
    '--wrapper',
    addrs.wrapper,
  ])

  if (hasFlag('--update-vultr')) {
    run('pnpm', [
      '-C',
      'frontend',
      'ops:update-vultr-mapping',
      '--mint',
      SHARE_MESH_MINT,
      '--share-oft',
      addrs.shareOft,
    ])
  } else {
    process.stdout.write('\nTip: add --update-vultr to push mapping to orchestrator automatically.\n')
  }

  if (!meshOk) {
    printLzWireBlock(addrs.shareOft)
    process.stdout.write('Blocked: fix LZ wire, then re-run post-phase1 before finalize.\n\n')
    process.exit(1)
  }

  process.stdout.write('\n✓ Post–Phase 1 complete. Deploy UI Pipe A panel should show ready — proceed to finalize.\n\n')
  process.exit(0)
}

function cmdPostFinalize(): void {
  const addrs = requireAddresses()
  saveStateFile('post-finalize', addrs)

  if (hasFlag('--update-vultr')) {
    run('pnpm', [
      '-C',
      'frontend',
      'ops:update-vultr-mapping',
      '--mint',
      SHARE_MESH_MINT,
      '--share-oft',
      addrs.shareOft,
    ])
  }

  if (hasFlag('--backfill')) {
    run('pnpm', [
      '-C',
      'frontend',
      'exec',
      'tsx',
      'scripts/ops/backfill-keepr-vault.ts',
      '--vault',
      addrs.vault,
      '--creator',
      addrs.creator,
      '--execute',
    ])
  } else {
    process.stdout.write('\nTip: add --backfill to upsert keepr_vaults (settlement may also auto-bootstrap).\n')
  }

  if (hasFlag('--write-defaults')) {
    writeDefaultsPatch(addrs)
    process.stdout.write('Commit + push + Vercel production deploy to publish new defaults.\n')
  }

  printComposerBlock(addrs)
  process.stdout.write('\n✓ Post-finalize automatable ops done. Submit wrapper + Safe txs above, then commit defaults if --write-defaults.\n\n')
  process.exit(0)
}

function main(): void {
  const sub = process.argv[2]
  if (sub === 'prelaunch') return cmdPrelaunch()
  if (sub === 'post-phase1') return cmdPostPhase1()
  if (sub === 'post-finalize') return cmdPostFinalize()

  process.stdout.write(`Usage:
  pnpm -C frontend ops:complete-akita-deploy prelaunch

  pnpm -C frontend ops:complete-akita-deploy post-phase1 \\
    --share-oft 0x... --vault 0x... --wrapper 0x... \\
    [--gauge 0x... --cca 0x... --oracle 0x...] \\
    [--update-vultr]

  pnpm -C frontend ops:complete-akita-deploy post-finalize \\
    --share-oft 0x... --vault 0x... --wrapper 0x... \\
    [--gauge 0x... --cca 0x... --oracle 0x...] \\
    [--update-vultr] [--backfill] [--write-defaults]
`)
  process.exit(1)
}

main()
