[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/zoraTokenSearch

# src/lib/swap/zoraTokenSearch

## Functions

### enrichDiscoveredSwapTokenOptions()

> **enrichDiscoveredSwapTokenOptions**(`options`): `Promise`\<[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]\>

Defined in: [src/lib/swap/zoraTokenSearch.ts:179](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraTokenSearch.ts#L179)

#### Parameters

##### options

[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]

#### Returns

`Promise`\<[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]\>

***

### normalizeSwapTokenSearchQuery()

> **normalizeSwapTokenSearchQuery**(`query`): `string`

Defined in: [src/lib/swap/zoraTokenSearch.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraTokenSearch.ts#L46)

#### Parameters

##### query

`string`

#### Returns

`string`

***

### searchZoraCreatorCoinsForSwap()

> **searchZoraCreatorCoinsForSwap**(`query`): `Promise`\<[`ZoraCoin`](../zora/types.md#zoracoin)[]\>

Defined in: [src/lib/swap/zoraTokenSearch.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraTokenSearch.ts#L57)

#### Parameters

##### query

`string`

#### Returns

`Promise`\<[`ZoraCoin`](../zora/types.md#zoracoin)[]\>

***

### shouldRunZoraSwapTokenSearch()

> **shouldRunZoraSwapTokenSearch**(`query`): `boolean`

Defined in: [src/lib/swap/zoraTokenSearch.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraTokenSearch.ts#L50)

#### Parameters

##### query

`string`

#### Returns

`boolean`

***

### zoraCoinsToSwapTokenOptions()

> **zoraCoinsToSwapTokenOptions**(`coins`, `chainId`): [`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]

Defined in: [src/lib/swap/zoraTokenSearch.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraTokenSearch.ts#L165)

#### Parameters

##### coins

[`ZoraCoin`](../zora/types.md#zoracoin)[]

##### chainId

`number` = `BASE_CHAIN_ID`

#### Returns

[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]

***

### zoraCoinToSwapTokenOption()

> **zoraCoinToSwapTokenOption**(`coin`, `chainId`): [`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption) \| `null`

Defined in: [src/lib/swap/zoraTokenSearch.ts:120](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/zoraTokenSearch.ts#L120)

#### Parameters

##### coin

[`ZoraCoin`](../zora/types.md#zoracoin)

##### chainId

`number` = `BASE_CHAIN_ID`

#### Returns

[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption) \| `null`
