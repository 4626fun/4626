[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/v1/zora-profiles/\_refreshCron

# api/\_handlers/v1/zora-profiles/\_refreshCron

## Interfaces

### ZoraProfilesRefreshCronHooks

Defined in: [api/\_handlers/v1/zora-profiles/\_refreshCron.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/zora-profiles/_refreshCron.ts#L22)

#### Properties

##### runTick()?

> `optional` **runTick**: () => `Promise`\<[`ProfileRefreshTickResult`](../../../../server/_lib/zora-profiles/refreshProfiles.md#profilerefreshtickresult)\>

Defined in: [api/\_handlers/v1/zora-profiles/\_refreshCron.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/zora-profiles/_refreshCron.ts#L23)

###### Returns

`Promise`\<[`ProfileRefreshTickResult`](../../../../server/_lib/zora-profiles/refreshProfiles.md#profilerefreshtickresult)\>

## Functions

### \_\_resetZoraProfilesRefreshCronHooksForTest()

> **\_\_resetZoraProfilesRefreshCronHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/zora-profiles/\_refreshCron.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/zora-profiles/_refreshCron.ts#L34)

#### Returns

`void`

***

### \_\_setZoraProfilesRefreshCronHooksForTest()

> **\_\_setZoraProfilesRefreshCronHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/zora-profiles/\_refreshCron.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/zora-profiles/_refreshCron.ts#L28)

#### Parameters

##### hooks

[`ZoraProfilesRefreshCronHooks`](#zoraprofilesrefreshcronhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`void`\>

Defined in: [api/\_handlers/v1/zora-profiles/\_refreshCron.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/zora-profiles/_refreshCron.ts#L38)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`void`\>
