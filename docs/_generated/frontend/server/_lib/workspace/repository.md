[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/workspace/repository

# server/\_lib/workspace/repository

## Type Aliases

### WorkspaceActivityEvent

> **WorkspaceActivityEvent** = `object`

Defined in: [server/\_lib/workspace/repository.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L97)

#### Properties

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L101)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L110)

##### description

> **description**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:104](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L104)

##### eventType

> **eventType**: `string`

Defined in: [server/\_lib/workspace/repository.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L100)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L98)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L106)

##### relatedAlertId

> **relatedAlertId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L109)

##### relatedApprovalId

> **relatedApprovalId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L108)

##### relatedTaskId

> **relatedTaskId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L107)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [server/\_lib/workspace/repository.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L105)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L102)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/repository.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L103)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L99)

***

### WorkspaceAlertEvent

> **WorkspaceAlertEvent** = `object`

Defined in: [server/\_lib/workspace/repository.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L34)

#### Properties

##### acknowledgedAt

> **acknowledgedAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L48)

##### acknowledgedBy

> **acknowledgedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L47)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L51)

##### createdBy

> **createdBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L46)

##### dedupeKey

> **dedupeKey**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L44)

##### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L42)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L35)

##### kind

> **kind**: `string`

Defined in: [server/\_lib/workspace/repository.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L39)

##### message

> **message**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L41)

##### relatedTaskId

> **relatedTaskId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L45)

##### resolvedAt

> **resolvedAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L50)

##### resolvedBy

> **resolvedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L49)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [server/\_lib/workspace/repository.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L38)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L37)

##### status

> **status**: `string`

Defined in: [server/\_lib/workspace/repository.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L43)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/repository.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L40)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L52)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L36)

***

### WorkspaceApprovalRequest

> **WorkspaceApprovalRequest** = `object`

Defined in: [server/\_lib/workspace/repository.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L55)

#### Properties

##### actionType

> **actionType**: `string`

Defined in: [server/\_lib/workspace/repository.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L58)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:70](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L70)

##### deadlineAt

> **deadlineAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L65)

##### decidedAt

> **decidedAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L67)

##### decidedBy

> **decidedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L66)

##### decisionReason

> **decisionReason**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L68)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L56)

##### linkedTaskId

> **linkedTaskId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:69](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L69)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L59)

##### requestedBy

> **requestedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L63)

##### severity

> **severity**: `string`

Defined in: [server/\_lib/workspace/repository.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L61)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L64)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L60)

##### status

> **status**: `string`

Defined in: [server/\_lib/workspace/repository.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L62)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L71)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L57)

***

### WorkspaceAuditLog

> **WorkspaceAuditLog** = `object`

Defined in: [server/\_lib/workspace/repository.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L125)

#### Properties

##### action

> **action**: `string`

Defined in: [server/\_lib/workspace/repository.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L131)

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L128)

##### actorRole

> **actorRole**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:129](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L129)

##### after

> **after**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/workspace/repository.ts:135](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L135)

##### before

> **before**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/workspace/repository.ts:134](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L134)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L137)

##### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L136)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L126)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:130](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L130)

##### targetId

> **targetId**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L133)

##### targetType

> **targetType**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L132)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L127)

***

### WorkspaceMonitoringSnapshot

> **WorkspaceMonitoringSnapshot** = `object`

Defined in: [server/\_lib/workspace/repository.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L25)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L31)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L26)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L29)

##### snapshotKind

> **snapshotKind**: `string`

Defined in: [server/\_lib/workspace/repository.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L28)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L30)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L27)

***

### WorkspaceNotificationPreference

> **WorkspaceNotificationPreference** = `object`

Defined in: [server/\_lib/workspace/repository.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L113)

#### Properties

##### channels

> **channels**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L120)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L121)

##### emailEnabled

> **emailEnabled**: `boolean`

Defined in: [server/\_lib/workspace/repository.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L118)

##### minSeverity

> **minSeverity**: `string`

Defined in: [server/\_lib/workspace/repository.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L119)

##### principalAddress

> **principalAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L115)

##### telegramEnabled

> **telegramEnabled**: `boolean`

Defined in: [server/\_lib/workspace/repository.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L116)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L122)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L114)

##### xmtpEnabled

> **xmtpEnabled**: `boolean`

Defined in: [server/\_lib/workspace/repository.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L117)

***

### WorkspaceSeverity

> **WorkspaceSeverity** = `"info"` \| `"warn"` \| `"critical"`

Defined in: [server/\_lib/workspace/repository.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L4)

***

### WorkspaceStrategyTarget

> **WorkspaceStrategyTarget** = `object`

Defined in: [server/\_lib/workspace/repository.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L6)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L21)

##### maxAssetsCap

> **maxAssetsCap**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L20)

Operator-intended value for on-chain `strategyMaxAssets[strategy]`.
Stored as the uint256-as-string representation (NUMERIC(78,0)). `null`
means "no cap configured in Supabase"; the runbook treats that the same
as uncapped, but the on-chain value is authoritative.

##### notes

> **notes**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L13)

##### status

> **status**: `string`

Defined in: [server/\_lib/workspace/repository.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L10)

##### strategyAddress

> **strategyAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L8)

##### targetWeightBps

> **targetWeightBps**: `number`

Defined in: [server/\_lib/workspace/repository.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L9)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L22)

##### updatedBy

> **updatedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L11)

##### updatedSource

> **updatedSource**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L12)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L7)

***

### WorkspaceTaskItem

> **WorkspaceTaskItem** = `object`

Defined in: [server/\_lib/workspace/repository.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L74)

#### Properties

##### actionPayload

> **actionPayload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/workspace/repository.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L83)

##### actionType

> **actionType**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L82)

##### assigneeWallet

> **assigneeWallet**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L88)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L93)

##### createdBy

> **createdBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L91)

##### description

> **description**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L78)

##### dueAt

> **dueAt**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L89)

##### id

> **id**: `number`

Defined in: [server/\_lib/workspace/repository.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L75)

##### relatedAlertId

> **relatedAlertId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L84)

##### relatedApprovalId

> **relatedApprovalId**: `number` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L85)

##### roomRef

> **roomRef**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L86)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [server/\_lib/workspace/repository.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L80)

##### snoozedUntil

> **snoozedUntil**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L90)

##### source

> **source**: `string`

Defined in: [server/\_lib/workspace/repository.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L79)

##### status

> **status**: `string`

Defined in: [server/\_lib/workspace/repository.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L81)

##### threadRef

> **threadRef**: `string` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L87)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/repository.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L77)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/workspace/repository.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L94)

##### updatedBy

> **updatedBy**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/workspace/repository.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L92)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/repository.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L76)

## Functions

### appendAuditLog()

> **appendAuditLog**(`params`): `Promise`\<[`WorkspaceAuditLog`](#workspaceauditlog)\>

Defined in: [server/\_lib/workspace/repository.ts:971](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L971)

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

Defined in: [server/\_lib/workspace/repository.ts:822](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L822)

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

Defined in: [server/\_lib/workspace/repository.ts:485](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L485)

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

Defined in: [server/\_lib/workspace/repository.ts:583](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L583)

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

Defined in: [server/\_lib/workspace/repository.ts:684](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L684)

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

Defined in: [server/\_lib/workspace/repository.ts:650](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L650)

#### Parameters

##### id

`number`

#### Returns

`Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest) \| `null`\>

***

### getTaskItemById()

> **getTaskItemById**(`id`): `Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem) \| `null`\>

Defined in: [server/\_lib/workspace/repository.ts:772](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L772)

#### Parameters

##### id

`number`

#### Returns

`Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem) \| `null`\>

***

### getWorkspaceCounts()

> **getWorkspaceCounts**(`vaultAddress`): `Promise`\<\{ `openAlerts`: `number`; `pendingApprovals`: `number`; `pendingTasks`: `number`; \}\>

Defined in: [server/\_lib/workspace/repository.ts:1033](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L1033)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `openAlerts`: `number`; `pendingApprovals`: `number`; `pendingTasks`: `number`; \}\>

***

### insertMonitoringSnapshot()

> **insertMonitoringSnapshot**(`params`): `Promise`\<[`WorkspaceMonitoringSnapshot`](#workspacemonitoringsnapshot)\>

Defined in: [server/\_lib/workspace/repository.ts:441](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L441)

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

Defined in: [server/\_lib/workspace/repository.ts:872](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L872)

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

Defined in: [server/\_lib/workspace/repository.ts:537](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L537)

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

Defined in: [server/\_lib/workspace/repository.ts:632](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L632)

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

Defined in: [server/\_lib/workspace/repository.ts:1018](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L1018)

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

Defined in: [server/\_lib/workspace/repository.ts:470](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L470)

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

Defined in: [server/\_lib/workspace/repository.ts:953](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L953)

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

Defined in: [server/\_lib/workspace/repository.ts:339](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L339)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceStrategyTarget`](#workspacestrategytarget)[]\>

***

### listTaskItems()

> **listTaskItems**(`params`): `Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem)[]\>

Defined in: [server/\_lib/workspace/repository.ts:754](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L754)

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

Defined in: [server/\_lib/workspace/repository.ts:555](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L555)

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

Defined in: [server/\_lib/workspace/repository.ts:662](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L662)

#### Parameters

##### params

###### decidedBy?

`` `0x${string}` `` \| `null`

###### decisionReason?

`string` \| `null`

###### id

`number`

###### status

`"approved"` \| `"cancelled"` \| `"executed"` \| `"rejected"`

#### Returns

`Promise`\<[`WorkspaceApprovalRequest`](#workspaceapprovalrequest) \| `null`\>

***

### updateTaskItem()

> **updateTaskItem**(`params`): `Promise`\<[`WorkspaceTaskItem`](#workspacetaskitem) \| `null`\>

Defined in: [server/\_lib/workspace/repository.ts:784](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L784)

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

Defined in: [server/\_lib/workspace/repository.ts:887](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L887)

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

Defined in: [server/\_lib/workspace/repository.ts:351](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/repository.ts#L351)

#### Parameters

##### params

###### maxAssetsCap?

`string` \| `null`

Operator-intended cap mirroring on-chain `strategyMaxAssets[strategy]`.
Pass the uint256 value as a decimal string. `null` clears the field
(treated as "unset" — the runbook still requires the on-chain cap to be
the source of truth). `undefined` leaves the existing value untouched.

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
