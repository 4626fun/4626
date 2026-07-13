import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';

const KPR_ROOT = resolve(import.meta.dirname, '..');

/** Load keeper env: kpr/.env first, then orchestrator file overrides when present. */
export function loadKeeperEnv(): void {
  config({ path: resolve(KPR_ROOT, '.env'), override: false });

  const orchestratorEnv =
    process.env.SOLANA_ORCHESTRATOR_ENV_FILE?.trim() ||
    '/etc/4626/solana-keeper-orchestrator.env';

  if (orchestratorEnv && existsSync(orchestratorEnv)) {
    config({ path: orchestratorEnv, override: true });
  }
}
