[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/trade/types

# api/\_handlers/telegram/webhook/trade/types

## Type Aliases

### TradeFlowEvent

> **TradeFlowEvent** = \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `type`: `"START"`; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `type`: `"VAULT_SELECTED"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `percentBps`: `number`; `type`: `"PERCENT_SELECTED"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `type`: `"CUSTOM_SELECTED"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `percentBps`: `number`; `type`: `"CUSTOM_INPUT_VALID"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `reason`: `string`; `type`: `"CUSTOM_INPUT_INVALID"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `token`: `string`; `type`: `"ACCEPT"`; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `token?`: `string`; `type`: `"DECLINE"`; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `reason`: `string`; `type`: `"TOKEN_INVALID"`; \}

Defined in: [api/\_handlers/telegram/webhook/trade/types.ts:13](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/trade/types.ts#L13)

***

### TradeFlowState

> **TradeFlowState** = \{ `status`: `"Idle"`; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `status`: `"VaultSelect"`; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `status`: `"SizeSelect"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `status`: `"CustomPercentAwaitingInput"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `percentBps`: `number`; `status`: `"PreviewReady"`; `vaultAddress`: `` `0x${string}` ``; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `status`: `"Executing"`; `token`: `string`; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `status`: `"Completed"`; `token?`: `string`; \} \| \{ `actionType`: [`InteractiveTradeAction`](../types.md#interactivetradeaction); `reason`: `string`; `status`: `"Failed"`; \}

Defined in: [api/\_handlers/telegram/webhook/trade/types.ts:3](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/trade/types.ts#L3)
