-- 4626 DeploymentBatcher daily transaction count (Base)
-- Current: 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 (v1.14.1)
-- Retired: 0xa99058f424FB3ACC639F59355C65C40149030651 (v1.14.0) — use UNION for full history
-- Paste into Dune SQL editor; adjust table names if your workspace uses decoded events.

SELECT
  date_trunc('day', block_time) AS day,
  count(*) AS tx_count,
  count(DISTINCT "from") AS unique_senders
FROM base.transactions
WHERE "to" = 0x660b251f2feb28f61a8e23e65c66f9b917ee61c1
  AND block_time >= now() - interval '90' day
  AND success = true
GROUP BY 1
ORDER BY 1 DESC;
