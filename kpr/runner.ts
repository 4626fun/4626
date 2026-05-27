#!/usr/bin/env tsx
/**
 * Local KPR Workflow Runner
 *
 * Usage:
 *   tsx runner.ts [workflow-name] [--dry-run]
 *
 * No argument runs the unified workflow
 * (vault-keeper + payout-router-harvest + ajna-bucket-manager + charm-rebalance-manager + cca-finalization + keepr-action-queue).
 *
 * Examples:
 *   tsx runner.ts                        # Run everything
 *   tsx runner.ts --dry-run              # Dry-run everything
 *   tsx runner.ts vault-keeper           # Run just vault keeper
 *   tsx runner.ts ajna-bucket-manager    # Run just Ajna bucket manager
 *   tsx runner.ts charm-rebalance-manager # Run just Charm rebalance manager
 *   tsx runner.ts cca-finalization       # Run just CCA finalization
 *   tsx runner.ts payout-router-harvest  # Run just payout router harvest
 *   tsx runner.ts keepr-action-queue     # Run the Keepr action queue
 *   tsx runner.ts strategy-signal-listener # Run always-on strategy signal listener
 *   tsx runner.ts bridge-integrity-monitor # Run bridge integrity monitor
 *   tsx runner.ts vault-strategy-reallocator # Cross-strategy Charm/Ajna TVL rebalance
 *
 * Environment:
 *   - Loads .env file from kpr/ directory
 *   - Set DRY_RUN=true to skip onchain writes
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from kpr/ directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

// Parse CLI args
const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
const workflowName = args[0] || 'all';
const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

// Set dry-run mode globally
if (isDryRun) {
  process.env.DRY_RUN = 'true';
  console.log('DRY RUN MODE — onchain writes will be simulated\n');
}

async function main() {
  console.log(`Running: ${workflowName}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const startTime = Date.now();

  try {
    let workflow: { handler: () => Promise<void> };

    switch (workflowName) {
      case 'all':
        workflow = await import('./workflows/4626.workflow.js');
        break;
      case 'vault-keeper':
        workflow = await import('./workflows/vault-keeper.workflow.js');
        break;
      case 'ajna-bucket-manager':
        workflow = await import('./workflows/ajna-bucket-manager.workflow.js');
        break;
      case 'charm-rebalance-manager':
        workflow = await import('./workflows/charm-rebalance-manager.workflow.js');
        break;
      case 'cca-finalization':
        workflow = await import('./workflows/cca-finalization.workflow.js');
        break;
      case 'payout-router-harvest':
        workflow = await import('./workflows/payout-router-harvest.workflow.js');
        break;
      case 'keepr-action-queue':
        workflow = await import('./workflows/keepr-action-queue.workflow.js');
        break;
      case 'strategy-signal-listener':
        workflow = await import('./workflows/strategy-signal-listener.workflow.js');
        break;
      case 'bridge-integrity-monitor':
        workflow = await import('./workflows/bridge-integrity-monitor.workflow.js');
        break;
      case 'vault-strategy-reallocator':
        workflow = await import('./workflows/vault-strategy-reallocator.workflow.js');
        break;
      case 'keepr-solana-rebalance':
        workflow = await import('./workflows/keepr-solana-rebalance.workflow.js');
        break;
      default:
        console.error(`Unknown workflow: ${workflowName}`);
        console.error('');
        console.error('Available:');
        console.error(
          '  (no arg)             — run all (vault-keeper + payout-router-harvest + ajna-bucket-manager + charm-rebalance-manager + cca-finalization + keepr-action-queue)',
        );
        console.error('  vault-keeper         — tend/report per vault');
        console.error('  payout-router-harvest — claim + harvest payout-router balances');
        console.error('  ajna-bucket-manager  — liquidity-aware Ajna bucket management');
        console.error('  charm-rebalance-manager — trigger Charm rebalance on 10%+ price move');
        console.error('  cca-finalization     — finalize graduated CCAs');
        console.error('  keepr-action-queue   — process queued Keepr actions');
        console.error('  strategy-signal-listener — always-on WS listener for Ajna/Charm triggers');
        console.error('  bridge-integrity-monitor — monitor Solana bridge route/liveness integrity');
        console.error('  keepr-solana-rebalance   — bridge adapter-held CREATOR to Solana');
        console.error('  vault-strategy-reallocator — cross-strategy Charm/Ajna TVL rebalance');
        process.exit(1);
    }

    await workflow.handler();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nCompleted in ${elapsed}s`);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\nFailed after ${elapsed}s`);
    console.error(err);
    // FIX: LOW-01 — Differentiate retryable errors (exit 2) from fatal errors (exit 1)
    const message = err instanceof Error ? err.message : String(err);
    const isRetryable =
      message.includes('ETIMEDOUT') ||
      message.includes('ECONNREFUSED') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('timeout');
    process.exit(isRetryable ? 2 : 1);
  }
}

main();
