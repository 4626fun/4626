#!/usr/bin/env node
/**
 * Post mainnet hook upgrade checklist: bytecode class + orchestrator env guidance.
 *
 *   pnpm -C frontend ops:post-hook-upgrade-preflight
 *
 * Exit: 0 = canonical on-chain (ready for canonical keepers), 2 = legacy (upgrade pending)
 */

import {
  inspectHookMainnetBytecode,
  recommendedHookIxSchema,
} from './hookBytecodeClassify.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

function main(): void {
  const report = inspectHookMainnetBytecode()
  const schema = recommendedHookIxSchema(report.kind)

  process.stdout.write('\n=== post-hook-upgrade preflight ===\n\n')
  process.stdout.write(`On-chain: ${report.kind} (slot ${report.lastDeployedSlot ?? 'unknown'})\n`)
  process.stdout.write(`Recommended SOLANA_HOOK_IX_SCHEMA=${schema}\n\n`)

  process.stdout.write('Orchestrator (/etc/4626/solana-keeper-orchestrator.env):\n')
  if (schema === 'canonical') {
    process.stdout.write('  unset SOLANA_HOOK_IX_SCHEMA   # or SOLANA_HOOK_IX_SCHEMA=canonical\n')
    process.stdout.write('  SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0   # retired legacy action; keep off\n')
    process.stdout.write('  SOLANA_ORCHESTRATOR_SETTLE_FEES_ENABLED=1\n')
  } else {
    process.stdout.write('  SOLANA_HOOK_IX_SCHEMA=legacy   # required until mainnet upgrade\n')
    process.stdout.write('  SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0\n')
  }

  process.stdout.write('\nApply + restart:\n')
  process.stdout.write('  sudo bash kpr/deploy/seed-solana-orchestrator-env.sh \\\n')
  process.stdout.write('    --source /opt/4626/kpr/.env \\\n')
  process.stdout.write(`    --dest /etc/4626/solana-keeper-orchestrator.env \\\n`)
  process.stdout.write(`    --hook-schema ${schema === 'canonical' ? 'auto' : 'legacy'}\n`)
  process.stdout.write('  cd /opt/4626/kpr && pnpm preflight-orchestrator\n')
  process.stdout.write('  sudo systemctl restart solana-keeper-orchestrator\n')
  process.stdout.write('  curl -sS https://orchestrator.4626.fun/healthz\n\n')

  if (schema === 'canonical') {
    process.stdout.write('B2 remains BLOCKED here: this bytecode check does not authorize relay enablement.\n')
    process.stdout.write('Use docs/operations/solana-b2-production-gates.md and keep all B2 flags off until every gate passes.\n\n')
    process.stdout.write('PASS: mainnet hook upgraded — canonical ix schema confirmed only\n')
    process.exit(0)
  }

  process.stderr.write('BLOCKED: mainnet hook still legacy — run upgrade-mainnet.sh --execute first\n')
  process.exit(2)
}

main()
