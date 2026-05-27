-- Legacy DeploymentBatcher (AKITA / pre-pipe-a epoch)
-- 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8 — label separately from greenfield charts.

SELECT
  date_trunc('day', block_time) AS day,
  count(*) AS tx_count
FROM base.transactions
WHERE lower("to") = lower('0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8')
  AND block_time >= now() - interval '365' day
  AND success = true
GROUP BY 1
ORDER BY 1 DESC;
