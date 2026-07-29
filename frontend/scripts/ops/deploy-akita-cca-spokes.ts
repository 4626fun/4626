#!/usr/bin/env tsx
/**
 * AKITA CCA spoke fan-out helper.
 *
 * Default is dry-run (preflight + checklist).
 * `--print-commands` emits copy-paste forge env blocks with chain pins filled in.
 * `--broadcast --stage ensure-registry` runs EnsureSpokeRegistry per spoke when
 * PRIVATE_KEY is present (still refuses to invent CREATE2 salts / OFT code ids).
 *
 *   pnpm -C frontend ops:deploy-akita-cca-spokes
 *   pnpm -C frontend ops:deploy-akita-cca-spokes --print-commands --chain arbitrum
 *   pnpm -C frontend ops:deploy-akita-cca-spokes --broadcast --stage ensure-registry --chain arbitrum
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CCA_FACTORY_V210,
  CCA_LAUNCH_CHAINS,
  CCA_LAUNCH_CHAIN_KEYS,
  ZERO_ADDRESS,
  type CcaLaunchChainKey,
} from '../../src/config/ccaLaunchChains.ts'
import { AKITA_DEFAULTS, AKITA_EXPANSION_CHAIN_ENV_SUFFIX } from '../../src/config/contracts.defaults.ts'

declare const process: {
  argv: string[]
  cwd: () => string
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')

type Stage = 'ensure-registry'

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

function runPreflight(chain?: CcaLaunchChainKey): number {
  const args = ['exec', 'tsx', 'scripts/ops/verify-cca-multichain-preflight.ts']
  if (chain) args.push('--chain', chain)
  const result = spawnSync('pnpm', args, {
    cwd: FRONTEND_ROOT,
    encoding: 'utf8',
    env: process.env,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stdout.write(result.stderr)
  return result.status ?? 1
}

function rpcFor(key: CcaLaunchChainKey): string {
  const chain = CCA_LAUNCH_CHAINS[key]
  return process.env[chain.rpcEnvKey]?.trim() || chain.defaultRpcUrl
}

function printCommands(keys: CcaLaunchChainKey[]): void {
  const hubOracle = process.env.HUB_ORACLE?.trim() || AKITA_DEFAULTS.oracle
  process.stdout.write('\n=== Copy-paste forge recipe (fill PRIVATE_KEY + CREATE2 salts/codeIds) ===\n')
  process.stdout.write(`# Hub ShareOFT ${AKITA_DEFAULTS.shareOFT}\n`)
  process.stdout.write(`# Hub CCA     ${AKITA_DEFAULTS.ccaLaunchArm}\n`)
  process.stdout.write(`# Hub oracle  ${hubOracle}\n`)
  process.stdout.write(`# CCA factory ${CCA_FACTORY_V210}\n\n`)

  for (const key of keys) {
    const chain = CCA_LAUNCH_CHAINS[key]
    const suffix = AKITA_EXPANSION_CHAIN_ENV_SUFFIX[chain.chainId] ?? key.toUpperCase()
    const rpc = `$${chain.rpcEnvKey}`
    process.stdout.write(`# --- ${chain.label} (chainId ${chain.chainId}, eid ${chain.eid}) ---\n`)
    if (chain.ccaFactoryV210ExpectedEmptyPreBootstrap) {
      process.stdout.write('# BOOTSTRAP CCA factory v2.1.0 with protocolFeeController=address(0) first\n')
    }
    process.stdout.write(
      `EXPECTED_CHAIN_ID=${chain.chainId} forge script script/EnsureSpokeRegistry.s.sol:EnsureSpokeRegistry \\\n` +
        `  --rpc-url ${rpc} --broadcast -vvvv\n\n`,
    )
    process.stdout.write(
      `# DeployRemoteShareOft (salts/codeIds from Base AKITA phase-1)\n` +
        `EXPECTED_CHAIN_ID=${chain.chainId} HUB_SHARE_OFT=${AKITA_DEFAULTS.shareOFT} \\\n` +
        `  forge script script/DeployRemoteShareOft.s.sol:DeployRemoteShareOft \\\n` +
        `  --rpc-url ${rpc} --broadcast -vvvv\n\n`,
    )
    process.stdout.write(
      `WIRE_SIDE=hub SPOKE_EID=${chain.eid} HUB_SHARE_OFT=${AKITA_DEFAULTS.shareOFT} SPOKE_SHARE_OFT=<spoke> \\\n` +
        `  forge script script/WireShareOftHubSpokePeers.s.sol --rpc-url $BASE_RPC_URL --broadcast\n` +
        `WIRE_SIDE=spoke HUB_SHARE_OFT=${AKITA_DEFAULTS.shareOFT} SPOKE_SHARE_OFT=<spoke> \\\n` +
        `  forge script script/WireShareOftHubSpokePeers.s.sol --rpc-url ${rpc} --broadcast\n` +
        `# Also apply layerzero-evm-share-mesh DVN config ([15,15], 3-of-5)\n\n`,
    )
    process.stdout.write(
      `EXPECTED_CHAIN_ID=${chain.chainId} \\\n` +
        `SET_CHAINLINK_ETH_USD=${chain.chainlinkEthUsd} \\\n` +
        (chain.sequencerUptimeFeed !== ZERO_ADDRESS
          ? `SET_SEQUENCER_UPTIME_FEED=${chain.sequencerUptimeFeed} \\\n`
          : '') +
        `HUB_ORACLE=${hubOracle} \\\n` +
        `  forge script script/DeployRemoteCreatorOracle.s.sol:DeployRemoteCreatorOracle \\\n` +
        `  --rpc-url ${rpc} --broadcast -vvvv\n\n`,
    )
    process.stdout.write(
      `WIRE_SIDE=hub SPOKE_EID=${chain.eid} HUB_ORACLE=${hubOracle} SPOKE_ORACLE=<spoke> \\\n` +
        `  forge script script/WireCreatorOracleHubSpokePeers.s.sol --rpc-url $BASE_RPC_URL --broadcast\n` +
        `WIRE_SIDE=spoke HUB_ORACLE=${hubOracle} SPOKE_ORACLE=<spoke> \\\n` +
        `  forge script script/WireCreatorOracleHubSpokePeers.s.sol --rpc-url ${rpc} --broadcast\n\n`,
    )
    process.stdout.write(
      `# Deploy CCALaunchArm (setCcaFactoryV2 + schedule), then:\n` +
        `CCA_ARM=<spoke-arm> ORACLE=<spoke-oracle> POOL_MANAGER=${chain.poolManagerV4} \\\n` +
        `TAX_HOOK=${chain.taxHook} EXPECTED_CHAIN_ID=${chain.chainId} \\\n` +
        `  forge script script/ConfigureSpokeCcaOracle.s.sol:ConfigureSpokeCcaOracle \\\n` +
        `  --rpc-url ${rpc} --broadcast -vvvv\n\n`,
    )
    process.stdout.write(
      `DST_EIDS=${chain.eid} HUB_ORACLE=${hubOracle} \\\n` +
        `  forge script script/BroadcastCreatorOracleAssetPrice.s.sol \\\n` +
        `  --rpc-url $BASE_RPC_URL --broadcast -vvvv\n\n`,
    )
    process.stdout.write(
      `# Pin VITE_AKITA_SHARE_OFT_${suffix}=… VITE_AKITA_CCA_STRATEGY_${suffix}=…\n\n`,
    )
  }
}

function broadcastEnsureRegistry(keys: CcaLaunchChainKey[]): number {
  if (!process.env.PRIVATE_KEY?.trim()) {
    process.stdout.write('ERROR: PRIVATE_KEY required for --broadcast --stage ensure-registry\n')
    return 1
  }

  let failed = 0
  for (const key of keys) {
    const chain = CCA_LAUNCH_CHAINS[key]
    const rpc = rpcFor(key)
    process.stdout.write(`\n=== BROADCAST ensure-registry: ${chain.label} ===\n`)
    const result = spawnSync(
      'forge',
      [
        'script',
        'script/EnsureSpokeRegistry.s.sol:EnsureSpokeRegistry',
        '--rpc-url',
        rpc,
        '--broadcast',
        '-vvvv',
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          EXPECTED_CHAIN_ID: String(chain.chainId),
        },
      },
    )
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stdout.write(result.stderr)
    if ((result.status ?? 1) !== 0) {
      process.stdout.write(`FAIL ensure-registry on ${chain.label} (exit ${result.status})\n`)
      failed = result.status ?? 1
      break
    }
  }
  return failed
}

function main(): void {
  const only = getArg('--chain') as CcaLaunchChainKey | ''
  const printCmds = hasFlag('--print-commands')
  const broadcast = hasFlag('--broadcast')
  const stage = getArg('--stage') as Stage | ''
  const keys = (only
    ? CCA_LAUNCH_CHAIN_KEYS.filter((k) => k === only && k !== 'base')
    : CCA_LAUNCH_CHAIN_KEYS.filter((k) => k !== 'base')) as CcaLaunchChainKey[]

  if (only && keys.length === 0) {
    process.stdout.write(`Unknown or non-spoke --chain ${only}. Valid: ethereum, arbitrum, unichain, robinhood\n`)
    process.exit(1)
  }

  process.stdout.write('■AKITA CCA spoke deploy helper\n')
  process.stdout.write(
    `Mode: ${broadcast ? `BROADCAST${stage ? ` (${stage})` : ''}` : printCmds ? 'PRINT-COMMANDS' : 'DRY-RUN'}\n`,
  )
  process.stdout.write(`Hub ShareOFT: ${AKITA_DEFAULTS.shareOFT}\n`)
  process.stdout.write(`Hub CCA arm:  ${AKITA_DEFAULTS.ccaLaunchArm}\n`)
  process.stdout.write(`Hub oracle:   ${AKITA_DEFAULTS.oracle}\n\n`)

  process.stdout.write('=== Preflight ===\n')
  const preflightCode = only ? runPreflight(only as CcaLaunchChainKey) : runPreflight()
  if (preflightCode !== 0) {
    process.stdout.write('Preflight FAIL — fix factory/fee/poolManager/LZ before continuing.\n')
    process.exit(preflightCode)
  }

  for (const key of keys) {
    const chain = CCA_LAUNCH_CHAINS[key]
    const suffix = AKITA_EXPANSION_CHAIN_ENV_SUFFIX[chain.chainId] ?? key.toUpperCase()
    process.stdout.write(`\n=== ${chain.label} ===\n`)
    if (chain.ccaFactoryV210ExpectedEmptyPreBootstrap) {
      process.stdout.write('BLOCKER: bootstrap CCA factory v2.1.0 (feeController=0) before OFT/arm deploy.\n')
    }
    process.stdout.write(`NEXT: EnsureSpokeRegistry EXPECTED_CHAIN_ID=${chain.chainId}\n`)
    process.stdout.write(`NEXT: DeployRemoteShareOft EXPECTED_CHAIN_ID=${chain.chainId}\n`)
    process.stdout.write('NEXT: Wire Base↔spoke ShareOFT peers ([15,15], 3-of-5)\n')
    process.stdout.write(
      `NEXT: DeployRemoteCreatorOracle EXPECTED_CHAIN_ID=${chain.chainId}` +
        ` SET_CHAINLINK_ETH_USD=${chain.chainlinkEthUsd}\n`,
    )
    process.stdout.write(`NEXT: WireCreatorOracleHubSpokePeers (hub Base + spoke eid ${chain.eid})\n`)
    process.stdout.write('NEXT: Deploy CCALaunchArm only (no vault/wrapper/gauge/token on spoke)\n')
    process.stdout.write(
      `NEXT: ConfigureSpokeCcaOracle POOL_MANAGER=${chain.poolManagerV4} TAX_HOOK=${chain.taxHook}\n`,
    )
    process.stdout.write(`NEXT: BroadcastCreatorOracleAssetPrice DST_EIDS+=${chain.eid}\n`)
    process.stdout.write(`NEXT: Pin VITE_AKITA_SHARE_OFT_${suffix} + VITE_AKITA_CCA_STRATEGY_${suffix}\n`)
  }

  if (printCmds) {
    printCommands(keys)
    process.exit(0)
  }

  if (!broadcast) {
    process.stdout.write(
      '\nDRY-RUN complete. Next:\n' +
        '  pnpm -C frontend ops:deploy-akita-cca-spokes --print-commands\n' +
        '  pnpm -C frontend ops:deploy-akita-cca-spokes --broadcast --stage ensure-registry [--chain …]\n' +
        'Full CREATE2 OFT/oracle/arm still needs salts/codeIds — see runbook.\n',
    )
    process.exit(0)
  }

  if (stage === 'ensure-registry') {
    const code = broadcastEnsureRegistry(keys)
    process.exit(code)
  }

  process.stdout.write(
    'ERROR: --broadcast requires --stage ensure-registry (OFT/oracle/arm CREATE2 not auto-wired — use --print-commands).\n',
  )
  process.exit(1)
}

main()
