export type PayoutIntegrityAlertSeverity = 'info' | 'warning' | 'critical';

export type PayoutIntegrityAlertLike = {
  alertType: string;
  severity: PayoutIntegrityAlertSeverity;
  message: string;
  details?: Record<string, unknown>;
};

export type PayoutIntegrityAiVerdict = 'pass' | 'watch' | 'critical' | 'unknown';

export type PayoutIntegrityAiResult = {
  enabled: boolean;
  verdict: PayoutIntegrityAiVerdict;
  confidence: number | null;
  summary: string;
  suggestedAction: string;
  provider?: string;
  error?: string;
};

const MAX_SUMMARY_LENGTH = 280;
const MAX_ACTION_LENGTH = 220;

// ---------------------------------------------------------------------------
// Prompt-injection hardening (finding 4626-305 / H-13)
//
// Alert fields (message, details) flow from on-chain data that is partially
// attacker-controllable (addresses, BPS values, error strings) into an LLM
// prompt at /keeper/aiAssess. We sanitize before POST so the AI cannot be
// steered by embedded directives or unprintable control characters.
//
// INVARIANT (do NOT regress): the AI verdict is advisory. Alerts fire iff
// `pendingAlerts.length > 0` (see payout-integrity/main.ts Check 8). The AI
// result must never gate alert firing; sanitization below is defense-in-depth.
// ---------------------------------------------------------------------------

const MAX_ALERT_MESSAGE_LENGTH = 280;
const MAX_DETAIL_STRING_LENGTH = 256;
const MAX_DETAIL_KEYS = 32;
const MAX_DETAILS_DEPTH = 3;

// Strip C0/C1 control characters (except space), zero-width and bidi-override
// codepoints often used in prompt-injection payloads.
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g;

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function sanitizePromptString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const stripped = value.replace(CONTROL_CHAR_PATTERN, ' ');
  // Collapse runs of whitespace to a single space so newline-based injections
  // don't bypass the control-char filter via concatenation.
  const collapsed = stripped.replace(/\s+/g, ' ').trim();
  return truncate(collapsed, maxLength);
}

function sanitizeDetailValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizePromptString(value, MAX_DETAIL_STRING_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (depth >= MAX_DETAILS_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_DETAIL_KEYS).map((entry) => sanitizeDetailValue(entry, depth + 1));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_DETAIL_KEYS);
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      const safeKey = sanitizePromptString(k, 64);
      if (!safeKey) continue;
      out[safeKey] = sanitizeDetailValue(v, depth + 1);
    }
    return out;
  }
  return '[unsupported]';
}

export function sanitizeAlertForAi<T extends PayoutIntegrityAlertLike & { details?: Record<string, unknown> }>(
  alert: T,
): PayoutIntegrityAlertLike & { details?: Record<string, unknown> } {
  const severity: PayoutIntegrityAlertSeverity =
    alert.severity === 'critical' || alert.severity === 'warning' || alert.severity === 'info'
      ? alert.severity
      : 'info';
  const sanitized: PayoutIntegrityAlertLike & { details?: Record<string, unknown> } = {
    alertType: sanitizePromptString(alert.alertType, 64) || 'unknown',
    severity,
    message: sanitizePromptString(alert.message, MAX_ALERT_MESSAGE_LENGTH),
  };
  if (alert.details && typeof alert.details === 'object') {
    sanitized.details = sanitizeDetailValue(alert.details, 0) as Record<string, unknown>;
  }
  return sanitized;
}

export function sanitizeAlertsForAi(
  alerts: ReadonlyArray<PayoutIntegrityAlertLike & { details?: Record<string, unknown> }>,
): Array<PayoutIntegrityAlertLike & { details?: Record<string, unknown> }> {
  return alerts.map((a) => sanitizeAlertForAi(a));
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return Number(value.toFixed(2));
}

function normalizeVerdict(value: unknown): PayoutIntegrityAiVerdict | null {
  const raw = toText(value).toLowerCase();
  if (raw === 'pass' || raw === 'watch' || raw === 'critical' || raw === 'unknown') {
    return raw;
  }
  return null;
}

function defaultSuggestedAction(verdict: PayoutIntegrityAiVerdict): string {
  if (verdict === 'critical') return 'Pause keeper-triggered writes and investigate immediately.';
  if (verdict === 'watch') return 'Review warnings and monitor closely on the next run.';
  if (verdict === 'pass') return 'No action required; continue normal monitoring cadence.';
  return 'Investigate telemetry and rerun checks.';
}

export function deriveDeterministicVerdict(
  alerts: ReadonlyArray<PayoutIntegrityAlertLike>,
): PayoutIntegrityAiVerdict {
  if (alerts.some((alert) => alert.severity === 'critical')) return 'critical';
  if (alerts.some((alert) => alert.severity === 'warning' || alert.severity === 'info')) return 'watch';
  return 'pass';
}

export function createAiFallbackResult(
  alerts: ReadonlyArray<PayoutIntegrityAlertLike>,
  error?: string,
): PayoutIntegrityAiResult {
  const verdict = deriveDeterministicVerdict(alerts);
  return {
    enabled: false,
    verdict,
    confidence: null,
    summary:
      alerts.length > 0
        ? `AI assessment unavailable; using deterministic checks with ${alerts.length} alert(s).`
        : 'AI assessment unavailable; deterministic checks indicate no active alerts.',
    suggestedAction: defaultSuggestedAction(verdict),
    ...(error ? { error } : {}),
  };
}

export function normalizeAiResult(
  raw: unknown,
  alerts: ReadonlyArray<PayoutIntegrityAlertLike>,
): PayoutIntegrityAiResult {
  const fallback = createAiFallbackResult(alerts);
  if (!raw || typeof raw !== 'object') return fallback;

  const source = raw as Record<string, unknown>;
  const verdict = normalizeVerdict(source.verdict) ?? fallback.verdict;
  // Defense-in-depth: strip control chars from AI-supplied strings so a
  // compromised AI response cannot inject markup or directives into downstream
  // logs / notifications. See finding 4626-305 (H-13).
  const summary = sanitizePromptString(
    toText(source.summary) || fallback.summary,
    MAX_SUMMARY_LENGTH,
  );
  const suggestedAction = sanitizePromptString(
    toText(source.suggestedAction) || defaultSuggestedAction(verdict),
    MAX_ACTION_LENGTH,
  );
  const provider = sanitizePromptString(toText(source.provider), 64);
  const error = sanitizePromptString(toText(source.error), 256);

  return {
    enabled: source.enabled === true,
    verdict,
    confidence: normalizeConfidence(source.confidence),
    summary: summary || fallback.summary,
    suggestedAction: suggestedAction || defaultSuggestedAction(verdict),
    ...(provider ? { provider } : {}),
    ...(error ? { error } : {}),
  };
}
