#!/usr/bin/env tsx
/**
 * Preflight Solana keeper orchestrator config against live Base + Solana RPC.
 *
 * Usage: pnpm -C kpr preflight-orchestrator
 */

import { collectKeeperBaseWritePreflight } from '../../utils/solanaKeeperPreflight.js';
import { loadKeeperEnv } from '../../utils/loadKeeperEnv.js';

loadKeeperEnv();

async function main() {
  const preflight = await collectKeeperBaseWritePreflight();
  console.log(
    JSON.stringify(
      {
        ok: preflight.blockers.length === 0,
        blockers: preflight.blockers,
        warnings: preflight.warnings,
        keeperPubkey: preflight.keeperPubkey,
        keeperBytes32: preflight.keeperBytes32,
        predictedTwin: preflight.predictedTwin,
        twinDeployed: preflight.twinDeployed,
        authorizedEntryKeeper: preflight.authorizedEntryKeeper,
        authorizedFeeKeeper: preflight.authorizedFeeKeeper,
        lotteryManager: preflight.lotteryManager,
        mintChecks: preflight.mintChecks,
      },
      null,
      2,
    ),
  );
  process.exit(preflight.blockers.length === 0 ? 0 : 2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
