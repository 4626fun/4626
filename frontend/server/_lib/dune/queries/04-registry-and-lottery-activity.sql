-- Protocol touchpoints: CreatorRegistry + CreatorLotteryManager (Base)
-- Registry: 0x3f64087dc361Ad52300409E5873b26941D6418B6
-- Lottery: 0x5c0115589d7F4930A0dc93417aE409f44186f4E7
--
-- Replace decoded event tables after ABI upload.

SELECT
  date_trunc('day', evt_block_time) AS day,
  'registry' AS source,
  count(*) AS events
FROM creator_registry_base.YourRegistryEvent
WHERE evt_block_time >= now() - interval '90' day
GROUP BY 1, 2

UNION ALL

SELECT
  date_trunc('day', evt_block_time) AS day,
  'lottery' AS source,
  count(*) AS events
FROM creator_lottery_base.YourLotteryEvent
WHERE evt_block_time >= now() - interval '90' day
GROUP BY 1, 2

ORDER BY 1 DESC, 2;
