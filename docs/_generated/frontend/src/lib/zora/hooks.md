[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/zora/hooks

# src/lib/zora/hooks

## Functions

### useZoraCoin()

> **useZoraCoin**(`address?`): `UseQueryResult`\<[`ZoraCoin`](types.md#zoracoin) \| `null`, `Error`\>

Defined in: [src/lib/zora/hooks.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/hooks.ts#L15)

#### Parameters

##### address?

`string`

#### Returns

`UseQueryResult`\<[`ZoraCoin`](types.md#zoracoin) \| `null`, `Error`\>

***

### useZoraExplore()

> **useZoraExplore**(`list`, `params?`): `UseQueryResult`\<[`ZoraExploreList`](types.md#zoraexplorelist) \| `null`, `Error`\>

Defined in: [src/lib/zora/hooks.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/hooks.ts#L36)

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

Defined in: [src/lib/zora/hooks.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/hooks.ts#L26)

#### Parameters

##### identifier?

`string`

#### Returns

`UseQueryResult`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`, `Error`\>

***

### useZoraProfileCoins()

> **useZoraProfileCoins**(`identifier?`, `params?`): `UseQueryResult`\<[`ZoraProfile`](types.md#zoraprofile) \| `null`, `Error`\>

Defined in: [src/lib/zora/hooks.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/hooks.ts#L45)

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

Defined in: [src/lib/zora/hooks.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/hooks.ts#L60)

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
