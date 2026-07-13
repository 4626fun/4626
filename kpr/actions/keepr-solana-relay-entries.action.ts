/**
 * Keepr Solana Relay Entries Action — intentionally fail-closed.
 *
 * Twin/SolanaBridgeAdapter transport is retired (LayerZero ShareOFT only).
 * No repository-native Solana→Base attached-call transport exists, so this
 * action must never fall back to a direct Base EOA write.
 */
import { alertCritical, alertWarning } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-relay-entries';

export interface EntryRelayResult {
  entriesQueued: number;
  entriesRelayed: number;
  overflowCount: number;
  emergencyRelay: boolean;
}

/**
 * Default-deny gate for the lottery-entry relay lane (audit H2-08 / C-01).
 *
 * The relay lane must stay off unless `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED`
 * is explicitly truthy. Global execute flags, workflow config re-seeds, or
 * running the standalone workflow do NOT enable it — enabling B2 relay is an
 * explicit product decision gated on the hardened transfer-hook deploy.
 */
export function isRelayEntriesLaneEnabled(): boolean {
  const normalized = String(process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED ?? '')
    .trim()
    .toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export const SOLANA_TO_BASE_TRANSPORT_UNAVAILABLE =
  'solana_to_base_attached_call_transport_unavailable';

export async function executeSolanaRelayEntries(): Promise<EntryRelayResult> {
  const result: EntryRelayResult = {
    entriesQueued: 0,
    entriesRelayed: 0,
    overflowCount: 0,
    emergencyRelay: false,
  };

  if (!isRelayEntriesLaneEnabled()) {
    await alertWarning(
      WORKFLOW_NAME,
      'Relay-entries lane is default-deny (SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED not truthy) — skipping without reading or relaying entries',
    );
    return result;
  }

  await alertCritical(
    WORKFLOW_NAME,
    'Relay blocked: Twin/SolanaBridgeAdapter retired (LZ ShareOFT only); Solana→Base attached-call transport not implemented — no Base write or Solana buffer clear attempted',
  );
  throw new Error(SOLANA_TO_BASE_TRANSPORT_UNAVAILABLE);
}
