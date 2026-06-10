[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/zora/client

# src/lib/zora/client

## Functions

### fetchZoraCoin()

> **fetchZoraCoin**(`address`, `chainId`): `Promise`\<[`ZoraCoin`](types.md#zoracoin) \| `null`\>

Defined in: [src/lib/zora/client.ts:245](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L245)

#### Parameters

##### address

`string`

##### chainId

`number` = `base.id`

#### Returns

`Promise`\<[`ZoraCoin`](types.md#zoracoin) \| `null`\>

***

### fetchZoraExplore()

> **fetchZoraExplore**(`params`): `Promise`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`\>

Defined in: [src/lib/zora/client.ts:332](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L332)

#### Parameters

##### params

###### after?

`string`

###### count?

`number`

###### ethosMin?

`number`

###### list

[`ZoraExploreListType`](types.md#zoraexplorelisttype)

###### sort?

`"ETHOS_SCORE"`

#### Returns

`Promise`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`\>

***

### fetchZoraProfile()

> **fetchZoraProfile**(`identifier`): `Promise`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`\>

Defined in: [src/lib/zora/client.ts:270](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L270)

#### Parameters

##### identifier

`string`

#### Returns

`Promise`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`\>

***

### fetchZoraProfileCoins()

> **fetchZoraProfileCoins**(`params`): `Promise`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`\>

Defined in: [src/lib/zora/client.ts:293](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L293)

#### Parameters

##### params

###### after?

`string`

###### count?

`number`

###### identifier

`string`

#### Returns

`Promise`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`\>

***

### fetchZoraTopCreators()

> **fetchZoraTopCreators**(`params?`): `Promise`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`\>

Defined in: [src/lib/zora/client.ts:405](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L405)

#### Parameters

##### params?

###### after?

`string`

###### count?

`number`

#### Returns

`Promise`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`\>

***

### getZoraClientTelemetrySnapshot()

> **getZoraClientTelemetrySnapshot**(): `Record`\<`ZoraClientOperation`, `ZoraClientCounters`\>

Defined in: [src/lib/zora/client.ts:135](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L135)

#### Returns

`Record`\<`ZoraClientOperation`, `ZoraClientCounters`\>

***

### normalizeZoraCoinAddress()

> **normalizeZoraCoinAddress**(`address`): `string`

Defined in: [src/lib/zora/client.ts:219](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L219)

#### Parameters

##### address

`string`

#### Returns

`string`

***

### normalizeZoraProfileIdentifier()

> **normalizeZoraProfileIdentifier**(`identifier`): `string`

Defined in: [src/lib/zora/client.ts:223](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L223)

#### Parameters

##### identifier

`string`

#### Returns

`string`

***

### resetZoraClientDebugState()

> **resetZoraClientDebugState**(): `void`

Defined in: [src/lib/zora/client.ts:152](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L152)

#### Returns

`void`

***

### resetZoraClientTelemetry()

> **resetZoraClientTelemetry**(): `void`

Defined in: [src/lib/zora/client.ts:144](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/client.ts#L144)

#### Returns

`void`
