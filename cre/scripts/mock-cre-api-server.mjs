#!/usr/bin/env node

import { createServer } from 'node:http';

const HOST = process.env.CRE_MOCK_API_HOST ?? '127.0.0.1';
const PORT = Number(process.env.CRE_MOCK_API_PORT ?? '8789');
const API_KEY = process.env.CRE_MOCK_API_KEY ?? process.env.KEEPR_API_KEY_VALUE ?? 'local-test-key';

const MOCK_VAULT = {
  vaultAddress: '0x82C06EaAE27B1Ca31fA29F22341A162A670A4471',
  chainId: 8453,
  creatorCoinAddress: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
  gaugeControllerAddress: '0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1',
  burnStreamAddress: '',
  groupId: 'mock-group-1',
};
const SOLANA_CHECKPOINTS = new Map();
const ENQUEUED_ACTIONS = [];
let NEXT_ACTION_ID = 1;

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function parseMaybeBase64Json(input) {
  if (!input) return null;
  const asText = input.toString('utf8');
  try {
    return JSON.parse(asText);
  } catch {}
  try {
    return JSON.parse(Buffer.from(asText, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function deriveVerdictFromAlerts(alerts) {
  if (!Array.isArray(alerts)) return 'unknown';
  if (alerts.some((a) => a?.severity === 'critical')) return 'critical';
  if (alerts.some((a) => a?.severity === 'warning' || a?.severity === 'info')) return 'watch';
  return 'pass';
}

function nonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const auth = req.headers.authorization ?? '';

  if (path === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }

  if (auth !== `Bearer ${API_KEY}`) {
    return sendJson(res, 401, { success: false, error: 'Unauthorized' });
  }

  if (method === 'GET' && path === '/api/vaults/active') {
    return sendJson(res, 200, {
      success: true,
      data: { vaults: [MOCK_VAULT] },
    });
  }

  if (method === 'GET' && path === '/api/keepr/actions/pending') {
    return sendJson(res, 200, {
      success: true,
      data: { actions: ENQUEUED_ACTIONS, count: ENQUEUED_ACTIONS.length },
    });
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const parsed = parseMaybeBase64Json(Buffer.concat(chunks));

    if (method === 'POST' && path === '/api/keeper/aiAssess') {
      const alerts = Array.isArray(parsed?.alerts) ? parsed.alerts : [];
      const verdict = deriveVerdictFromAlerts(alerts);
      return sendJson(res, 200, {
        success: true,
        data: {
          enabled: true,
          verdict,
          confidence: verdict === 'critical' ? 0.93 : verdict === 'watch' ? 0.8 : 0.72,
          summary: `Mock AI assessed ${alerts.length} deterministic alert(s).`,
          suggestedAction:
            verdict === 'critical'
              ? 'Pause keeper-triggered writes and investigate immediately.'
              : 'Continue monitoring and review warnings.',
          provider: 'mock-ai',
        },
      });
    }

    if (
      method === 'POST' &&
      path === '/api/keeper/solana/reconcile'
    ) {
      const workflow = typeof parsed?.workflow === 'string' ? parsed.workflow.trim() : '';
      const action = typeof parsed?.action === 'string' ? parsed.action.trim() : '';
      const checkpointKey = typeof parsed?.checkpointKey === 'string' ? parsed.checkpointKey.trim() : '';

      if (!workflow || !action || !checkpointKey) {
        return sendJson(res, 400, {
          success: false,
          error: 'workflow, action, and checkpointKey are required',
        });
      }

      const stateKey = `${workflow}:${checkpointKey}`;
      if (SOLANA_CHECKPOINTS.has(stateKey)) {
        return sendJson(res, 200, {
          success: true,
          data: {
            workflow,
            action,
            checkpointKey,
            status: 'already_processed',
            executed: false,
            upstreamStatusCode: 200,
            upstreamResponse: {
              mock: true,
              idempotent: true,
            },
          },
        });
      }

      const configuredStatus = String(process.env.CRE_MOCK_SOLANA_STATUS ?? 'completed');
      const status =
        configuredStatus === 'failed' || configuredStatus === 'skipped_unconfigured'
          ? configuredStatus
          : 'completed';
      const executed = status === 'completed';
      SOLANA_CHECKPOINTS.set(stateKey, { status, executed });

      return sendJson(res, 200, {
        success: true,
        data: {
          workflow,
          action,
          checkpointKey,
          status,
          executed,
          upstreamStatusCode: executed ? 200 : 503,
          upstreamResponse: {
            mock: true,
            status,
          },
        },
      });
    }

    if (method === 'POST' && path.startsWith('/api/keeper/')) {
      return sendJson(res, 200, {
        success: true,
        data: { ok: true, endpoint: path, payload: parsed ?? {} },
      });
    }

    if (method === 'POST' && path === '/api/keepr/actions/enqueue') {
      const dedupeKey = nonEmptyString(parsed?.dedupeKey);
      const existing = dedupeKey ? ENQUEUED_ACTIONS.find((entry) => entry.dedupeKey === dedupeKey) : null;
      if (existing) {
        return sendJson(res, 200, {
          success: true,
          data: { actionId: existing.id, inserted: false },
        });
      }

      const action = {
        id: NEXT_ACTION_ID++,
        vaultAddress: parsed?.vaultAddress ?? '',
        groupId: parsed?.groupId ?? '',
        actionType: parsed?.actionType ?? 'mock_action',
        action:
          parsed?.action && typeof parsed.action === 'object' && !Array.isArray(parsed.action)
            ? parsed.action
            : {},
        dedupeKey: dedupeKey ?? null,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      ENQUEUED_ACTIONS.push(action);
      return sendJson(res, 200, {
        success: true,
        data: { actionId: action.id, inserted: true },
      });
    }

    if (method === 'POST' && path === '/api/keepr/actions/updateStatus') {
      return sendJson(res, 200, {
        success: true,
        data: { updated: true },
      });
    }

    if (method === 'POST' && path === '/api/keepr/actions/execute') {
      return sendJson(res, 200, {
        success: true,
        data: {
          executed: true,
          retryable: false,
          actionType: parsed?.actionType ?? 'mock_action',
        },
      });
    }

    return sendJson(res, 404, { success: false, error: 'Not found' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-cre-api] listening on http://${HOST}:${PORT}`);
});
