[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/coinParties

# server/\_lib/onchain/coinParties

## Functions

### isAddressLike()

> **isAddressLike**(`value`): `boolean`

Defined in: [server/\_lib/onchain/coinParties.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/coinParties.ts#L22)

#### Parameters

##### value

`string`

#### Returns

`boolean`

***

### resolveCoinParties()

> **resolveCoinParties**(`coin`): `Promise`\<\{ `creator`: `` `0x${string}` `` \| `null`; `payoutRecipient`: `` `0x${string}` `` \| `null`; \}\>

Defined in: [server/\_lib/onchain/coinParties.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/coinParties.ts#L57)

#### Parameters

##### coin

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `creator`: `` `0x${string}` `` \| `null`; `payoutRecipient`: `` `0x${string}` `` \| `null`; \}\>

***

### resolveCoinPartiesAndOwner()

> **resolveCoinPartiesAndOwner**(`coin`): `Promise`\<\{ `creator`: `` `0x${string}` `` \| `null`; `owner`: `` `0x${string}` `` \| `null`; `payoutRecipient`: `` `0x${string}` `` \| `null`; \}\>

Defined in: [server/\_lib/onchain/coinParties.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/coinParties.ts#L77)

#### Parameters

##### coin

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `creator`: `` `0x${string}` `` \| `null`; `owner`: `` `0x${string}` `` \| `null`; `payoutRecipient`: `` `0x${string}` `` \| `null`; \}\>
