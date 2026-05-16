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
// FIX: MED-07 — Allowlist of safe webhook URL prefixes to prevent SSRF
const SAFE_WEBHOOK_PREFIXES = [
  'https://hooks.slack.com/',
  'https://events.pagerduty.com/',
  'https://discord.com/api/webhooks/',
  'https://discordapp.com/api/webhooks/',
];

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;

  // Always log to console for CRE execution logs
  const prefix = `[CRE:${payload.workflow}] [${payload.severity.toUpperCase()}]`;
  console.log(`${prefix} ${payload.title}`, JSON.stringify(payload.details));

  if (!webhookUrl) return;

  // FIX: MED-07 — Validate webhook URL: must be HTTPS and optionally match allowlist
  if (!webhookUrl.startsWith('https://')) {
    console.error(`${prefix} ALERT_WEBHOOK_URL rejected: must use HTTPS`);
    return;
  }
  if (process.env.ALERT_WEBHOOK_STRICT_ALLOWLIST === 'true') {
    const isAllowed = SAFE_WEBHOOK_PREFIXES.some((p) => webhookUrl.startsWith(p));
    if (!isAllowed) {
      console.error(`${prefix} ALERT_WEBHOOK_URL rejected: not in allowlist`);
      return;
    }
  }

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

// FIX: LOW-03 — Use string-based bigint formatting to avoid Number() precision loss for large values
function formatBigIntUnits(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const remainder = value % divisor;
  if (remainder === 0n) return whole.toString();
  const fracStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Format a bigint wei value as a human-readable ETH string. */
export function formatEth(wei: bigint): string {
  return `${formatBigIntUnits(wei, 18)} ETH`;
}

/** Format a bigint token value (18 decimals) as a human-readable string. */
export function formatTokens(raw: bigint, symbol = 'tokens'): string {
  return `${formatBigIntUnits(raw, 18)} ${symbol}`;
}
