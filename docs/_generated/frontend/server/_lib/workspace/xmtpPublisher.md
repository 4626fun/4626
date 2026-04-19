[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/workspace/xmtpPublisher

# server/\_lib/workspace/xmtpPublisher

## Type Aliases

### WorkspaceXmtpMessageType

> **WorkspaceXmtpMessageType** = `"approval_request"` \| `"approval_decision"` \| `"rebalance_suggestion"` \| `"risk_alert"` \| `"settlement_update"` \| `"status_summary"` \| `"task_update"`

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:3](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L3)

***

### WorkspaceXmtpPublishParams

> **WorkspaceXmtpPublishParams** = `object`

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:12](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L12)

#### Properties

##### body

> **body**: `string`

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L16)

##### dedupeKey?

> `optional` **dedupeKey**: `string` \| `null`

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L18)

##### messageType

> **messageType**: [`WorkspaceXmtpMessageType`](#workspacexmtpmessagetype)

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:14](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L14)

##### payload?

> `optional` **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L17)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L15)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L13)

***

### WorkspaceXmtpPublishResult

> **WorkspaceXmtpPublishResult** = \{ `actionId`: `number`; `groupId`: `string`; `queued`: `true`; \} \| \{ `queued`: `false`; `reason`: `string`; \}

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:21](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L21)

## Functions

### publishWorkspaceXmtpMessage()

> **publishWorkspaceXmtpMessage**(`params`): `Promise`\<[`WorkspaceXmtpPublishResult`](#workspacexmtppublishresult)\>

Defined in: [server/\_lib/workspace/xmtpPublisher.ts:40](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/workspace/xmtpPublisher.ts#L40)

#### Parameters

##### params

[`WorkspaceXmtpPublishParams`](#workspacexmtppublishparams)

#### Returns

`Promise`\<[`WorkspaceXmtpPublishResult`](#workspacexmtppublishresult)\>
