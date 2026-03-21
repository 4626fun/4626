[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/trade/fsm

# api/\_handlers/telegram/webhook/trade/fsm

## Variables

### TRADE\_FLOW\_IDLE\_STATE

> `const` **TRADE\_FLOW\_IDLE\_STATE**: [`TradeFlowState`](types.md#tradeflowstate)

Defined in: [api/\_handlers/telegram/webhook/trade/fsm.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/trade/fsm.ts#L3)

## Functions

### deriveActionTypeFromState()

> **deriveActionTypeFromState**(`state`): `"buy"` \| `"sell"` \| `"bid"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/trade/fsm.ts:71](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/trade/fsm.ts#L71)

#### Parameters

##### state

[`TradeFlowState`](types.md#tradeflowstate)

#### Returns

`"buy"` \| `"sell"` \| `"bid"` \| `null`

***

### reduceTradeFlowState()

> **reduceTradeFlowState**(`current`, `event`): [`TradeFlowState`](types.md#tradeflowstate)

Defined in: [api/\_handlers/telegram/webhook/trade/fsm.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/trade/fsm.ts#L5)

#### Parameters

##### current

[`TradeFlowState`](types.md#tradeflowstate)

##### event

[`TradeFlowEvent`](types.md#tradeflowevent)

#### Returns

[`TradeFlowState`](types.md#tradeflowstate)
