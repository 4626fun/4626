#!/usr/bin/env tsx
/**
 * Ensure nested Ajna sleeve is ready for emergency exit:
 *   - acceptAdmin (if pending → automation Safe)
 *   - setKeeper(protocolAutomation, true)
 *   - optional legacy bucket → buffer drain when adapter lacks drainBucketsToBuffer
 *
 * Defaults to dry-run. Live Safe txs require:
 *   --execute --confirm=AJNA-EMERGENCY-READY
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/ensure-ajna-emergency-readiness.ts \
 *     --vault 0x... [--adapter 0x...] [--dry-run] [--no-drain]
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/ensure-ajna-emergency-readiness.ts \
 *     --vault 0x... --execute --confirm=AJNA-EMERGENCY-READY [--no-drain]
 */
import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import { readCliValue } from '../../server/_lib/ajnaVaultManager/emergencyUnwindGuards.js'
import { ensureAjnaEmergencyReadiness } from '../../server/_lib/ajnaVaultManager/ensureAjnaEmergencyReadiness.js'

function getArg(name: string): string {
  return readCliValue(process.argv, name)
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

async function main(): Promise<void> {
  const vaultRaw = getArg('--vault')
  if (!vaultRaw || !isAddress(vaultRaw)) {
    throw new Error('Usage: --vault 0x... [--adapter 0x...] [--dry-run|--execute] [--no-drain]')
  }
  const adapterRaw = getArg('--adapter')
  if (adapterRaw && !isAddress(adapterRaw)) throw new Error('Invalid --adapter')

  const execute = hasFlag('--execute')
  const dryRun = hasFlag('--dry-run') || !execute
  if (execute && getArg('--confirm') !== 'AJNA-EMERGENCY-READY') {
    throw new Error('Live readiness requires --confirm=AJNA-EMERGENCY-READY')
  }

  const rpcUrl =
    process.env.BASE_RPC_URL?.replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:')
      .replace('/ws/', '/rpc/') || 'https://mainnet.base.org'

  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const report = await ensureAjnaEmergencyReadiness({
    publicClient: publicClient as never,
    rpcUrl,
    vault: getAddress(vaultRaw),
    adapter: adapterRaw ? getAddress(adapterRaw as Address) : undefined,
    dryRun,
    drainBuckets: !hasFlag('--no-drain'),
  })

  process.stdout.write(
    `${JSON.stringify({ ok: true, mode: dryRun ? 'DRY_RUN' : 'EXECUTE', ...report }, null, 2)}\n`,
  )
}

main().catch((error) => {
  console.error((error as Error)?.message ?? error)
  process.exit(1)
})
