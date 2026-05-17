[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agents/core/processXmtpAgentInput

# server/agents/core/processXmtpAgentInput

## Type Aliases

### ProcessXmtpAgentInputParams

> **ProcessXmtpAgentInputParams** = `object`

Defined in: [server/agents/core/processXmtpAgentInput.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L10)

#### Properties

##### groupId

> **groupId**: `string`

Defined in: [server/agents/core/processXmtpAgentInput.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L12)

##### runtimeContext

> **runtimeContext**: [`SharedConversationalRuntimeContext`](../../ai/chat.md#sharedconversationalruntimecontext)

Defined in: [server/agents/core/processXmtpAgentInput.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L14)

##### senderWallet

> **senderWallet**: `string`

Defined in: [server/agents/core/processXmtpAgentInput.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L13)

##### text

> **text**: `string`

Defined in: [server/agents/core/processXmtpAgentInput.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L11)

***

### XmtpAgentInputResult

> **XmtpAgentInputResult** = `object`

Defined in: [server/agents/core/processXmtpAgentInput.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L17)

#### Properties

##### responseText

> **responseText**: `string`

Defined in: [server/agents/core/processXmtpAgentInput.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L18)

## Functions

### processXmtpAgentInput()

> **processXmtpAgentInput**(`params`): `Promise`\<[`XmtpAgentInputResult`](#xmtpagentinputresult)\>

Defined in: [server/agents/core/processXmtpAgentInput.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L21)

#### Parameters

##### params

[`ProcessXmtpAgentInputParams`](#processxmtpagentinputparams)

#### Returns

`Promise`\<[`XmtpAgentInputResult`](#xmtpagentinputresult)\>
