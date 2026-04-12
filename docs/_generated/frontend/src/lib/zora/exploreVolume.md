[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/zora/exploreVolume

# src/lib/zora/exploreVolume

## Functions

### getZoraExploreVolumeColumnRaw()

> **getZoraExploreVolumeColumnRaw**(`coin`, `timeframe`): `string` \| `undefined`

Defined in: [src/lib/zora/exploreVolume.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/zora/exploreVolume.ts#L7)

Zora coins explore API exposes rolling 24h volume per coin (`volume24h`) and cumulative
`totalVolume` (all-time). There is no true multi-day window on explore responses besides those two.

#### Parameters

##### coin

[`ZoraCoin`](types.md#zoracoin)

##### timeframe

`string`

#### Returns

`string` \| `undefined`

***

### getZoraExploreVolumeForFees()

> **getZoraExploreVolumeForFees**(`coin`): `string` \| `undefined`

Defined in: [src/lib/zora/exploreVolume.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/zora/exploreVolume.ts#L17)

Always use 24h notional for fee estimates (fees accrue on recent trading; all-time volume would misstate fees).

#### Parameters

##### coin

[`ZoraCoin`](types.md#zoracoin)

#### Returns

`string` \| `undefined`

***

### getZoraExploreVolumeHeaderLabel()

> **getZoraExploreVolumeHeaderLabel**(`timeframe`): `string`

Defined in: [src/lib/zora/exploreVolume.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/zora/exploreVolume.ts#L35)

#### Parameters

##### timeframe

`string`

#### Returns

`string`

***

### getZoraExploreVolumeNote()

> **getZoraExploreVolumeNote**(`timeframe`): `string` \| `null`

Defined in: [src/lib/zora/exploreVolume.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/zora/exploreVolume.ts#L24)

Short note under explore time pills so users are not misled by column headers vs API reality.

#### Parameters

##### timeframe

`string`

#### Returns

`string` \| `null`
