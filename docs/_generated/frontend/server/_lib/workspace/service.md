[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/workspace/service

# server/\_lib/workspace/service

## Type Aliases

### WorkspaceActivityItem

> **WorkspaceActivityItem** = `object`

Defined in: [server/\_lib/workspace/service.ts:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L125)

#### Properties

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/service.ts:132](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L132)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L133)

##### description

> **description**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:130](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L130)

##### eventType

> **eventType**: `string`

Defined in: [server/\_lib/workspace/service.ts:128](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L128)

##### id

> **id**: `string`

Defined in: [server/\_lib/workspace/service.ts:126](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L126)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/service.ts:134](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L134)

##### severity

> **severity**: [`WorkspaceSeverity`](repository.md#workspaceseverity)

Defined in: [server/\_lib/workspace/service.ts:131](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L131)

##### source

> **source**: `"workspace"` \| `"keepr"` \| `"chat"`

Defined in: [server/\_lib/workspace/service.ts:127](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L127)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/service.ts:129](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L129)

***

### WorkspaceMonitoringResponse

> **WorkspaceMonitoringResponse** = `object`

Defined in: [server/\_lib/workspace/service.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L105)

#### Properties

##### alerts

> **alerts**: [`WorkspaceAlertEvent`](repository.md#workspacealertevent)[]

Defined in: [server/\_lib/workspace/service.ts:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L113)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:122](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L122)

##### incidents

> **incidents**: [`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)[]

Defined in: [server/\_lib/workspace/service.ts:114](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L114)

##### latestSnapshotId

> **latestSnapshotId**: `number` \| `null`

Defined in: [server/\_lib/workspace/service.ts:121](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L121)

##### sections

> **sections**: `CheckSection`[]

Defined in: [server/\_lib/workspace/service.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L106)

##### summary

> **summary**: `object`

Defined in: [server/\_lib/workspace/service.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L107)

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

Defined in: [server/\_lib/workspace/service.ts:115](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L115)

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

Defined in: [server/\_lib/workspace/service.ts:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L137)

#### Properties

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:155](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L155)

##### telegram

> **telegram**: `object`

Defined in: [server/\_lib/workspace/service.ts:138](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L138)

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

Defined in: [server/\_lib/workspace/service.ts:148](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L148)

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

Defined in: [server/\_lib/workspace/service.ts:164](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L164)

#### Properties

##### automation

> **automation**: `object`

Defined in: [server/\_lib/workspace/service.ts:168](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L168)

###### enabled

> **enabled**: `boolean`

###### scope

> **scope**: `string` \| `null`

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:172](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L172)

##### notificationPreferences

> **notificationPreferences**: `ReturnType`\<*typeof* [`listNotificationPreferences`](repository.md#listnotificationpreferences)\> *extends* `Promise`\<infer T\> ? `T` : `never`

Defined in: [server/\_lib/workspace/service.ts:165](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L165)

##### strategyTargets

> **strategyTargets**: [`WorkspaceStrategyTarget`](repository.md#workspacestrategytarget)[]

Defined in: [server/\_lib/workspace/service.ts:166](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L166)

##### thresholds

> **thresholds**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/service.ts:167](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L167)

***

### WorkspaceStrategyRow

> **WorkspaceStrategyRow** = `object`

Defined in: [server/\_lib/workspace/service.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L87)

#### Properties

##### aprSignal

> **aprSignal**: [`StrategyAprSignal`](aprSignals.md#strategyaprsignal)

Defined in: [server/\_lib/workspace/service.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L100)

##### asset

> **asset**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/service.ts:97](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L97)

##### availableActions

> **availableActions**: `string`[]

Defined in: [server/\_lib/workspace/service.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L102)

##### currentWeightRaw

> **currentWeightRaw**: `string`

Defined in: [server/\_lib/workspace/service.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L92)

##### isActive

> **isActive**: `boolean` \| `null`

Defined in: [server/\_lib/workspace/service.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L91)

##### kind

> **kind**: `"ajna"` \| `"charm"` \| `"solana"` \| `"unknown"`

Defined in: [server/\_lib/workspace/service.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L89)

##### lastRebalanceAt

> **lastRebalanceAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L101)

##### liquidityHint

> **liquidityHint**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L98)

##### maxAssetsCap

> **maxAssetsCap**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L95)

Operator-intended on-chain cap mirror; uint256 as decimal string, or null.

##### owner

> **owner**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/service.ts:96](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L96)

##### performanceHint

> **performanceHint**: `string` \| `null`

Defined in: [server/\_lib/workspace/service.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L99)

##### status

> **status**: `"active"` \| `"paused"` \| `"inactive"` \| `"unknown"`

Defined in: [server/\_lib/workspace/service.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L90)

##### strategyAddress

> **strategyAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/service.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L88)

##### targetWeightBps

> **targetWeightBps**: `number` \| `null`

Defined in: [server/\_lib/workspace/service.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L93)

***

### WorkspaceSummaryResponse

> **WorkspaceSummaryResponse** = `object`

Defined in: [server/\_lib/workspace/service.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L43)

#### Properties

##### automation

> **automation**: `object`

Defined in: [server/\_lib/workspace/service.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L78)

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

Defined in: [server/\_lib/workspace/service.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L47)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L84)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/workspace/service.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L45)

##### latestActivity

> **latestActivity**: [`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)[]

Defined in: [server/\_lib/workspace/service.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L77)

##### latestAlerts

> **latestAlerts**: [`WorkspaceAlertEvent`](repository.md#workspacealertevent)[]

Defined in: [server/\_lib/workspace/service.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L76)

##### metrics

> **metrics**: `object`

Defined in: [server/\_lib/workspace/service.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L53)

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

Defined in: [server/\_lib/workspace/service.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L46)

##### rooms

> **rooms**: `object`

Defined in: [server/\_lib/workspace/service.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L61)

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

Defined in: [server/\_lib/workspace/service.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L48)

###### graduatedAt

> **graduatedAt**: `string` \| `null`

###### settledAt

> **settledAt**: `string` \| `null`

###### settlementStage

> **settlementStage**: `string` \| `null`

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/service.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L44)

***

### WorkspaceTasksResponse

> **WorkspaceTasksResponse** = `object`

Defined in: [server/\_lib/workspace/service.ts:158](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L158)

#### Properties

##### approvals

> **approvals**: `ReturnType`\<*typeof* [`listApprovalRequests`](repository.md#listapprovalrequests)\> *extends* `Promise`\<infer T\> ? `T` : `never`

Defined in: [server/\_lib/workspace/service.ts:160](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L160)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/workspace/service.ts:161](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L161)

##### tasks

> **tasks**: [`WorkspaceTaskItem`](repository.md#workspacetaskitem)[]

Defined in: [server/\_lib/workspace/service.ts:159](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L159)

## Functions

### appendWorkspaceActionActivity()

> **appendWorkspaceActionActivity**(`params`): `Promise`\<[`WorkspaceActivityEvent`](repository.md#workspaceactivityevent)\>

Defined in: [server/\_lib/workspace/service.ts:751](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L751)

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

Defined in: [server/\_lib/workspace/service.ts:624](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L624)

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

Defined in: [server/\_lib/workspace/service.ts:579](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L579)

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

Defined in: [server/\_lib/workspace/service.ts:661](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L661)

#### Parameters

##### params

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceRoomsResponse`](#workspaceroomsresponse)\>

***

### resolveWorkspaceSettings()

> **resolveWorkspaceSettings**(`params`): `Promise`\<[`WorkspaceSettingsResponse`](#workspacesettingsresponse)\>

Defined in: [server/\_lib/workspace/service.ts:720](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L720)

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

Defined in: [server/\_lib/workspace/service.ts:508](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L508)

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

Defined in: [server/\_lib/workspace/service.ts:432](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L432)

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

Defined in: [server/\_lib/workspace/service.ts:703](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/workspace/service.ts#L703)

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
