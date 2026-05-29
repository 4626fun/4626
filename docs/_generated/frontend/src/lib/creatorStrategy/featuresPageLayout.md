[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/creatorStrategy/featuresPageLayout

# src/lib/creatorStrategy/featuresPageLayout

## Type Aliases

### StrategyFeatureSection

> **StrategyFeatureSection** = `object`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L3)

#### Properties

##### features

> **features**: [`CatalogDto`](../../pages/CreatorStrategyFeatures.types.md#catalogdto)[]

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L7)

##### id

> **id**: `"deploy"` \| `"other"`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L4)

##### subtitle

> **subtitle**: `string`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L6)

##### title

> **title**: `string`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L5)

***

### VanityFeatureGroup

> **VanityFeatureGroup** = `object`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L10)

#### Properties

##### defaultNote

> **defaultNote**: `string`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L14)

##### features

> **features**: [`CatalogDto`](../../pages/CreatorStrategyFeatures.types.md#catalogdto)[]

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L15)

##### id

> **id**: `"vault_prefix"` \| `"share_suffix"`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L11)

##### subtitle

> **subtitle**: `string`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L13)

##### title

> **title**: `string`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L12)

## Functions

### partitionCreatorStrategyCatalog()

> **partitionCreatorStrategyCatalog**(`catalog`): `object`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L31)

#### Parameters

##### catalog

[`CatalogDto`](../../pages/CreatorStrategyFeatures.types.md#catalogdto)[]

#### Returns

`object`

##### sections

> **sections**: [`StrategyFeatureSection`](#strategyfeaturesection)[]

##### vanityGroups

> **vanityGroups**: [`VanityFeatureGroup`](#vanityfeaturegroup)[]

***

### vanityTierLabel()

> **vanityTierLabel**(`feature`): `string`

Defined in: [src/lib/creatorStrategy/featuresPageLayout.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/featuresPageLayout.ts#L98)

#### Parameters

##### feature

[`CatalogDto`](../../pages/CreatorStrategyFeatures.types.md#catalogdto)

#### Returns

`string`
