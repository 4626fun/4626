[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/zora/hooks

# src/lib/zora/hooks

## Functions

### useZoraCoin()

> **useZoraCoin**(`address?`): `UseQueryResult`\<[`ZoraCoin`](types.md#zoracoin) \| `null`, `Error`\>

Defined in: [lib/zora/hooks.ts:7](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/hooks.ts#L7)

#### Parameters

##### address?

`` `0x${string}` ``

#### Returns

`UseQueryResult`\<[`ZoraCoin`](types.md#zoracoin) \| `null`, `Error`\>

***

### useZoraExplore()

> **useZoraExplore**(`list`, `params?`): `UseQueryResult`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`, `Error`\>

Defined in: [lib/zora/hooks.ts:26](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/hooks.ts#L26)

#### Parameters

##### list

[`ZoraExploreListType`](types.md#zoraexplorelisttype)

##### params?

###### after?

`string`

###### count?

`number`

###### enabled?

`boolean`

#### Returns

`UseQueryResult`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`, `Error`\>

***

### useZoraProfile()

> **useZoraProfile**(`identifier?`): `UseQueryResult`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`, `Error`\>

Defined in: [lib/zora/hooks.ts:17](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/hooks.ts#L17)

#### Parameters

##### identifier?

`string`

#### Returns

`UseQueryResult`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`, `Error`\>

***

### useZoraProfileCoins()

> **useZoraProfileCoins**(`identifier?`, `params?`): `UseQueryResult`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`, `Error`\>

Defined in: [lib/zora/hooks.ts:35](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/hooks.ts#L35)

#### Parameters

##### identifier?

`string`

##### params?

###### after?

`string`

###### count?

`number`

#### Returns

`UseQueryResult`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`, `Error`\>

***

### useZoraTopCreators()

> **useZoraTopCreators**(`params?`): `UseQueryResult`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`, `Error`\>

Defined in: [lib/zora/hooks.ts:49](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/hooks.ts#L49)

#### Parameters

##### params?

###### after?

`string`

###### count?

`number`

###### enabled?

`boolean`

#### Returns

`UseQueryResult`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`, `Error`\>
