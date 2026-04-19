[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/explore/rowFormatting

# src/components/explore/rowFormatting

## Type Aliases

### FeeStatus

> **FeeStatus** = `object`

Defined in: [src/components/explore/rowFormatting.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L25)

#### Properties

##### feeRates

> **feeRates**: *typeof* `FEE_RATES_V4`

Defined in: [src/components/explore/rowFormatting.ts:28](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L28)

##### isMigrated

> **isMigrated**: `boolean`

Defined in: [src/components/explore/rowFormatting.ts:27](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L27)

##### isV4

> **isV4**: `boolean`

Defined in: [src/components/explore/rowFormatting.ts:26](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L26)

## Functions

### buildGroupSpans()

> **buildGroupSpans**(`columns`): `object`[]

Defined in: [src/components/explore/rowFormatting.ts:117](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L117)

#### Parameters

##### columns

[`ExploreTableColumn`](tableColumns.md#exploretablecolumn)[]

#### Returns

`object`[]

***

### formatCompactNumber()

> **formatCompactNumber**(`value`): `string`

Defined in: [src/components/explore/rowFormatting.ts:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L48)

#### Parameters

##### value

`string` | `number` | `undefined`

#### Returns

`string`

***

### formatFeeAmount()

> **formatFeeAmount**(`volume`, `totalFeeRate`, `splitRate`): `string`

Defined in: [src/components/explore/rowFormatting.ts:60](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L60)

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

Defined in: [src/components/explore/rowFormatting.ts:96](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L96)

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

Defined in: [src/components/explore/rowFormatting.ts:31](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L31)

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

### shortAddress()

> **shortAddress**(`addr`): `string`

Defined in: [src/components/explore/rowFormatting.ts:68](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/explore/rowFormatting.ts#L68)

#### Parameters

##### addr

`string` | `undefined`

#### Returns

`string`
