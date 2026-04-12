[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/coinParties

# server/\_lib/coinParties

## Functions

### isAddressLike()

> **isAddressLike**(`value`): `boolean`

Defined in: [server/\_lib/coinParties.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/coinParties.ts#L3)

#### Parameters

##### value

`string`

#### Returns

`boolean`

***

### resolveCoinParties()

> **resolveCoinParties**(`coin`): `Promise`\<\{ `creator`: `` `0x${string}` `` \| `null`; `payoutRecipient`: `` `0x${string}` `` \| `null`; \}\>

Defined in: [server/\_lib/coinParties.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/coinParties.ts#L38)

#### Parameters

##### coin

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `creator`: `` `0x${string}` `` \| `null`; `payoutRecipient`: `` `0x${string}` `` \| `null`; \}\>

***

### resolveCoinPartiesAndOwner()

> **resolveCoinPartiesAndOwner**(`coin`): `Promise`\<\{ `creator`: `` `0x${string}` `` \| `null`; `owner`: `` `0x${string}` `` \| `null`; `payoutRecipient`: `` `0x${string}` `` \| `null`; \}\>

Defined in: [server/\_lib/coinParties.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/coinParties.ts#L58)

#### Parameters

##### coin

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `creator`: `` `0x${string}` `` \| `null`; `owner`: `` `0x${string}` `` \| `null`; `payoutRecipient`: `` `0x${string}` `` \| `null`; \}\>
