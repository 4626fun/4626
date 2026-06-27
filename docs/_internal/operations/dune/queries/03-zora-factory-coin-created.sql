-- Zora coin factory CoinCreated events (Base)
-- Factory: 0x777777751622c0d3258f214f9df38e35bf45baf3
--
-- After uploading the factory ABI to Dune, replace `zora_base.CoinCreated` with your
-- decoded table name (spellbook or custom contract decode).

SELECT
  date_trunc('day', evt_block_time) AS day,
  count(*) AS coins_created
FROM zora_base.CoinCreated
WHERE evt_block_time >= now() - interval '90' day
GROUP BY 1
ORDER BY 1 DESC;
