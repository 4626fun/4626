-- 4626 DeploymentBatcher daily transaction count (Base)
-- Contract: 0xa99058f424FB3ACC639F59355C65C40149030651 (v1.11.2-pipe-a)
-- Paste into Dune SQL editor; adjust table names if your workspace uses decoded events.

SELECT
  date_trunc('day', block_time) AS day,
  count(*) AS tx_count,
  count(DISTINCT "from") AS unique_senders
FROM base.transactions
WHERE "to" = 0xa99058f424fb3acc639f59355c65c40149030651
  AND block_time >= now() - interval '90' day
  AND success = true
GROUP BY 1
ORDER BY 1 DESC;
