[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/workspace/repository

# server/\_lib/workspace/repository

## Type Aliases

### WorkspaceActivityEvent

> **WorkspaceActivityEvent** = `object`

Defined in: [server/\_lib/workspace/repository.ts:90](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L90)

#### Properties

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:94](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L94)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:103](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L103)

##### description

> **description**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:97](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L97)

##### eventType

> **eventType**: `string`

Defined in: [server/\_lib/workspace/repository.ts:93](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L93)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:91](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L91)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:99](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L99)

##### relatedAlertId

> **relatedAlertId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:102](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L102)

##### relatedApprovalId

> **relatedApprovalId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:101](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L101)

##### relatedTaskId

> **relatedTaskId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:100](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L100)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [server/\_lib/workspace/repository.ts:98](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L98)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:95](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L95)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/repository.ts:96](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L96)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:92](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L92)

***

### WorkspaceAlertEvent

> **WorkspaceAlertEvent** = `object`

Defined in: [server/\_lib/workspace/repository.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L27)

#### Properties

##### acknowledgedAt

> **acknowledgedAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:41](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L41)

##### acknowledgedBy

> **acknowledgedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:40](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L40)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:44](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L44)

##### createdBy

> **createdBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L39)

##### dedupeKey

> **dedupeKey**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:37](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L37)

##### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L35)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L28)

##### kind

> **kind**: `string`

Defined in: [server/\_lib/workspace/repository.ts:32](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L32)

##### message

> **message**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:34](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L34)

##### relatedTaskId

> **relatedTaskId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L38)

##### resolvedAt

> **resolvedAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:43](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L43)

##### resolvedBy

> **resolvedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:42](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L42)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [server/\_lib/workspace/repository.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L31)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L30)

##### status

> **status**: `string`

Defined in: [server/\_lib/workspace/repository.ts:36](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L36)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/repository.ts:33](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L33)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:45](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L45)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L29)

***

### WorkspaceApprovalRequest

> **WorkspaceApprovalRequest** = `object`

Defined in: [server/\_lib/workspace/repository.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L48)

#### Properties

##### actionType

> **actionType**: `string`

Defined in: [server/\_lib/workspace/repository.ts:51](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L51)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:63](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L63)

##### deadlineAt

> **deadlineAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:58](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L58)

##### decidedAt

> **decidedAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:60](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L60)

##### decidedBy

> **decidedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:59](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L59)

##### decisionReason

> **decisionReason**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:61](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L61)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:49](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L49)

##### linkedTaskId

> **linkedTaskId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:62](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L62)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:52](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L52)

##### requestedBy

> **requestedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:56](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L56)

##### severity

> **severity**: `string`

Defined in: [server/\_lib/workspace/repository.ts:54](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L54)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:57](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L57)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:53](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L53)

##### status

> **status**: `string`

Defined in: [server/\_lib/workspace/repository.ts:55](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L55)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L64)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:50](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L50)

***

### WorkspaceAuditLog

> **WorkspaceAuditLog** = `object`

Defined in: [server/\_lib/workspace/repository.ts:118](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L118)

#### Properties

##### action

> **action**: `string`

Defined in: [server/\_lib/workspace/repository.ts:124](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L124)

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:121](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L121)

##### actorRole

> **actorRole**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:122](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L122)

##### after

> **after**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/workspace/repository.ts:128](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L128)

##### before

> **before**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/workspace/repository.ts:127](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L127)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:130](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L130)

##### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:129](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L129)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:119](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L119)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:123](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L123)

##### targetId

> **targetId**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:126](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L126)

##### targetType

> **targetType**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:125](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L125)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:120](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L120)

***

### WorkspaceMonitoringSnapshot

> **WorkspaceMonitoringSnapshot** = `object`

Defined in: [server/\_lib/workspace/repository.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L18)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L24)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L19)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L22)

##### snapshotKind

> **snapshotKind**: `string`

Defined in: [server/\_lib/workspace/repository.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L21)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:23](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L23)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L20)

***

### WorkspaceNotificationPreference

> **WorkspaceNotificationPreference** = `object`

Defined in: [server/\_lib/workspace/repository.ts:106](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L106)

#### Properties

##### channels

> **channels**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:113](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L113)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:114](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L114)

##### emailEnabled

> **emailEnabled**: `boolean`

Defined in: [server/\_lib/workspace/repository.ts:111](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L111)

##### minSeverity

> **minSeverity**: `string`

Defined in: [server/\_lib/workspace/repository.ts:112](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L112)

##### principalAddress

> **principalAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:108](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L108)

##### telegramEnabled

> **telegramEnabled**: `boolean`

Defined in: [server/\_lib/workspace/repository.ts:109](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L109)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:115](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L115)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:107](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L107)

##### xmtpEnabled

> **xmtpEnabled**: `boolean`

Defined in: [server/\_lib/workspace/repository.ts:110](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L110)

***

### WorkspaceSeverity

> **WorkspaceSeverity** = `"info"` \| `"warn"` \| `"critical"`

Defined in: [server/\_lib/workspace/repository.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L4)

***

### WorkspaceStrategyTarget

> **WorkspaceStrategyTarget** = `object`

Defined in: [server/\_lib/workspace/repository.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L6)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L14)

##### notes

> **notes**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L13)

##### status

> **status**: `string`

Defined in: [server/\_lib/workspace/repository.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L10)

##### strategyAddress

> **strategyAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L8)

##### targetWeightBps

> **targetWeightBps**: `number`

Defined in: [server/\_lib/workspace/repository.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L9)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L15)

##### updatedBy

> **updatedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L11)

##### updatedSource

> **updatedSource**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L12)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L7)

***

### WorkspaceTaskItem

> **WorkspaceTaskItem** = `object`

Defined in: [server/\_lib/workspace/repository.ts:67](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L67)

#### Properties

##### actionPayload

> **actionPayload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:76](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L76)

##### actionType

> **actionType**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:75](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L75)

##### assigneeWallet

> **assigneeWallet**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:81](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L81)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:86](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L86)

##### createdBy

> **createdBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:84](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L84)

##### description

> **description**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:71](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L71)

##### dueAt

> **dueAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:82](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L82)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:68](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L68)

##### relatedAlertId

> **relatedAlertId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:77](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L77)

##### relatedApprovalId

> **relatedApprovalId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:78](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L78)

##### roomRef

> **roomRef**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:79](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L79)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [server/\_lib/workspace/repository.ts:73](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L73)

##### snoozedUntil

> **snoozedUntil**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:83](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L83)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:72](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L72)

##### status

> **status**: `string`

Defined in: [server/\_lib/workspace/repository.ts:74](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L74)

##### threadRef

> **threadRef**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:80](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L80)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/repository.ts:70](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L70)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:87](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L87)

##### updatedBy

> **updatedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:85](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L85)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:69](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L69)

## Functions

### appendAuditLog()

> **appendAuditLog**(`params`): `Promise`\<[`WorkspaceAuditLog`](#workspaceauditlog)\>

Defined in: [server/\_lib/workspace/repository.ts:925](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L925)

#### Parameters

##### params

###### action

`string`

###### actorAddress?

`` `0x${string}` `` \| `null`

###### actorRole?

`string` \| `null`

###### after?

`Record`\<`string`, `unknown`\> \| `null`

###### before?

`Record`\<`string`, `unknown`\> \| `null`

###### details?

`Record`\<`string`, `unknown`\>

###### source

`string`

###### targetId?

`string` \| `null`

###### targetType?

`string` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceAuditLog`](#workspaceauditlog)\>

***

### createActivityEvent()

> **createActivityEvent**(`params`): `Promise`\<[`WorkspaceActivityEvent`](#workspaceactivityevent)\>

Defined in: [server/\_lib/workspace/repository.ts:776](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L776)

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

[`WorkspaceSeverity`](#workspaceseverity)

###### source?

`string`

###### title

`string`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceActivityEvent`](#workspaceactivityevent)\>

***

### createAlertEvent()

> **createAlertEvent**(`params`): `Promise`\<[`WorkspaceAlertEvent`](#workspacealertevent)\>

Defined in: [server/\_lib/workspace/repository.ts:439](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L439)

#### Parameters

##### params

###### createdBy?

`` `0x${string}` `` \| `null`

###### dedupeKey?

`string` \| `null`

###### details?

`Record`\<`string`, `unknown`\>

###### kind

`string`

###### message?

`string` \| `null`

###### relatedTaskId?

`number` \| `null`

###### severity?

[`WorkspaceSeverity`](#workspaceseverity)

###### source

`string`

###### status?

`string`

###### title

`string`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceAlertEvent`](#workspacealertevent)\>

***

### createApprovalRequest()

> **createApprovalRequest**(`params`): `Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest)\>

Defined in: [server/\_lib/workspace/repository.ts:537](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L537)

#### Parameters

##### params

###### actionType

`string`

###### deadlineAt?

`string` \| `Date` \| `null`

###### linkedTaskId?

`number` \| `null`

###### payload?

`Record`\<`string`, `unknown`\>

###### requestedBy?

`` `0x${string}` `` \| `null`

###### severity?

`string`

###### signerAddress?

`` `0x${string}` `` \| `null`

###### source?

`string`

###### status?

`string`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest)\>

***

### createTaskItem()

> **createTaskItem**(`params`): `Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem)\>

Defined in: [server/\_lib/workspace/repository.ts:638](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L638)

#### Parameters

##### params

###### actionPayload?

`Record`\<`string`, `unknown`\>

###### actionType?

`string` \| `null`

###### assigneeWallet?

`` `0x${string}` `` \| `null`

###### createdBy?

`` `0x${string}` `` \| `null`

###### description?

`string` \| `null`

###### dueAt?

`string` \| `Date` \| `null`

###### relatedAlertId?

`number` \| `null`

###### relatedApprovalId?

`number` \| `null`

###### roomRef?

`string` \| `null`

###### severity?

[`WorkspaceSeverity`](#workspaceseverity)

###### snoozedUntil?

`string` \| `Date` \| `null`

###### source?

`string`

###### status?

`string`

###### threadRef?

`string` \| `null`

###### title

`string`

###### updatedBy?

`` `0x${string}` `` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem)\>

***

### getApprovalRequestById()

> **getApprovalRequestById**(`id`): `Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest) \| `null`\>

Defined in: [server/\_lib/workspace/repository.ts:604](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L604)

#### Parameters

##### id

`number`

#### Returns

`Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest) \| `null`\>

***

### getTaskItemById()

> **getTaskItemById**(`id`): `Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem) \| `null`\>

Defined in: [server/\_lib/workspace/repository.ts:726](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L726)

#### Parameters

##### id

`number`

#### Returns

`Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem) \| `null`\>

***

### getWorkspaceCounts()

> **getWorkspaceCounts**(`vaultAddress`): `Promise`\<\{ `openAlerts`: `number`; `pendingApprovals`: `number`; `pendingTasks`: `number`; \}\>

Defined in: [server/\_lib/workspace/repository.ts:987](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L987)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `openAlerts`: `number`; `pendingApprovals`: `number`; `pendingTasks`: `number`; \}\>

***

### insertMonitoringSnapshot()

> **insertMonitoringSnapshot**(`params`): `Promise`\<[`WorkspaceMonitoringSnapshot`](#workspacemonitoringsnapshot)\>

Defined in: [server/\_lib/workspace/repository.ts:395](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L395)

#### Parameters

##### params

###### payload

`Record`\<`string`, `unknown`\>

###### snapshotKind?

`string`

###### source?

`string`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceMonitoringSnapshot`](#workspacemonitoringsnapshot)\>

***

### listActivityEvents()

> **listActivityEvents**(`params`): `Promise`\<[`WorkspaceActivityEvent`](#workspaceactivityevent)[]\>

Defined in: [server/\_lib/workspace/repository.ts:826](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L826)

#### Parameters

##### params

###### limit?

`number`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceActivityEvent`](#workspaceactivityevent)[]\>

***

### listAlertEvents()

> **listAlertEvents**(`params`): `Promise`\<[`WorkspaceAlertEvent`](#workspacealertevent)[]\>

Defined in: [server/\_lib/workspace/repository.ts:491](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L491)

#### Parameters

##### params

###### limit?

`number`

###### status?

`string` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceAlertEvent`](#workspacealertevent)[]\>

***

### listApprovalRequests()

> **listApprovalRequests**(`params`): `Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest)[]\>

Defined in: [server/\_lib/workspace/repository.ts:586](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L586)

#### Parameters

##### params

###### limit?

`number`

###### status?

`string` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest)[]\>

***

### listAuditLogs()

> **listAuditLogs**(`params`): `Promise`\<[`WorkspaceAuditLog`](#workspaceauditlog)[]\>

Defined in: [server/\_lib/workspace/repository.ts:972](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L972)

#### Parameters

##### params

###### limit?

`number`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceAuditLog`](#workspaceauditlog)[]\>

***

### listMonitoringSnapshots()

> **listMonitoringSnapshots**(`params`): `Promise`\<[`WorkspaceMonitoringSnapshot`](#workspacemonitoringsnapshot)[]\>

Defined in: [server/\_lib/workspace/repository.ts:424](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L424)

#### Parameters

##### params

###### limit?

`number`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceMonitoringSnapshot`](#workspacemonitoringsnapshot)[]\>

***

### listNotificationPreferences()

> **listNotificationPreferences**(`params`): `Promise`\<[`WorkspaceNotificationPreference`](#workspacenotificationpreference)[]\>

Defined in: [server/\_lib/workspace/repository.ts:907](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L907)

#### Parameters

##### params

###### limit?

`number`

###### principalAddress?

`` `0x${string}` ``

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceNotificationPreference`](#workspacenotificationpreference)[]\>

***

### listStrategyTargets()

> **listStrategyTargets**(`vaultAddress`): `Promise`\<[`WorkspaceStrategyTarget`](#workspacestrategytarget)[]\>

Defined in: [server/\_lib/workspace/repository.ts:328](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L328)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceStrategyTarget`](#workspacestrategytarget)[]\>

***

### listTaskItems()

> **listTaskItems**(`params`): `Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem)[]\>

Defined in: [server/\_lib/workspace/repository.ts:708](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L708)

#### Parameters

##### params

###### limit?

`number`

###### status?

`string` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem)[]\>

***

### updateAlertStatus()

> **updateAlertStatus**(`params`): `Promise`\<[`WorkspaceAlertEvent`](#workspacealertevent) \| `null`\>

Defined in: [server/\_lib/workspace/repository.ts:509](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L509)

#### Parameters

##### params

###### actor?

`` `0x${string}` `` \| `null`

###### id

`number`

###### status

`string`

#### Returns

`Promise`\<[`WorkspaceAlertEvent`](#workspacealertevent) \| `null`\>

***

### updateApprovalDecision()

> **updateApprovalDecision**(`params`): `Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest) \| `null`\>

Defined in: [server/\_lib/workspace/repository.ts:616](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L616)

#### Parameters

##### params

###### decidedBy?

`` `0x${string}` `` \| `null`

###### decisionReason?

`string` \| `null`

###### id

`number`

###### status

`"cancelled"` \| `"executed"` \| `"approved"` \| `"rejected"`

#### Returns

`Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest) \| `null`\>

***

### updateTaskItem()

> **updateTaskItem**(`params`): `Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem) \| `null`\>

Defined in: [server/\_lib/workspace/repository.ts:738](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L738)

#### Parameters

##### params

###### assigneeWallet?

`` `0x${string}` `` \| `null`

###### description?

`string` \| `null`

###### dueAt?

`string` \| `Date` \| `null`

###### id

`number`

###### snoozedUntil?

`string` \| `Date` \| `null`

###### status?

`string`

###### updatedBy?

`` `0x${string}` `` \| `null`

#### Returns

`Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem) \| `null`\>

***

### upsertNotificationPreference()

> **upsertNotificationPreference**(`params`): `Promise`\<[`WorkspaceNotificationPreference`](#workspacenotificationpreference)\>

Defined in: [server/\_lib/workspace/repository.ts:841](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L841)

#### Parameters

##### params

###### channels?

`Record`\<`string`, `unknown`\>

###### emailEnabled?

`boolean`

###### minSeverity?

`string`

###### principalAddress

`` `0x${string}` ``

###### telegramEnabled?

`boolean`

###### vaultAddress

`` `0x${string}` ``

###### xmtpEnabled?

`boolean`

#### Returns

`Promise`\<[`WorkspaceNotificationPreference`](#workspacenotificationpreference)\>

***

### upsertStrategyTarget()

> **upsertStrategyTarget**(`params`): `Promise`\<[`WorkspaceStrategyTarget`](#workspacestrategytarget)\>

Defined in: [server/\_lib/workspace/repository.ts:340](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/repository.ts#L340)

#### Parameters

##### params

###### notes?

`string` \| `null`

###### status?

`string`

###### strategyAddress

`` `0x${string}` ``

###### targetWeightBps

`number`

###### updatedBy?

`` `0x${string}` `` \| `null`

###### updatedSource?

`string` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceStrategyTarget`](#workspacestrategytarget)\>
