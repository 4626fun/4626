[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/repointCanonicalCsw

# server/\_lib/wallet/repointCanonicalCsw

## Type Aliases

### RepointCanonicalCswResult

> **RepointCanonicalCswResult** = `object`

Defined in: [server/\_lib/wallet/repointCanonicalCsw.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/repointCanonicalCsw.ts#L3)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [server/\_lib/wallet/repointCanonicalCsw.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/repointCanonicalCsw.ts#L6)

##### clearedBaseSubAccount

> **clearedBaseSubAccount**: `string` \| `null`

Defined in: [server/\_lib/wallet/repointCanonicalCsw.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/repointCanonicalCsw.ts#L9)

##### nextEmbeddedEoa

> **nextEmbeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/repointCanonicalCsw.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/repointCanonicalCsw.ts#L8)

##### previousCswAddress

> **previousCswAddress**: `string` \| `null`

Defined in: [server/\_lib/wallet/repointCanonicalCsw.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/repointCanonicalCsw.ts#L5)

##### previousEmbeddedEoa

> **previousEmbeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/repointCanonicalCsw.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/repointCanonicalCsw.ts#L7)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/repointCanonicalCsw.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/repointCanonicalCsw.ts#L4)

## Functions

### repointCanonicalCswOnProfile()

> **repointCanonicalCswOnProfile**(`params`): `Promise`\<[`RepointCanonicalCswResult`](#repointcanonicalcswresult)\>

Defined in: [server/\_lib/wallet/repointCanonicalCsw.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/repointCanonicalCsw.ts#L37)

Operator/server repair when `profiles.csw_address` was pinned to a non-canonical
wallet (for example a Zora readonly smart-wallet candidate or an undeployed EOA).

#### Parameters

##### params

###### canonicalCswAddress

`string`

###### clearBaseSubAccount?

`boolean`

###### db

[`Db`](walletSync.md#db)

###### embeddedEoaAddress?

`string` \| `null`

###### profileId

`number`

#### Returns

`Promise`\<[`RepointCanonicalCswResult`](#repointcanonicalcswresult)\>
