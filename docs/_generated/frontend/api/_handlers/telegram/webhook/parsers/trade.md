[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/trade

# api/\_handlers/telegram/webhook/parsers/trade

## Functions

### commandHasArguments()

> **commandHasArguments**(`rawText`, `head`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/trade.ts:43](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/parsers/trade.ts#L43)

#### Parameters

##### rawText

`string`

##### head

[`InteractiveTradeAction`](../types.md#interactivetradeaction)

#### Returns

`boolean`

***

### parseTelegramTradeIntent()

> **parseTelegramTradeIntent**(`rawText`): [`ParsedTelegramTradeIntent`](../types.md#parsedtelegramtradeintent) \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/trade.ts:4](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/parsers/trade.ts#L4)

#### Parameters

##### rawText

`string`

#### Returns

[`ParsedTelegramTradeIntent`](../types.md#parsedtelegramtradeintent) \| `null`

***

### parseTradeCallbackData()

> **parseTradeCallbackData**(`rawData`): \{ `kind`: `"accept"` \| `"decline"`; `token`: `string`; \} \| \{ `actionType`: `"buy"` \| `"sell"` \| `"bid"`; `kind`: `"edit"`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/trade.ts:110](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/parsers/trade.ts#L110)

#### Parameters

##### rawData

`string`

#### Returns

\{ `kind`: `"accept"` \| `"decline"`; `token`: `string`; \} \| \{ `actionType`: `"buy"` \| `"sell"` \| `"bid"`; `kind`: `"edit"`; \} \| `null`

***

### parseTradeFlowCallbackData()

> **parseTradeFlowCallbackData**(`rawData`): \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `kind`: `"vault"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `kind`: `"percent"`; `percentBps`: `number`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `kind`: `"custom"`; `vaultAddress`: `` `0x${string}` ``; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/trade.ts:71](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/parsers/trade.ts#L71)

#### Parameters

##### rawData

`string`

#### Returns

\{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `kind`: `"vault"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `kind`: `"percent"`; `percentBps`: `number`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `kind`: `"custom"`; `vaultAddress`: `` `0x${string}` ``; \} \| `null`

***

### resolveTradeTarget()

> **resolveTradeTarget**(`scopedVaults`, `identifier`): [`ScopedVaultRow`](../types.md#scopedvaultrow) \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/trade.ts:52](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/parsers/trade.ts#L52)

#### Parameters

##### scopedVaults

[`ScopedVaultRow`](../types.md#scopedvaultrow)[]

##### identifier

`string`

#### Returns

[`ScopedVaultRow`](../types.md#scopedvaultrow) \| `null`
