#!/usr/bin/env tsx
/**
 * Read-only plan for the AKITA-only CCA spoke fan-out from Base.
 *
 *   pnpm -C frontend ops:plan-akita-cca-spokes
 *
 * Prints per-spoke checklist + env pin names. Does not broadcast.
 */
import {
  CCA_LAUNCH_CHAINS,
  CCA_LAUNCH_CHAIN_KEYS,
  ZERO_ADDRESS,
  type CcaLaunchChainKey,
} from '../../src/config/ccaLaunchChains.ts'
import { AKITA_DEFAULTS, AKITA_EXPANSION_CHAIN_ENV_SUFFIX } from '../../src/config/contracts.defaults.ts'

declare const process: {
  stdout: { write: (chunk: string) => void }
  exit: (code?: number) => never
}

function main(): void {
  const spokes = CCA_LAUNCH_CHAIN_KEYS.filter((k) => k !== 'base') as CcaLaunchChainKey[]

  process.stdout.write('■AKITA CCA spoke fan-out plan (Base hub)\n')
  process.stdout.write(`Hub ShareOFT: ${AKITA_DEFAULTS.shareOFT}\n`)
  process.stdout.write(`Hub CCA arm:  ${AKITA_DEFAULTS.ccaLaunchArm}\n\n`)
  process.stdout.write('Preflight: pnpm -C frontend ops:verify-cca-multichain\n')
  process.stdout.write('Runbook:   docs/operations/cca-multichain-mainnet-runbook.md\n\n')

  for (const key of spokes) {
    const chain = CCA_LAUNCH_CHAINS[key]
    const suffix = AKITA_EXPANSION_CHAIN_ENV_SUFFIX[chain.chainId] ?? key.toUpperCase()
    process.stdout.write(`## ${chain.label} (chainId ${chain.chainId}, eid ${chain.eid})\n`)
    process.stdout.write(`- Factory target: ${chain.targetCcaFactoryVersion} ${chain.ccaFactoryV210}\n`)
    if (chain.ccaFactoryV210ExpectedEmptyPreBootstrap) {
      process.stdout.write('- BOOTSTRAP REQUIRED: deploy CCA v2.1.0 with protocolFeeController=address(0)\n')
    }
    process.stdout.write(`- defaultDuration: ${chain.defaultDurationBlocks} blocks\n`)
    if (chain.launchBlocksPerSecond > 0) {
      process.stdout.write(`- launchBlocksPerSecond: ${chain.launchBlocksPerSecond}\n`)
    } else {
      process.stdout.write(`- launchBlockTimeSeconds: ${chain.launchBlockTimeSeconds}\n`)
    }
    process.stdout.write('- Steps:\n')
    process.stdout.write(`  1. pnpm -C frontend ops:verify-cca-multichain --chain ${key}\n`)
    process.stdout.write('  2. Spoke registry + LZ endpoints (SeedRegistry4626 on spoke RPC)\n')
    process.stdout.write(`  3. forge script DeployRemoteShareOft (EXPECTED_CHAIN_ID=${chain.chainId})\n`)
    process.stdout.write('  4. Wire Base↔spoke ShareOFT peers (layerzero-evm-share-mesh; [15,15]; 3-of-5 DVN)\n')
    process.stdout.write('  5. SeedRegistry setRemoteOFTPeer on Base\n')
    process.stdout.write(
      `  6. forge script DeployRemoteCreatorOracle (EXPECTED_CHAIN_ID=${chain.chainId})\n` +
        `       SET_CHAINLINK_ETH_USD=${chain.chainlinkEthUsd}\n` +
        (chain.sequencerUptimeFeed !== ZERO_ADDRESS
          ? `       SET_SEQUENCER_UPTIME_FEED=${chain.sequencerUptimeFeed}\n`
          : '       (no sequencer feed pin on this chain)\n'),
    )
    process.stdout.write('  7. WireCreatorOracleHubSpokePeers hub + spoke (HUB_ORACLE Base AKITA oracle)\n')
    process.stdout.write('  8. Deploy CCALaunchArm only (setCcaFactoryV2 + schedule; fundsRecipient=arm)\n')
    process.stdout.write(
      `  9. ConfigureSpokeCcaOracle (POOL_MANAGER=${chain.poolManagerV4}; taxHook when ready)\n`,
    )
    process.stdout.write(' 10. BroadcastCreatorOracleAssetPrice from Base (DST_EIDS includes this eid)\n')
    process.stdout.write('     Hub vault/wrapper/gauge/Zora token stay on Base — not redeployed per spoke.\n')
    process.stdout.write(' 11. Pin env (spoke-minimal — only these two; oracle stays onchain-wired):\n')
    process.stdout.write(`       VITE_AKITA_SHARE_OFT_${suffix}=\n`)
    process.stdout.write(`       VITE_AKITA_CCA_STRATEGY_${suffix}=\n`)
    process.stdout.write('\n')
  }

  process.stdout.write('Deploy helper (still dry-run by default):\n')
  process.stdout.write('  pnpm -C frontend ops:deploy-akita-cca-spokes --dry-run\n')
  process.exit(0)
}

main()
