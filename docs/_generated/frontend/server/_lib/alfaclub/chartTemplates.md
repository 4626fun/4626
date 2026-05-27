[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/chartTemplates

# server/\_lib/alfaclub/chartTemplates

## Type Aliases

### PnlBucket

> **PnlBucket** = `object`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:614](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L614)

#### Properties

##### bucketEnd

> **bucketEnd**: `number`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:614](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L614)

##### bucketStart

> **bucketStart**: `number`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:614](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L614)

##### rooms

> **rooms**: `number`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:614](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L614)

***

### PnlDistributionInput

> **PnlDistributionInput** = `object`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:616](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L616)

#### Properties

##### avatarDataUrl?

> `optional` **avatarDataUrl**: `string`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:619](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L619)

##### buckets

> **buckets**: [`PnlBucket`](#pnlbucket)[]

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:617](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L617)

##### totalRooms

> **totalRooms**: `number`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:618](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L618)

***

### TierMixInput

> **TierMixInput** = `object`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:473](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L473)

#### Properties

##### avatarDataUrl?

> `optional` **avatarDataUrl**: `string`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:476](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L476)

##### segments

> **segments**: `object`[]

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:474](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L474)

###### label

> **label**: `string`

###### rooms

> **rooms**: `number`

##### totalRooms

> **totalRooms**: `number`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:475](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L475)

***

### TopVolumeInput

> **TopVolumeInput** = `object`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:326](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L326)

#### Properties

##### avatarDataUrl?

> `optional` **avatarDataUrl**: `string`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:329](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L329)

##### rows

> **rows**: `object`[]

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:327](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L327)

###### name

> **name**: `string`

###### subtitle?

> `optional` **subtitle**: `string`

###### volume

> **volume**: `number`

##### totalVolume

> **totalVolume**: `number`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:328](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L328)

## Variables

### CHART\_CANVAS

> `const` **CHART\_CANVAS**: `object` = `CANVAS`

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:907](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L907)

#### Type Declaration

##### height

> `readonly` **height**: `1200` = `1200`

##### width

> `readonly` **width**: `1200` = `1200`

## Functions

### buildPnlDistributionTree()

> **buildPnlDistributionTree**(`input`): [`SatoriNode`](satoriRenderer.md#satorinode)

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:657](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L657)

#### Parameters

##### input

[`PnlDistributionInput`](#pnldistributioninput)

#### Returns

[`SatoriNode`](satoriRenderer.md#satorinode)

***

### buildTierMixTree()

> **buildTierMixTree**(`input`): [`SatoriNode`](satoriRenderer.md#satorinode)

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:479](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L479)

#### Parameters

##### input

[`TierMixInput`](#tiermixinput)

#### Returns

[`SatoriNode`](satoriRenderer.md#satorinode)

***

### buildTopVolumeTree()

> **buildTopVolumeTree**(`input`): [`SatoriNode`](satoriRenderer.md#satorinode)

Defined in: [server/\_lib/alfaclub/chartTemplates.ts:332](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/chartTemplates.ts#L332)

#### Parameters

##### input

[`TopVolumeInput`](#topvolumeinput)

#### Returns

[`SatoriNode`](satoriRenderer.md#satorinode)
