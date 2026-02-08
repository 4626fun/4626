/**
 * Keepr Action Queue Executor — offchain HTTP-driven logic.
 *
 * Polls the Vercel API for pending keepr_actions, executes XMTP group
 * operations, and updates action status via the API.
 *
 * Unlike the other CRE workflows, this one does NOT interact with
 * onchain contracts — it's an offchain queue processor.
 */

import { requireEnv } from '../config.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-queue-executor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingAction {
  id: number;
  vaultAddress: string;
  groupId: string;
  actionType: string | null;
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

export interface QueueExecutorResult {
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
  return requireEnv('KEEPR_API_BASE_URL').replace(/\/$/, '');
}

function getApiSecret(): string {
  return requireEnv('KEEPR_API_KEY');
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
}): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const secret = getApiSecret();

  const response = await fetch(`${baseUrl}/keepr/actions/updateStatus`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
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

  try {
    const response = await fetch(`${baseUrl}/keepr/actions/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: action.id,
        vaultAddress: action.vaultAddress,
        groupId: action.groupId,
        actionType: action.actionType,
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

export async function executeQueueProcessor(): Promise<QueueExecutorResult> {
  const result: QueueExecutorResult = {
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

    // Mark as executing
    const claimed = await updateActionStatus({ id: action.id, status: 'executing' });
    if (!claimed) {
      // Another worker may have claimed it
      await alertInfo(WORKFLOW_NAME, `Action ${action.id} already claimed — skipping`);
      continue;
    }

    // Execute
    const execResult = await executeAction(action);

    if (execResult.success) {
      // Mark as executed
      await updateActionStatus({ id: action.id, status: 'executed' });
      result.succeeded++;
      result.actions.push({ id: action.id, actionType: action.actionType, outcome: 'executed' });
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
        });
        result.retried++;
        result.actions.push({
          id: action.id,
          actionType: action.actionType,
          outcome: 'retry',
          error: execResult.error,
        });
      } else {
        await updateActionStatus({
          id: action.id,
          status: 'failed',
          error: execResult.error,
        });
        result.failed++;
        result.actions.push({
          id: action.id,
          actionType: action.actionType,
          outcome: 'failed',
          error: execResult.error,
        });
        await alertWarning(WORKFLOW_NAME, `Action ${action.id} permanently failed`, {
          actionType: action.actionType,
          error: execResult.error,
          attempts: action.attemptCount + 1,
          retryable: execResult.retryable,
        });
      }
    }
  }

  await alertInfo(WORKFLOW_NAME, 'Queue processing complete', {
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    retried: result.retried,
  });

  return result;
}
