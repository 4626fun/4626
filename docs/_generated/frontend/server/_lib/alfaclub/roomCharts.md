[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/roomCharts

# server/\_lib/alfaclub/roomCharts

## Type Aliases

### AlfaRoomChartAttachment

> **AlfaRoomChartAttachment** = `object`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L27)

#### Properties

##### filename

> **filename**: `string`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L30)

##### mime\_type

> **mime\_type**: `"image/png"`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L31)

##### type

> **type**: `"photo"`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L29)

##### url

> **url**: `string`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L28)

***

### AlfaRoomChartKind

> **AlfaRoomChartKind** = `"top-volume"` \| `"tier-mix"` \| `"pnl-distribution"`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L25)

***

### AlfaRoomChartResult

> **AlfaRoomChartResult** = `object`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L34)

#### Properties

##### attachment

> **attachment**: [`AlfaRoomChartAttachment`](#alfaroomchartattachment)

Defined in: [server/\_lib/alfaclub/roomCharts.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L38)

##### delivery

> **delivery**: `"ipfs"`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L39)

##### kind

> **kind**: [`AlfaRoomChartKind`](#alfaroomchartkind)

Defined in: [server/\_lib/alfaclub/roomCharts.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L35)

##### summary

> **summary**: `string`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L37)

##### title

> **title**: `string`

Defined in: [server/\_lib/alfaclub/roomCharts.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L36)

## Functions

### buildAlfaRoomChart()

> **buildAlfaRoomChart**(`params`): `Promise`\<\{ `chart`: [`AlfaRoomChartResult`](#alfaroomchartresult); `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/alfaclub/roomCharts.ts:319](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/roomCharts.ts#L319)

#### Parameters

##### params

###### kindRaw

`string` \| `null` \| `undefined`

###### limit

`number` \| `null` \| `undefined`

#### Returns

`Promise`\<\{ `chart`: [`AlfaRoomChartResult`](#alfaroomchartresult); `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>
