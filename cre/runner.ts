#!/usr/bin/env tsx
/**
 * Local CRE Workflow Runner
 *
 * Usage:
 *   tsx runner.ts [workflow-name] [--dry-run]
 *
 * No argument runs the unified workflow
 * (vault-keeper + ajna-bucket-manager + auction-settlement + keepr-queue).
 *
 * Examples:
 *   tsx runner.ts                        # Run everything
 *   tsx runner.ts --dry-run              # Dry-run everything
 *   tsx runner.ts vault-keeper           # Run just vault keeper
 *   tsx runner.ts ajna-bucket-manager    # Run just Ajna bucket manager
 *   tsx runner.ts auction-settlement     # Run just auction settlement
 *   tsx runner.ts keepr-queue            # Run just the keepr queue processor
 *
 * Environment:
 *   - Loads .env file from cre/ directory
 *   - Set DRY_RUN=true to skip onchain writes
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from cre/ directory
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
      case 'auction-settlement':
        workflow = await import('./workflows/auction-settlement.workflow.js');
        break;
      case 'keepr-queue':
        workflow = await import('./workflows/keepr-queue-executor.workflow.js');
        break;
      default:
        console.error(`Unknown workflow: ${workflowName}`);
        console.error('');
        console.error('Available:');
        console.error(
          '  (no arg)             — run all (vault-keeper + ajna-bucket-manager + auction-settlement + keepr-queue)',
        );
        console.error('  vault-keeper         — tend/report per vault');
        console.error('  ajna-bucket-manager  — liquidity-aware Ajna bucket management');
        console.error('  auction-settlement   — sweep graduated auctions');
        console.error('  keepr-queue          — process XMTP/Neynar queue');
        process.exit(1);
    }

    await workflow.handler();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nCompleted in ${elapsed}s`);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\nFailed after ${elapsed}s`);
    console.error(err);
    process.exit(1);
  }
}

main();
