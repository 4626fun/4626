[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/agentControl/telegramTradeControl

# server/\_lib/agentControl/telegramTradeControl

## Type Aliases

### TelegramTradeActionType

> **TelegramTradeActionType** = `"buy"` \| `"sell"` \| `"bid"`

Defined in: [server/\_lib/agentControl/telegramTradeControl.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/telegramTradeControl.ts#L13)

***

### TelegramTradeControlAction

> **TelegramTradeControlAction** = *typeof* [`TELEGRAM_TRADE_CONTROL_ACTIONS`](#telegram_trade_control_actions)\[`number`\]

Defined in: [server/\_lib/agentControl/telegramTradeControl.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/telegramTradeControl.ts#L14)

## Variables

### TELEGRAM\_TRADE\_CONTROL\_ACTIONS

> `const` **TELEGRAM\_TRADE\_CONTROL\_ACTIONS**: readonly \[`"trade.buy"`, `"trade.sell"`, `"trade.bid"`\]

Defined in: [server/\_lib/agentControl/telegramTradeControl.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/telegramTradeControl.ts#L11)

***

### TELEGRAM\_TRADE\_CONTROL\_SUBSYSTEM

> `const` **TELEGRAM\_TRADE\_CONTROL\_SUBSYSTEM**: `"telegram_trade"` = `'telegram_trade'`

Defined in: [server/\_lib/agentControl/telegramTradeControl.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/telegramTradeControl.ts#L10)

## Functions

### buildTelegramTradeControlBundle()

> **buildTelegramTradeControlBundle**(`params`): `object`

Defined in: [server/\_lib/agentControl/telegramTradeControl.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/telegramTradeControl.ts#L37)

#### Parameters

##### params

###### actionType

[`TelegramTradeActionType`](#telegramtradeactiontype)

###### actorId

`string`

###### amountEth?

`number` \| `null`

###### amountInput?

`string` \| `null`

###### callbackKind

`string`

###### callbackToken

`string`

###### chainId?

`number`

###### chatId

`string`

###### consumedAt?

`string` \| `null`

###### creatorCoinAddress?

`string` \| `null`

###### expiresAt

`string`

###### intentPayload

`Record`\<`string`, `unknown`\>

###### targetAddress?

`string` \| `null`

###### usdEstimate?

`number` \| `null`

###### vaultAddress?

`string` \| `null`

#### Returns

`object`

##### amountEth

> **amountEth**: `number`

##### amountInput

> **amountInput**: `string`

##### capability

> **capability**: [`ControlCapability`](types.md#controlcapability)

##### chainId?

> `optional` **chainId**: `number`

##### controlAction

> **controlAction**: `"trade.buy"` \| `"trade.sell"` \| `"trade.bid"`

##### correlationId

> **correlationId**: `string`

##### proposal

> **proposal**: [`ActionProposal`](types.md#actionproposal)

##### scopedCreatorCoinAddress

> **scopedCreatorCoinAddress**: `` `0x${string}` `` \| `null`

##### scopedTargetAddress

> **scopedTargetAddress**: `` `0x${string}` `` \| `null`

##### scopedVaultAddress

> **scopedVaultAddress**: `` `0x${string}` `` \| `null`

##### subsystem

> **subsystem**: `"telegram_trade"`

##### usdEstimate

> **usdEstimate**: `number`
