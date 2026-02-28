[**4626-miniapp**](../../../index.md)

***

[4626-miniapp](../../../index.md) / src/lib/zora/client

# src/lib/zora/client

## Functions

### fetchZoraCoin()

> **fetchZoraCoin**(`address`, `chainId`): `Promise`\<[`ZoraCoin`](types.md#zoracoin) \| `null`\>

Defined in: [lib/zora/client.ts:25](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/client.ts#L25)

#### Parameters

##### address

`` `0x${string}` ``

##### chainId

`number` = `base.id`

#### Returns

`Promise`\<[`ZoraCoin`](types.md#zoracoin) \| `null`\>

***

### fetchZoraExplore()

> **fetchZoraExplore**(`params`): `Promise`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`\>

Defined in: [lib/zora/client.ts:88](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/client.ts#L88)

#### Parameters

##### params

###### after?

`string`

###### count?

`number`

###### list

[`ZoraExploreListType`](types.md#zoraexplorelisttype)

#### Returns

`Promise`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`\>

***

### fetchZoraProfile()

> **fetchZoraProfile**(`identifier`): `Promise`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`\>

Defined in: [lib/zora/client.ts:42](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/client.ts#L42)

#### Parameters

##### identifier

`string`

#### Returns

`Promise`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`\>

***

### fetchZoraProfileCoins()

> **fetchZoraProfileCoins**(`params`): `Promise`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`\>

Defined in: [lib/zora/client.ts:58](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/client.ts#L58)

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

Defined in: [lib/zora/client.ts:141](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/client.ts#L141)

#### Parameters

##### params?

###### after?

`string`

###### count?

`number`

#### Returns

`Promise`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`\>
