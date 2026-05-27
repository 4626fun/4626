[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/rowFormatting

# src/components/explore/rowFormatting

## Type Aliases

### FeeStatus

> **FeeStatus** = `object`

Defined in: [src/components/explore/rowFormatting.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L25)

#### Properties

##### feeRates

> **feeRates**: *typeof* `FEE_RATES_V4`

Defined in: [src/components/explore/rowFormatting.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L28)

##### isMigrated

> **isMigrated**: `boolean`

Defined in: [src/components/explore/rowFormatting.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L27)

##### isV4

> **isV4**: `boolean`

Defined in: [src/components/explore/rowFormatting.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L26)

## Functions

### buildGroupSpans()

> **buildGroupSpans**(`columns`): `object`[]

Defined in: [src/components/explore/rowFormatting.ts:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L137)

#### Parameters

##### columns

[`ExploreTableColumn`](tableColumns.md#exploretablecolumn)[]

#### Returns

`object`[]

***

### formatCompactNumber()

> **formatCompactNumber**(`value`): `string`

Defined in: [src/components/explore/rowFormatting.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L48)

#### Parameters

##### value

`string` | `number` | `undefined`

#### Returns

`string`

***

### formatFeeAmount()

> **formatFeeAmount**(`volume`, `totalFeeRate`, `splitRate`): `string`

Defined in: [src/components/explore/rowFormatting.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L60)

#### Parameters

##### volume

`string` | `undefined`

##### totalFeeRate

`number`

##### splitRate

`number`

#### Returns

`string`

***

### formatMarketCapDeltaPercent()

> **formatMarketCapDeltaPercent**(`deltaRaw`, `marketCapRaw`): `object`

Defined in: [src/components/explore/rowFormatting.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L109)

#### Parameters

##### deltaRaw

`string` | `undefined`

##### marketCapRaw

`string` | `undefined`

#### Returns

`object`

##### positive

> **positive**: `boolean`

##### text

> **text**: `string`

***

### getCoinFeeStatus()

> **getCoinFeeStatus**(`address`, `createdAt`, `migratedCoins?`): [`FeeStatus`](#feestatus)

Defined in: [src/components/explore/rowFormatting.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L31)

#### Parameters

##### address

`string` | `undefined`

##### createdAt

`string` | `undefined`

##### migratedCoins?

`Set`\<`string`\>

#### Returns

[`FeeStatus`](#feestatus)

***

### getMarketCapDeltaToneClass()

> **getMarketCapDeltaToneClass**(`change`): `string`

Defined in: [src/components/explore/rowFormatting.ts:130](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L130)

#### Parameters

##### change

###### positive

`boolean`

###### text

`string`

#### Returns

`string`

***

### resolveExploreFees24hDisplay()

> **resolveExploreFees24hDisplay**(`fees24hUsd`, `volumeForFees`, `totalFeeRate`): `string`

Defined in: [src/components/explore/rowFormatting.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L69)

Prefer indexed 24h fees from Supabase when present; fall back to volume × fee rate.

#### Parameters

##### fees24hUsd

`string` | `number` | `null` | `undefined`

##### volumeForFees

`string` | `undefined`

##### totalFeeRate

`number`

#### Returns

`string`

***

### shortAddress()

> **shortAddress**(`addr`): `string`

Defined in: [src/components/explore/rowFormatting.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/rowFormatting.ts#L81)

#### Parameters

##### addr

`string` | `undefined`

#### Returns

`string`
