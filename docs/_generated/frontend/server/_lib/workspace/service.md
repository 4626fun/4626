[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/workspace/service

# server/\_lib/workspace/service

## Type Aliases

### WorkspaceActivityItem

> **WorkspaceActivityItem** = `object`

Defined in: [server/\_lib/workspace/service.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L124)

#### Properties

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/service.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L131)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L132)

##### description

> **description**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:129](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L129)

##### eventType

> **eventType**: `string`

Defined in: [server/\_lib/workspace/service.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L127)

##### id

> **id**: `string`

Defined in: [server/\_lib/workspace/service.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L125)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/service.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L133)

##### severity

> **severity**: [`WorkspaceSeverity`](repository.md#workspaceseverity)

Defined in: [server/\_lib/workspace/service.ts:130](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L130)

##### source

> **source**: `"workspace"` \| `"keepr"` \| `"chat"` \| `"kpr"`

Defined in: [server/\_lib/workspace/service.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L126)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/service.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L128)

***

### WorkspaceMonitoringResponse

> **WorkspaceMonitoringResponse** = `object`

Defined in: [server/\_lib/workspace/service.ts:104](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L104)

#### Properties

##### alerts

> **alerts**: [`WorkspaceAlertEvent`](repository.md#workspacealertevent)[]

Defined in: [server/\_lib/workspace/service.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L112)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L121)

##### incidents

> **incidents**: [`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)[]

Defined in: [server/\_lib/workspace/service.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L113)

##### latestSnapshotId

> **latestSnapshotId**: `number` \| `null`

Defined in: [server/\_lib/workspace/service.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L120)

##### sections

> **sections**: `CheckSection`[]

Defined in: [server/\_lib/workspace/service.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L105)

##### summary

> **summary**: `object`

Defined in: [server/\_lib/workspace/service.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L106)

###### fail

> **fail**: `number`

###### info

> **info**: `number`

###### pass

> **pass**: `number`

###### warn

> **warn**: `number`

##### trend

> **trend**: `object`[]

Defined in: [server/\_lib/workspace/service.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L114)

###### fail

> **fail**: `number`

###### pass

> **pass**: `number`

###### timestamp

> **timestamp**: `string`

###### warn

> **warn**: `number`

***

### WorkspaceRoomsResponse

> **WorkspaceRoomsResponse** = `object`

Defined in: [server/\_lib/workspace/service.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L136)

#### Properties

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:154](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L154)

##### telegram

> **telegram**: `object`

Defined in: [server/\_lib/workspace/service.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L137)

###### chatId

> **chatId**: `string` \| `null`

###### enabled

> **enabled**: `boolean`

###### graceHours

> **graceHours**: `number` \| `null`

###### linked

> **linked**: `boolean`

###### memberCount

> **memberCount**: `number`

###### minSharesRaw

> **minSharesRaw**: `string` \| `null`

###### recentSummaries

> **recentSummaries**: [`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)[]

###### roomChatId

> **roomChatId**: `string` \| `null`

##### xmtp

> **xmtp**: `object`

Defined in: [server/\_lib/workspace/service.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L147)

###### agentAddress

> **agentAddress**: `` `0x${string}` `` \| `null`

###### agentType

> **agentType**: `"eoa"` \| `"csw"` \| `null`

###### conversationId

> **conversationId**: `string` \| `null`

###### linked

> **linked**: `boolean`

###### recentMessages

> **recentMessages**: [`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)[]

***

### WorkspaceSettingsResponse

> **WorkspaceSettingsResponse** = `object`

Defined in: [server/\_lib/workspace/service.ts:163](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L163)

#### Properties

##### automation

> **automation**: `object`

Defined in: [server/\_lib/workspace/service.ts:167](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L167)

###### enabled

> **enabled**: `boolean`

###### scope

> **scope**: `string` \| `null`

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:171](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L171)

##### notificationPreferences

> **notificationPreferences**: `ReturnType`\<*typeof* [`listNotificationPreferences`](repository.md#listnotificationpreferences)\> *extends* `Promise`\<infer T\> ? `T` : `never`

Defined in: [server/\_lib/workspace/service.ts:164](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L164)

##### strategyTargets

> **strategyTargets**: [`WorkspaceStrategyTarget`](repository.md#workspacestrategytarget)[]

Defined in: [server/\_lib/workspace/service.ts:165](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L165)

##### thresholds

> **thresholds**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/service.ts:166](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L166)

***

### WorkspaceStrategyRow

> **WorkspaceStrategyRow** = `object`

Defined in: [server/\_lib/workspace/service.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L87)

#### Properties

##### asset

> **asset**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/service.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L97)

##### availableActions

> **availableActions**: `string`[]

Defined in: [server/\_lib/workspace/service.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L101)

##### currentWeightRaw

> **currentWeightRaw**: `string`

Defined in: [server/\_lib/workspace/service.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L92)

##### isActive

> **isActive**: `boolean` \| `null`

Defined in: [server/\_lib/workspace/service.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L91)

##### kind

> **kind**: `"ajna"` \| `"charm"` \| `"solana"` \| `"unknown"`

Defined in: [server/\_lib/workspace/service.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L89)

##### lastRebalanceAt

> **lastRebalanceAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L100)

##### liquidityHint

> **liquidityHint**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L98)

##### maxAssetsCap

> **maxAssetsCap**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L95)

Operator-intended on-chain cap mirror; uint256 as decimal string, or null.

##### owner

> **owner**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/service.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L96)

##### performanceHint

> **performanceHint**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L99)

##### status

> **status**: `"active"` \| `"paused"` \| `"inactive"` \| `"unknown"`

Defined in: [server/\_lib/workspace/service.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L90)

##### strategyAddress

> **strategyAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/service.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L88)

##### targetWeightBps

> **targetWeightBps**: `number` \| `null`

Defined in: [server/\_lib/workspace/service.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L93)

***

### WorkspaceSummaryResponse

> **WorkspaceSummaryResponse** = `object`

Defined in: [server/\_lib/workspace/service.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L43)

#### Properties

##### automation

> **automation**: `object`

Defined in: [server/\_lib/workspace/service.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L78)

###### canonicalCswAddress

> **canonicalCswAddress**: `` `0x${string}` `` \| `null`

###### embeddedEoaAddress

> **embeddedEoaAddress**: `` `0x${string}` `` \| `null`

###### enabled

> **enabled**: `boolean`

###### scope

> **scope**: `string` \| `null`

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/service.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L47)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L84)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/workspace/service.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L45)

##### latestActivity

> **latestActivity**: [`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)[]

Defined in: [server/\_lib/workspace/service.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L77)

##### latestAlerts

> **latestAlerts**: [`WorkspaceAlertEvent`](repository.md#workspacealertevent)[]

Defined in: [server/\_lib/workspace/service.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L76)

##### metrics

> **metrics**: `object`

Defined in: [server/\_lib/workspace/service.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L53)

###### activeStrategyCount

> **activeStrategyCount**: `number`

###### configuredTargetCount

> **configuredTargetCount**: `number`

###### openAlerts

> **openAlerts**: `number`

###### pendingApprovals

> **pendingApprovals**: `number`

###### pendingTasks

> **pendingTasks**: `number`

###### strategyCount

> **strategyCount**: `number`

##### ownerAddress

> **ownerAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/service.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L46)

##### rooms

> **rooms**: `object`

Defined in: [server/\_lib/workspace/service.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L61)

###### telegram

> **telegram**: `object`

###### telegram.chatId

> **chatId**: `string` \| `null`

###### telegram.enabled

> **enabled**: `boolean`

###### telegram.linked

> **linked**: `boolean`

###### telegram.memberCount

> **memberCount**: `number`

###### telegram.roomChatId

> **roomChatId**: `string` \| `null`

###### xmtp

> **xmtp**: `object`

###### xmtp.agentAddress

> **agentAddress**: `` `0x${string}` `` \| `null`

###### xmtp.agentType

> **agentType**: `"eoa"` \| `"csw"` \| `null`

###### xmtp.conversationId

> **conversationId**: `string` \| `null`

###### xmtp.linked

> **linked**: `boolean`

##### settlement

> **settlement**: `object`

Defined in: [server/\_lib/workspace/service.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L48)

###### graduatedAt

> **graduatedAt**: `string` \| `null`

###### settledAt

> **settledAt**: `string` \| `null`

###### settlementStage

> **settlementStage**: `string` \| `null`

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/service.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L44)

***

### WorkspaceTasksResponse

> **WorkspaceTasksResponse** = `object`

Defined in: [server/\_lib/workspace/service.ts:157](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L157)

#### Properties

##### approvals

> **approvals**: `ReturnType`\<*typeof* [`listApprovalRequests`](repository.md#listapprovalrequests)\> *extends* `Promise`\<infer T\> ? `T` : `never`

Defined in: [server/\_lib/workspace/service.ts:159](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L159)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L160)

##### tasks

> **tasks**: [`WorkspaceTaskItem`](repository.md#workspacetaskitem)[]

Defined in: [server/\_lib/workspace/service.ts:158](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L158)

## Functions

### appendWorkspaceActionActivity()

> **appendWorkspaceActionActivity**(`params`): `Promise`\<[`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)\>

Defined in: [server/\_lib/workspace/service.ts:763](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L763)

#### Parameters

##### params

###### actorAddress?

`` `0x${string}` `` \| `null`

###### description?

`string` \| `null`

###### eventType

`string`

###### payload?

`Record`\<`string`, `unknown`\>

###### relatedAlertId?

`number` \| `null`

###### relatedApprovalId?

`number` \| `null`

###### relatedTaskId?

`number` \| `null`

###### severity?

[`WorkspaceSeverity`](repository.md#workspaceseverity)

###### source?

`string`

###### title

`string`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)\>

***

### resolveWorkspaceActivity()

> **resolveWorkspaceActivity**(`params`): `Promise`\<\{ `activity`: [`WorkspaceActivityItem`](#workspaceactivityitem)[]; `generatedAt`: `string`; \}\>

Defined in: [server/\_lib/workspace/service.ts:636](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L636)

#### Parameters

##### params

###### includeSystem

`boolean`

###### limit?

`number`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `activity`: [`WorkspaceActivityItem`](#workspaceactivityitem)[]; `generatedAt`: `string`; \}\>

***

### resolveWorkspaceMonitoring()

> **resolveWorkspaceMonitoring**(`params`): `Promise`\<[`WorkspaceMonitoringResponse`](#workspacemonitoringresponse)\>

Defined in: [server/\_lib/workspace/service.ts:591](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L591)

#### Parameters

##### params

###### req

`VercelRequest`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceMonitoringResponse`](#workspacemonitoringresponse)\>

***

### resolveWorkspaceRooms()

> **resolveWorkspaceRooms**(`params`): `Promise`\<[`WorkspaceRoomsResponse`](#workspaceroomsresponse)\>

Defined in: [server/\_lib/workspace/service.ts:673](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L673)

#### Parameters

##### params

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceRoomsResponse`](#workspaceroomsresponse)\>

***

### resolveWorkspaceSettings()

> **resolveWorkspaceSettings**(`params`): `Promise`\<[`WorkspaceSettingsResponse`](#workspacesettingsresponse)\>

Defined in: [server/\_lib/workspace/service.ts:732](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L732)

#### Parameters

##### params

###### principalAddress?

`` `0x${string}` ``

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceSettingsResponse`](#workspacesettingsresponse)\>

***

### resolveWorkspaceStrategies()

> **resolveWorkspaceStrategies**(`params`): `Promise`\<\{ `generatedAt`: `string`; `strategies`: [`WorkspaceStrategyRow`](#workspacestrategyrow)[]; \}\>

Defined in: [server/\_lib/workspace/service.ts:531](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L531)

#### Parameters

##### params

###### req

`VercelRequest`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `generatedAt`: `string`; `strategies`: [`WorkspaceStrategyRow`](#workspacestrategyrow)[]; \}\>

***

### resolveWorkspaceSummary()

> **resolveWorkspaceSummary**(`params`): `Promise`\<[`WorkspaceSummaryResponse`](#workspacesummaryresponse)\>

Defined in: [server/\_lib/workspace/service.ts:455](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L455)

#### Parameters

##### params

###### req

`VercelRequest`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceSummaryResponse`](#workspacesummaryresponse)\>

***

### resolveWorkspaceTasks()

> **resolveWorkspaceTasks**(`params`): `Promise`\<[`WorkspaceTasksResponse`](#workspacetasksresponse)\>

Defined in: [server/\_lib/workspace/service.ts:715](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/service.ts#L715)

#### Parameters

##### params

###### approvalStatus?

`string` \| `null`

###### taskStatus?

`string` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceTasksResponse`](#workspacetasksresponse)\>
