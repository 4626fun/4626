[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/swapTokenLabels

# src/lib/swap/swapTokenLabels

## Functions

### enrichSwapTokenOption()

> **enrichSwapTokenOption**(`option`): `Promise`\<[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)\>

Defined in: [src/lib/swap/swapTokenLabels.ts:151](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapTokenLabels.ts#L151)

#### Parameters

##### option

[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)

#### Returns

`Promise`\<[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)\>

***

### enrichSwapTokenOptions()

> **enrichSwapTokenOptions**(`options`): `Promise`\<[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]\>

Defined in: [src/lib/swap/swapTokenLabels.ts:226](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapTokenLabels.ts#L226)

#### Parameters

##### options

[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]

#### Returns

`Promise`\<[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)[]\>

***

### isAddressLikeSwapSymbol()

> **isAddressLikeSwapSymbol**(`symbol`, `address`): `boolean`

Defined in: [src/lib/swap/swapTokenLabels.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapTokenLabels.ts#L55)

Truncated or full addresses used as placeholders should be replaced with real labels.

#### Parameters

##### symbol

`string` | `undefined`

##### address

`string`

#### Returns

`boolean`

***

### isOpaqueInternalTokenLabel()

> **isOpaqueInternalTokenLabel**(`value`): `boolean`

Defined in: [src/lib/swap/swapTokenLabels.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapTokenLabels.ts#L45)

Vault/XMTP group ids and other opaque ids must not be shown as token symbols.

#### Parameters

##### value

`string` | `undefined`

#### Returns

`boolean`

***

### resolveCreatorCoinLabelsFromZora()

> **resolveCreatorCoinLabelsFromZora**(`coin`, `address`): `object`

Defined in: [src/lib/swap/swapTokenLabels.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapTokenLabels.ts#L17)

#### Parameters

##### coin

[`ZoraCoin`](../zora/types.md#zoracoin)

##### address

`string`

#### Returns

`object`

##### name

> **name**: `string`

##### symbol

> **symbol**: `string`

***

### resolveSwapTokenLabels()

> **resolveSwapTokenLabels**(`address`, `chainId`): `Promise`\<\{ `logoUrl?`: `string`; `name`: `string`; `symbol`: `string`; \}\>

Defined in: [src/lib/swap/swapTokenLabels.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapTokenLabels.ts#L90)

#### Parameters

##### address

`string`

##### chainId

`number` = `BASE_CHAIN_ID`

#### Returns

`Promise`\<\{ `logoUrl?`: `string`; `name`: `string`; `symbol`: `string`; \}\>

***

### swapTokenOptionNeedsLabelEnrichment()

> **swapTokenOptionNeedsLabelEnrichment**(`option`): `boolean`

Defined in: [src/lib/swap/swapTokenLabels.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapTokenLabels.ts#L70)

#### Parameters

##### option

[`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)

#### Returns

`boolean`
