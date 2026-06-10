[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/hyperliquid

# server/\_lib/alfaclub/hyperliquid

## Type Aliases

### HyperliquidClearinghouseState

> **HyperliquidClearinghouseState** = `object`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L26)

#### Properties

##### accountValueUsd

> **accountValueUsd**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L27)

##### totalNtlPosUsd

> **totalNtlPosUsd**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L28)

##### totalRawUsdUsd

> **totalRawUsdUsd**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L29)

***

### HyperliquidSnapshot

> **HyperliquidSnapshot** = `object`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L38)

#### Properties

##### accountValueUsd

> **accountValueUsd**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L40)

##### address

> **address**: `string`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L39)

##### errorReason

> **errorReason**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L45)

##### fetchedAt

> **fetchedAt**: `string`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L43)

##### fills30d

> **fills30d**: `number`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L42)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L44)

##### pnl30dUsd

> **pnl30dUsd**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L41)

***

### HyperliquidUserFill

> **HyperliquidUserFill** = `object`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L32)

#### Properties

##### closedPnl

> **closedPnl**: `number`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L33)

##### fee

> **fee**: `number`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L34)

##### time

> **time**: `number`

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L35)

## Functions

### getClearinghouseState()

> **getClearinghouseState**(`address`): `Promise`\<[`HyperliquidClearinghouseState`](#hyperliquidclearinghousestate) \| `null`\>

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:111](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L111)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`HyperliquidClearinghouseState`](#hyperliquidclearinghousestate) \| `null`\>

***

### getHyperliquidSnapshot()

> **getHyperliquidSnapshot**(`address`): `Promise`\<[`HyperliquidSnapshot`](#hyperliquidsnapshot)\>

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:171](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L171)

Compose a Hyperliquid snapshot for an address:
 - account value from `clearinghouseState`
 - realized PnL (closedPnl - fees) over the last 30 days from `userFillsByTime`

Returns `ok: false` with a reason if Hyperliquid is unreachable. Never throws.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`HyperliquidSnapshot`](#hyperliquidsnapshot)\>

***

### getUserFills30d()

> **getUserFills30d**(`address`, `now`): `Promise`\<[`HyperliquidUserFill`](#hyperliquiduserfill)[] \| `null`\>

Defined in: [server/\_lib/alfaclub/hyperliquid.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hyperliquid.ts#L137)

#### Parameters

##### address

`string`

##### now

`Date` = `...`

#### Returns

`Promise`\<[`HyperliquidUserFill`](#hyperliquiduserfill)[] \| `null`\>
