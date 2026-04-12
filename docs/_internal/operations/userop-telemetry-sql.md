# ERC-4337 UserOp Telemetry Queries

Use these queries against `chat_command_center_events` to monitor `xmtp_userop_submission_batch` telemetry.

## Rolling Daily p95 (7 days)

```sql
SELECT
  DATE(created_at) AS day,
  ROUND(AVG((payload->>'p95Ms')::numeric), 2) AS avg_p95_ms,
  ROUND(MAX((payload->>'p95Ms')::numeric), 2) AS max_p95_ms,
  SUM(COALESCE((payload->>'sampleCount')::int, 0)) AS total_samples,
  SUM(COALESCE((payload->>'timeoutCount')::int, 0)) AS total_timeouts
FROM chat_command_center_events
WHERE event = 'xmtp_userop_submission_batch'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

## Latest 50 UserOp Telemetry Batches

```sql
SELECT
  created_at,
  payload->>'reason' AS flush_reason,
  (payload->>'sampleCount')::int AS sample_count,
  (payload->>'p50Ms')::numeric AS p50_ms,
  (payload->>'p95Ms')::numeric AS p95_ms,
  (payload->>'p99Ms')::numeric AS p99_ms,
  (payload->>'timeoutCount')::int AS timeout_count,
  payload->'paymasterUsage' AS paymaster_usage,
  payload->'signatureModes' AS signature_modes,
  payload->'verificationGasLimitUsed' AS verification_gas_limits
FROM chat_command_center_events
WHERE event = 'xmtp_userop_submission_batch'
ORDER BY created_at DESC
LIMIT 50;
```
