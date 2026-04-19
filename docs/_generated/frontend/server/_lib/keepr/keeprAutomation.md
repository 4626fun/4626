[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/keepr/keeprAutomation

# server/\_lib/keepr/keeprAutomation

## Type Aliases

### KeeprVaultAutomationRow

> **KeeprVaultAutomationRow** = `object`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L6)

#### Properties

##### authorizationSource

> **authorizationSource**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L12)

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:13](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L13)

##### automationScope

> **automationScope**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L14)

##### canonicalCswAddress

> **canonicalCswAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L9)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L18)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L10)

##### lastOwnerCheckAt

> **lastOwnerCheckAt**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L15)

##### metadata

> **metadata**: `JsonMap`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L17)

##### privyWalletId

> **privyWalletId**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L11)

##### profileId

> **profileId**: `number` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L8)

##### revokedAt

> **revokedAt**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L16)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprAutomation.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L19)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/keepr/keeprAutomation.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L7)

## Functions

### disableKeeprVaultAutomation()

> **disableKeeprVaultAutomation**(`params`): `Promise`\<[`KeeprVaultAutomationRow`](#keeprvaultautomationrow) \| `null`\>

Defined in: [server/\_lib/keepr/keeprAutomation.ts:227](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L227)

#### Parameters

##### params

###### revokedAt?

`string` \| `Date` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`KeeprVaultAutomationRow`](#keeprvaultautomationrow) \| `null`\>

***

### getKeeprVaultAutomationByVaultAddress()

> **getKeeprVaultAutomationByVaultAddress**(`vaultAddress`): `Promise`\<[`KeeprVaultAutomationRow`](#keeprvaultautomationrow) \| `null`\>

Defined in: [server/\_lib/keepr/keeprAutomation.ts:187](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L187)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`KeeprVaultAutomationRow`](#keeprvaultautomationrow) \| `null`\>

***

### listKeeprVaultAutomationByVaultAddresses()

> **listKeeprVaultAutomationByVaultAddresses**(`vaultAddresses`): `Promise`\<[`KeeprVaultAutomationRow`](#keeprvaultautomationrow)[]\>

Defined in: [server/\_lib/keepr/keeprAutomation.ts:204](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L204)

#### Parameters

##### vaultAddresses

readonly `` `0x${string}` ``[]

#### Returns

`Promise`\<[`KeeprVaultAutomationRow`](#keeprvaultautomationrow)[]\>

***

### upsertKeeprVaultAutomation()

> **upsertKeeprVaultAutomation**(`params`): `Promise`\<[`KeeprVaultAutomationRow`](#keeprvaultautomationrow)\>

Defined in: [server/\_lib/keepr/keeprAutomation.ts:106](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/keepr/keeprAutomation.ts#L106)

#### Parameters

##### params

###### authorizationSource

`string`

###### automationEnabled?

`boolean`

###### automationScope

`string`

###### canonicalCswAddress

`` `0x${string}` ``

###### embeddedEoaAddress?

`` `0x${string}` `` \| `null`

###### lastOwnerCheckAt?

`string` \| `Date` \| `null`

###### metadata?

`JsonMap` \| `null`

###### privyWalletId?

`string` \| `null`

###### profileId

`number`

###### revokedAt?

`string` \| `Date` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`KeeprVaultAutomationRow`](#keeprvaultautomationrow)\>
