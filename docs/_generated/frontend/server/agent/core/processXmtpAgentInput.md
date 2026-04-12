[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/core/processXmtpAgentInput

# server/agent/core/processXmtpAgentInput

## Type Aliases

### ProcessXmtpAgentInputParams

> **ProcessXmtpAgentInputParams** = `object`

Defined in: [server/agent/core/processXmtpAgentInput.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/core/processXmtpAgentInput.ts#L10)

#### Properties

##### groupId

> **groupId**: `string`

Defined in: [server/agent/core/processXmtpAgentInput.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/core/processXmtpAgentInput.ts#L12)

##### runtimeContext

> **runtimeContext**: [`SharedConversationalRuntimeContext`](../../ai/chat.md#sharedconversationalruntimecontext)

Defined in: [server/agent/core/processXmtpAgentInput.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/core/processXmtpAgentInput.ts#L14)

##### senderWallet

> **senderWallet**: `string`

Defined in: [server/agent/core/processXmtpAgentInput.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/core/processXmtpAgentInput.ts#L13)

##### text

> **text**: `string`

Defined in: [server/agent/core/processXmtpAgentInput.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/core/processXmtpAgentInput.ts#L11)

***

### XmtpAgentInputResult

> **XmtpAgentInputResult** = `object`

Defined in: [server/agent/core/processXmtpAgentInput.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/core/processXmtpAgentInput.ts#L17)

#### Properties

##### responseText

> **responseText**: `string`

Defined in: [server/agent/core/processXmtpAgentInput.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/core/processXmtpAgentInput.ts#L18)

## Functions

### processXmtpAgentInput()

> **processXmtpAgentInput**(`params`): `Promise`\<[`XmtpAgentInputResult`](#xmtpagentinputresult)\>

Defined in: [server/agent/core/processXmtpAgentInput.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/core/processXmtpAgentInput.ts#L21)

#### Parameters

##### params

[`ProcessXmtpAgentInputParams`](#processxmtpagentinputparams)

#### Returns

`Promise`\<[`XmtpAgentInputResult`](#xmtpagentinputresult)\>
