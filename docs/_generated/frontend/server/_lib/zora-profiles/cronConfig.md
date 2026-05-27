[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-profiles/cronConfig

# server/\_lib/zora-profiles/cronConfig

## Variables

### LAST\_REFRESH\_TICK\_KEY

> `const` **LAST\_REFRESH\_TICK\_KEY**: `"last_tick"` = `'last_tick'`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L9)

***

### ZORA\_PROFILES\_REFRESH\_STATE\_TABLE

> `const` **ZORA\_PROFILES\_REFRESH\_STATE\_TABLE**: `"zora_profiles_refresh_state"` = `'zora_profiles_refresh_state'`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L8)

***

### ZORA\_PROFILES\_TABLE

> `const` **ZORA\_PROFILES\_TABLE**: `"zora_profiles"` = `'zora_profiles'`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L7)

## Functions

### isZoraProfilesRefreshEnabled()

> **isZoraProfilesRefreshEnabled**(): `boolean`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L15)

Master kill-switch. Default off until enabled on Vercel.
Set `ZORA_PROFILES_REFRESH_ENABLED=1` to run the scheduled cron.

#### Returns

`boolean`

***

### readProfileRefreshListType()

> **readProfileRefreshListType**(): `string`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L67)

#### Returns

`string`

***

### readProfileRefreshPageSize()

> **readProfileRefreshPageSize**(): `number`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L27)

#### Returns

`number`

***

### readProfileRefreshRequestIntervalMs()

> **readProfileRefreshRequestIntervalMs**(): `number`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L35)

#### Returns

`number`

***

### readProfileRefreshTargetCount()

> **readProfileRefreshTargetCount**(): `number`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L19)

#### Returns

`number`

***

### readProfileRefreshUpsertBatchSize()

> **readProfileRefreshUpsertBatchSize**(): `number`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L59)

#### Returns

`number`

***

### readProfileRefreshWalletBudget()

> **readProfileRefreshWalletBudget**(): `number`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L43)

#### Returns

`number`

***

### readProfileRefreshWalletConcurrency()

> **readProfileRefreshWalletConcurrency**(): `number`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L51)

#### Returns

`number`

***

### resolveZoraServerApiKey()

> **resolveZoraServerApiKey**(): `string` \| `null`

Defined in: [server/\_lib/zora-profiles/cronConfig.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-profiles/cronConfig.ts#L71)

#### Returns

`string` \| `null`
