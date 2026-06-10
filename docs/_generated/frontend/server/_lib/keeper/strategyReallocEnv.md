[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/keeper/strategyReallocEnv

# server/\_lib/keeper/strategyReallocEnv

## Variables

### DEFAULT\_MIN\_DEVIATION\_BPS

> `const` **DEFAULT\_MIN\_DEVIATION\_BPS**: `500` = `500`

Defined in: [server/\_lib/keeper/strategyReallocEnv.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeper/strategyReallocEnv.ts#L3)

Shared env parsing for cross-strategy rebalanceStrategies() automation.

***

### MAX\_MIN\_DEVIATION\_BPS

> `const` **MAX\_MIN\_DEVIATION\_BPS**: `10000` = `10_000`

Defined in: [server/\_lib/keeper/strategyReallocEnv.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeper/strategyReallocEnv.ts#L4)

## Functions

### parseMinDeviationBps()

> **parseMinDeviationBps**(`raw?`): `number`

Defined in: [server/\_lib/keeper/strategyReallocEnv.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeper/strategyReallocEnv.ts#L6)

#### Parameters

##### raw?

`string` | `number` | `null`

#### Returns

`number`
