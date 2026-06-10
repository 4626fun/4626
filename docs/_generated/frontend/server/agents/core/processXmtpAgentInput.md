[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/agents/core/processXmtpAgentInput

# server/agents/core/processXmtpAgentInput

## Type Aliases

### ProcessXmtpAgentInputParams

> **ProcessXmtpAgentInputParams** = `object`

Defined in: [server/agents/core/processXmtpAgentInput.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L15)

#### Properties

##### groupId

> **groupId**: `string`

Defined in: [server/agents/core/processXmtpAgentInput.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L17)

##### runtimeContext

> **runtimeContext**: [`SharedConversationalRuntimeContext`](../../ai/chat.md#sharedconversationalruntimecontext)

Defined in: [server/agents/core/processXmtpAgentInput.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L19)

##### senderWallet

> **senderWallet**: `string`

Defined in: [server/agents/core/processXmtpAgentInput.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L18)

##### text

> **text**: `string`

Defined in: [server/agents/core/processXmtpAgentInput.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L16)

***

### XmtpAgentInputResult

> **XmtpAgentInputResult** = `object`

Defined in: [server/agents/core/processXmtpAgentInput.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L22)

#### Properties

##### responseText

> **responseText**: `string`

Defined in: [server/agents/core/processXmtpAgentInput.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L23)

## Functions

### processXmtpAgentInput()

> **processXmtpAgentInput**(`params`): `Promise`\<[`XmtpAgentInputResult`](#xmtpagentinputresult)\>

Defined in: [server/agents/core/processXmtpAgentInput.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/processXmtpAgentInput.ts#L26)

#### Parameters

##### params

[`ProcessXmtpAgentInputParams`](#processxmtpagentinputparams)

#### Returns

`Promise`\<[`XmtpAgentInputResult`](#xmtpagentinputresult)\>
