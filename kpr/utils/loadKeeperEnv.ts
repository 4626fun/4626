import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';

import {
  normalizeLotteryManager,
  normalizeSolanaBridgeAdapter,
} from './solanaCanonicalAddresses.js';

const KPR_ROOT = resolve(import.meta.dirname, '..');

function applyCanonicalAddressOverrides(): void {
  if (process.env.SOLANA_BRIDGE_ADAPTER) {
    process.env.SOLANA_BRIDGE_ADAPTER = normalizeSolanaBridgeAdapter(process.env.SOLANA_BRIDGE_ADAPTER);
  }
  if (process.env.LOTTERY_MANAGER) {
    process.env.LOTTERY_MANAGER = normalizeLotteryManager(process.env.LOTTERY_MANAGER);
  }
}

/** Load keeper env: kpr/.env first, then orchestrator file overrides when present. */
export function loadKeeperEnv(): void {
  config({ path: resolve(KPR_ROOT, '.env'), override: false });

  const orchestratorEnv =
    process.env.SOLANA_ORCHESTRATOR_ENV_FILE?.trim() ||
    '/etc/4626/solana-keeper-orchestrator.env';

  if (orchestratorEnv && existsSync(orchestratorEnv)) {
    config({ path: orchestratorEnv, override: true });
  }

  applyCanonicalAddressOverrides();
}
