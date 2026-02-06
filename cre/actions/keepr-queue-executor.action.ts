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

/**
 * Execute a single keepr action.
 *
 * Currently supports XMTP group operations as placeholders. The actual XMTP
 * client integration depends on the XMTP SDK being available in the CRE
 * environment.
 */
async function executeAction(action: PendingAction): Promise<{ success: boolean; error?: string }> {
  const actionType = action.actionType ?? (action.action as any)?.action ?? 'unknown';
  const payload = action.action;

  try {
    switch (actionType) {
      case 'add_member':
      case 'addMember': {
        // XMTP: Add member to group
        const walletAddress = (payload as any)?.walletAddress ?? (payload as any)?.address;
        if (!walletAddress) {
          return { success: false, error: 'Missing walletAddress in action payload' };
        }
        // Placeholder: actual XMTP SDK call would go here
        await alertInfo(WORKFLOW_NAME, `Would add member ${walletAddress} to group ${action.groupId}`, {
          actionId: action.id,
          vault: action.vaultAddress,
        });
        return { success: true };
      }

      case 'remove_member':
      case 'removeMember': {
        // XMTP: Remove member from group
        const walletAddress = (payload as any)?.walletAddress ?? (payload as any)?.address;
        if (!walletAddress) {
          return { success: false, error: 'Missing walletAddress in action payload' };
        }
        await alertInfo(WORKFLOW_NAME, `Would remove member ${walletAddress} from group ${action.groupId}`, {
          actionId: action.id,
          vault: action.vaultAddress,
        });
        return { success: true };
      }

      case 'send_message':
      case 'sendMessage': {
        // XMTP: Send message to group
        const message = (payload as any)?.message ?? (payload as any)?.content;
        if (!message) {
          return { success: false, error: 'Missing message in action payload' };
        }
        await alertInfo(WORKFLOW_NAME, `Would send message to group ${action.groupId}`, {
          actionId: action.id,
          vault: action.vaultAddress,
          messageLength: String(message).length,
        });
        return { success: true };
      }

      case 'sync_members':
      case 'syncMembers': {
        // XMTP: Sync group membership
        await alertInfo(WORKFLOW_NAME, `Would sync members for group ${action.groupId}`, {
          actionId: action.id,
          vault: action.vaultAddress,
        });
        return { success: true };
      }

      default: {
        await alertWarning(WORKFLOW_NAME, `Unknown action type: ${actionType}`, {
          actionId: action.id,
          vault: action.vaultAddress,
        });
        return { success: false, error: `Unknown action type: ${actionType}` };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
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
      const shouldRetry = action.attemptCount < 4; // Max 5 total attempts (attempt_count is pre-increment)
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
