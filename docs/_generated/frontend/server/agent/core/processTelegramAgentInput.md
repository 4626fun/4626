[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/core/processTelegramAgentInput

# server/agent/core/processTelegramAgentInput

## Type Aliases

### ProcessTelegramAgentInputParams

> **ProcessTelegramAgentInputParams** = `object`

Defined in: [server/agent/core/processTelegramAgentInput.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L15)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/agent/core/processTelegramAgentInput.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L17)

##### emptyResponseFallback?

> `optional` **emptyResponseFallback**: `string`

Defined in: [server/agent/core/processTelegramAgentInput.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L25)

##### groupId

> **groupId**: `string`

Defined in: [server/agent/core/processTelegramAgentInput.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L19)

##### isAdmin

> **isAdmin**: `boolean`

Defined in: [server/agent/core/processTelegramAgentInput.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L22)

##### isPrivateChat

> **isPrivateChat**: `boolean`

Defined in: [server/agent/core/processTelegramAgentInput.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L23)

##### senderWallet

> **senderWallet**: `` `0x${string}` ``

Defined in: [server/agent/core/processTelegramAgentInput.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L20)

##### senderWalletSource

> **senderWalletSource**: [`TelegramSenderWalletSource`](resolveIdentityContext.md#telegramsenderwalletsource)

Defined in: [server/agent/core/processTelegramAgentInput.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L21)

##### text

> **text**: `string`

Defined in: [server/agent/core/processTelegramAgentInput.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L16)

##### twitterConfirmMode?

> `optional` **twitterConfirmMode**: `"preview_only"` \| `"allow_direct_confirm"`

Defined in: [server/agent/core/processTelegramAgentInput.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L24)

##### userId

> **userId**: `string`

Defined in: [server/agent/core/processTelegramAgentInput.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L18)

***

### TelegramAgentInputResult

> **TelegramAgentInputResult** = `object`

Defined in: [server/agent/core/processTelegramAgentInput.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L10)

#### Properties

##### action?

> `optional` **action**: `unknown`

Defined in: [server/agent/core/processTelegramAgentInput.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L12)

##### responseText

> **responseText**: `string`

Defined in: [server/agent/core/processTelegramAgentInput.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L11)

## Functions

### processTelegramAgentInput()

> **processTelegramAgentInput**(`params`): `Promise`\<[`TelegramAgentInputResult`](#telegramagentinputresult)\>

Defined in: [server/agent/core/processTelegramAgentInput.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/processTelegramAgentInput.ts#L73)

#### Parameters

##### params

[`ProcessTelegramAgentInputParams`](#processtelegramagentinputparams)

#### Returns

`Promise`\<[`TelegramAgentInputResult`](#telegramagentinputresult)\>
