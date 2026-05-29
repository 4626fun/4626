[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-profiles/refreshProfiles

# server/\_lib/zora-profiles/refreshProfiles

## Type Aliases

### ProfileRefreshTickResult

> **ProfileRefreshTickResult** = \{ `cswIndexRowsUpdated`: `number`; `ok`: `true`; `reason?`: `string`; `scan`: \{ `coinsFetched`: `number`; `listType`: `string`; `pages`: `number`; `profilesUpserted`: `number`; `skippedNoHandle`: `number`; \} \| `null`; `tick`: `"refreshed"` \| `"skipped"`; `wallets`: \{ `failed`: `number`; `selected`: `number`; `updated`: `number`; `withSmartWallet`: `number`; \} \| `null`; \} \| \{ `error`: `string`; `ok`: `false`; `tick`: `"errored"`; \}

Defined in: [server/\_lib/zora-profiles/refreshProfiles.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/refreshProfiles.ts#L15)

## Functions

### runZoraProfilesRefreshTick()

> **runZoraProfilesRefreshTick**(): `Promise`\<[`ProfileRefreshTickResult`](#profilerefreshtickresult)\>

Defined in: [server/\_lib/zora-profiles/refreshProfiles.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/refreshProfiles.ts#L58)

#### Returns

`Promise`\<[`ProfileRefreshTickResult`](#profilerefreshtickresult)\>
