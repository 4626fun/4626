/**
 * Alerting / webhook helpers for CRE workflows.
 *
 * Supports:
 *  - Generic webhook (Slack, Discord, PagerDuty, etc.)
 *  - Console logging as fallback
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertPayload {
  workflow: string;
  severity: AlertSeverity;
  title: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Core alert function
// ---------------------------------------------------------------------------

/**
 * Send an alert to the configured webhook. Falls back to console.log if
 * no webhook URL is configured.
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;

  // Always log to console for CRE execution logs
  const prefix = `[CRE:${payload.workflow}] [${payload.severity.toUpperCase()}]`;
  console.log(`${prefix} ${payload.title}`, JSON.stringify(payload.details));

  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`${prefix} Webhook returned ${response.status}`);
    }
  } catch (err) {
    console.error(`${prefix} Webhook failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function alertInfo(workflow: string, title: string, details: Record<string, unknown> = {}): Promise<void> {
  return sendAlert({ workflow, severity: 'info', title, details, timestamp: new Date().toISOString() });
}

export function alertWarning(workflow: string, title: string, details: Record<string, unknown> = {}): Promise<void> {
  return sendAlert({ workflow, severity: 'warning', title, details, timestamp: new Date().toISOString() });
}

export function alertCritical(workflow: string, title: string, details: Record<string, unknown> = {}): Promise<void> {
  return sendAlert({ workflow, severity: 'critical', title, details, timestamp: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a bigint wei value as a human-readable ETH string. */
export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return `${eth.toFixed(6)} ETH`;
}

/** Format a bigint token value (18 decimals) as a human-readable string. */
export function formatTokens(raw: bigint, symbol = 'tokens'): string {
  const amount = Number(raw) / 1e18;
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`;
}
