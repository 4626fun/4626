[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/lensAccounts

# server/\_lib/identity/lensAccounts

## Type Aliases

### LensUser

> **LensUser** = `object`

Defined in: [server/\_lib/identity/lensAccounts.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/lensAccounts.ts#L26)

#### Properties

##### accountAddress

> **accountAddress**: `string`

Defined in: [server/\_lib/identity/lensAccounts.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/lensAccounts.ts#L31)

##### avatar

> **avatar**: `string` \| `null`

Defined in: [server/\_lib/identity/lensAccounts.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/lensAccounts.ts#L30)

##### displayName

> **displayName**: `string`

Defined in: [server/\_lib/identity/lensAccounts.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/lensAccounts.ts#L27)

##### handle

> **handle**: `string` \| `null`

Defined in: [server/\_lib/identity/lensAccounts.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/lensAccounts.ts#L28)

##### ownerAddress

> **ownerAddress**: `string` \| `null`

Defined in: [server/\_lib/identity/lensAccounts.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/lensAccounts.ts#L32)

##### username

> **username**: `string` \| `null`

Defined in: [server/\_lib/identity/lensAccounts.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/lensAccounts.ts#L29)

## Functions

### resolveLensUserByOwner()

> **resolveLensUserByOwner**(`address`): `Promise`\<[`LensUser`](#lensuser) \| `null`\>

Defined in: [server/\_lib/identity/lensAccounts.ts:164](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/lensAccounts.ts#L164)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`LensUser`](#lensuser) \| `null`\>
