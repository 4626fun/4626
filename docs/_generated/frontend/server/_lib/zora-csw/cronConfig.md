[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-csw/cronConfig

# server/\_lib/zora-csw/cronConfig

## Variables

### LAST\_SCANNED\_BLOCK\_KEY

> `const` **LAST\_SCANNED\_BLOCK\_KEY**: `"last_scanned_block"` = `'last_scanned_block'`

Defined in: [server/\_lib/zora-csw/cronConfig.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/cronConfig.ts#L11)

***

### ZORA\_CSW\_INDEXER\_STATE\_TABLE

> `const` **ZORA\_CSW\_INDEXER\_STATE\_TABLE**: `"zora_csw_indexer_state"` = `'zora_csw_indexer_state'`

Defined in: [server/\_lib/zora-csw/cronConfig.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/cronConfig.ts#L9)

***

### ZORA\_CSW\_OWNERS\_TABLE

> `const` **ZORA\_CSW\_OWNERS\_TABLE**: `"zora_csw_owners"` = `'zora_csw_owners'`

Defined in: [server/\_lib/zora-csw/cronConfig.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/cronConfig.ts#L10)

## Functions

### isZoraCswIndexerEnabled()

> **isZoraCswIndexerEnabled**(): `boolean`

Defined in: [server/\_lib/zora-csw/cronConfig.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/cronConfig.ts#L17)

Master kill-switch for both crons. Default: disabled.
Set `ZORA_CSW_INDEXER_ENABLED=1` in Vercel to flip on.

#### Returns

`boolean`

***

### readEnrichBudget()

> **readEnrichBudget**(): `number`

Defined in: [server/\_lib/zora-csw/cronConfig.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/cronConfig.ts#L21)

#### Returns

`number`

***

### readEthosEnrichBudget()

> **readEthosEnrichBudget**(): `number`

Defined in: [server/\_lib/zora-csw/cronConfig.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/cronConfig.ts#L37)

#### Returns

`number`

***

### readRpcConcurrency()

> **readRpcConcurrency**(): `number`

Defined in: [server/\_lib/zora-csw/cronConfig.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/cronConfig.ts#L29)

#### Returns

`number`
