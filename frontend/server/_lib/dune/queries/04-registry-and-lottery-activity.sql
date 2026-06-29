-- Protocol touchpoints: CreatorRegistry + CreatorLotteryManager (Base)
-- Registry (v1.14.1): 0xDD7B106a15540bA2F59464590222bF47D8C9394E
-- Lottery (v1.14.1): 0x29F901864D65Eb848BC548ebCEAcD6dAD39EFd26
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
