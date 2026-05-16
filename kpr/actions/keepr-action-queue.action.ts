/**
 * Keepr Action Queue — offchain HTTP-driven logic.
 *
 * Polls the Vercel API for pending keepr_actions, executes XMTP group
 * operations, and updates action status via the API.
 *
 * Unlike the other CRE workflows, this one does NOT interact with
 * onchain contracts — it's an offchain queue processor.
 */

import { requireEnv } from '../config.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-action-queue';

type KeeprTrustZone =
  | 'financial_execution'
  | 'market_maintenance'
  | 'queue_messaging_monitoring';

const KPR_TRUST_ZONE_HEADER = 'x-keepr-trust-zone';
const KPR_TRUST_ZONE_KEY_HEADER = 'x-keepr-zone-key';
const TRUST_ZONE_ENV_KEY_MAP: Record<KeeprTrustZone, string> = {
  financial_execution: 'KPR_ZONE_KEY_FINANCIAL_EXECUTION',
  market_maintenance: 'KPR_ZONE_KEY_MARKET_MAINTENANCE',
  queue_messaging_monitoring: 'KPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING',
};

const ACTION_TYPE_ALIASES: Record<string, string> = {
  'xmtp.group.add_member': 'xmtp.group.add_member',
  add_member: 'xmtp.group.add_member',
  addmember: 'xmtp.group.add_member',
  'xmtp.group.remove_member': 'xmtp.group.remove_member',
  remove_member: 'xmtp.group.remove_member',
  removemember: 'xmtp.group.remove_member',
  'xmtp.group.send_message': 'xmtp.group.send_message',
  send_message: 'xmtp.group.send_message',
  sendmessage: 'xmtp.group.send_message',
  'xmtp.group.sync_members': 'xmtp.group.sync_members',
  sync_members: 'xmtp.group.sync_members',
  syncmembers: 'xmtp.group.sync_members',
  'strategy.ajna.rebucket': 'strategy.ajna.rebucket',
  ajna_rebucket: 'strategy.ajna.rebucket',
  ajnarebucket: 'strategy.ajna.rebucket',
  'strategy.charm.rebalance': 'strategy.charm.rebalance',
  charm_rebalance: 'strategy.charm.rebalance',
  charmrebalance: 'strategy.charm.rebalance',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingAction {
  id: number;
  vaultAddress: string;
  groupId: string;
  actionType: string | null;
  trustZone?: string | null;
  action: Record<string, unknown>;
  dedupeKey: string | null;
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface KeeprActionQueueResult {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
  actions: Array<{
    id: number;
    actionType: string | null;
    outcome: 'executed' | 'failed' | 'retry';
    error?: string;
  }>;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function getApiBaseUrl(): string {
  return requireEnv('KPR_API_BASE_URL').replace(/\/$/, '');
}

function getApiSecret(): string {
  return requireEnv('KPR_API_KEY');
}

function normalizeActionType(actionType: string | null | undefined): string {
  return String(actionType ?? '').trim().toLowerCase();
}

function resolveEffectiveActionType(
  actionType: string | null | undefined,
  actionPayload?: Record<string, unknown> | null,
): string {
  const candidates = [
    normalizeActionType(typeof actionPayload?.action === 'string' ? actionPayload.action : null),
    normalizeActionType(actionType),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    return ACTION_TYPE_ALIASES[candidate] ?? candidate;
  }
  return '';
}

function resolveKeeprTrustZone(actionType: string | null | undefined): KeeprTrustZone {
  const normalized = normalizeActionType(actionType);
  if (!normalized) return 'market_maintenance';
  if (
    normalized.startsWith('xmtp.group.') ||
    normalized.startsWith('xmtp.dm.') ||
    normalized.startsWith('notify.') ||
    normalized.startsWith('message.') ||
    normalized.startsWith('telegram.notify')
  ) {
    return 'queue_messaging_monitoring';
  }
  if (
    normalized.startsWith('runtime.') ||
    normalized.startsWith('monitor.') ||
    normalized.startsWith('healthcheck.') ||
    normalized.startsWith('keeper.monitor.')
  ) {
    return 'market_maintenance';
  }
  if (
    normalized.startsWith('strategy.') ||
    normalized.startsWith('trade.') ||
    normalized.startsWith('vault.') ||
    normalized.startsWith('payout.') ||
    normalized.startsWith('routing.') ||
    normalized.startsWith('bridge.') ||
    normalized.includes('rebucket') ||
    normalized.includes('rebalance') ||
    normalized.includes('bid') ||
    normalized.includes('withdraw') ||
    normalized.includes('deposit')
  ) {
    return 'financial_execution';
  }
  return 'financial_execution';
}

function getTrustZoneKey(zone: KeeprTrustZone): string | null {
  const envKey = TRUST_ZONE_ENV_KEY_MAP[zone];
  const value = String(process.env[envKey] ?? '').trim();
  return value || null;
}

function buildZoneHeaders(
  actionType: string | null | undefined,
  actionPayload?: Record<string, unknown> | null,
): Record<string, string> {
  const zone = resolveKeeprTrustZone(resolveEffectiveActionType(actionType, actionPayload));
  const key = getTrustZoneKey(zone);
  return {
    [KPR_TRUST_ZONE_HEADER]: zone,
    ...(key ? { [KPR_TRUST_ZONE_KEY_HEADER]: key } : {}),
  };
}

async function fetchPendingActions(limit = 10): Promise<PendingAction[]> {
  const baseUrl = getApiBaseUrl();
  const secret = getApiSecret();

  const response = await fetch(`${baseUrl}/keepr/actions/pending?limit=${limit}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pending actions: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as ApiResponse<{ actions: PendingAction[]; count: number }>;
  if (!body.success || !body.data) {
    throw new Error(`API error: ${body.error ?? 'unknown'}`);
  }

  return body.data.actions;
}

async function updateActionStatus(params: {
  id: number;
  status: 'executing' | 'executed' | 'failed' | 'retry';
  error?: string;
  retryDelaySeconds?: number;
  actionType?: string | null;
  action?: Record<string, unknown> | null;
}): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const secret = getApiSecret();
  const effectiveActionType = resolveEffectiveActionType(params.actionType, params.action) || params.actionType;

  const response = await fetch(`${baseUrl}/keepr/actions/updateStatus`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...buildZoneHeaders(params.actionType, params.action),
    },
    body: JSON.stringify({
      ...params,
      actionType: effectiveActionType,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    return false;
  }

  const body = (await response.json()) as ApiResponse<{ updated: boolean }>;
  return body.success && (body.data?.updated ?? false);
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

async function executeAction(
  action: PendingAction,
): Promise<{ success: boolean; retryable: boolean; error?: string }> {
  const baseUrl = getApiBaseUrl();
  const secret = getApiSecret();
  const effectiveActionType = resolveEffectiveActionType(action.actionType, action.action) || action.actionType;

  try {
    const response = await fetch(`${baseUrl}/keepr/actions/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        ...buildZoneHeaders(action.actionType, action.action),
      },
      body: JSON.stringify({
        id: action.id,
        vaultAddress: action.vaultAddress,
        groupId: action.groupId,
        actionType: effectiveActionType,
        action: action.action,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = (await response.json().catch(() => null)) as
      | ApiResponse<{
          executed: boolean;
          retryable: boolean;
          actionType: string;
          error?: string;
          details?: Record<string, unknown>;
        }>
      | null;

    if (response.ok && body?.success && body.data?.executed) {
      return { success: true, retryable: false };
    }

    const errorMessage =
      body?.error ??
      body?.data?.error ??
      `Execution failed: ${response.status} ${response.statusText}`;

    let retryable = Boolean(body?.data?.retryable);
    if (response.status >= 500) retryable = true;
    if (response.status >= 400 && response.status < 500) retryable = false;

    return { success: false, retryable, error: errorMessage };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, retryable: true, error: message };
  }
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

export async function executeKeeprActionQueue(): Promise<KeeprActionQueueResult> {
  const result: KeeprActionQueueResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    actions: [],
  };

  // Step 1: Fetch pending actions
  let pendingActions: PendingAction[];
  try {
    pendingActions = await fetchPendingActions(10);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Failed to fetch pending actions', { error: message });
    throw err;
  }

  if (pendingActions.length === 0) {
    await alertInfo(WORKFLOW_NAME, 'No pending actions in queue');
    return result;
  }

  await alertInfo(WORKFLOW_NAME, `Processing ${pendingActions.length} pending action(s)`);

  // Step 2: Process each action
  for (const action of pendingActions) {
    result.processed++;
    const effectiveActionType = resolveEffectiveActionType(action.actionType, action.action) || action.actionType;

    // Mark as executing
    const claimed = await updateActionStatus({
      id: action.id,
      status: 'executing',
      actionType: effectiveActionType,
      action: action.action,
    });
    if (!claimed) {
      // Another worker may have claimed it
      await alertInfo(WORKFLOW_NAME, `Action ${action.id} already claimed — skipping`);
      continue;
    }

    // Execute
    const execResult = await executeAction(action);

    if (execResult.success) {
      // Mark as executed
      await updateActionStatus({ id: action.id, status: 'executed', actionType: effectiveActionType, action: action.action });
      result.succeeded++;
      result.actions.push({ id: action.id, actionType: effectiveActionType, outcome: 'executed' });
    } else {
      // Decide: retry or fail
      const shouldRetry = execResult.retryable && action.attemptCount < 4; // Max 5 total attempts (attempt_count is pre-increment)
      if (shouldRetry) {
        // Exponential backoff: 60s, 120s, 240s, 480s
        const delay = 60 * Math.pow(2, action.attemptCount);
        await updateActionStatus({
          id: action.id,
          status: 'retry',
          error: execResult.error,
          retryDelaySeconds: delay,
          actionType: effectiveActionType,
          action: action.action,
        });
        result.retried++;
        result.actions.push({
          id: action.id,
          actionType: effectiveActionType,
          outcome: 'retry',
          error: execResult.error,
        });
      } else {
        await updateActionStatus({
          id: action.id,
          status: 'failed',
          error: execResult.error,
          actionType: effectiveActionType,
          action: action.action,
        });
        result.failed++;
        result.actions.push({
          id: action.id,
          actionType: effectiveActionType,
          outcome: 'failed',
          error: execResult.error,
        });
        await alertWarning(WORKFLOW_NAME, `Action ${action.id} permanently failed`, {
          actionType: effectiveActionType,
          error: execResult.error,
          attempts: action.attemptCount + 1,
          retryable: execResult.retryable,
        });
      }
    }
  }

  await alertInfo(WORKFLOW_NAME, 'Keepr action queue processing complete', {
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    retried: result.retried,
  });

  return result;
}
