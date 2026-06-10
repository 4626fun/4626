[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/workspace/types

# src/lib/workspace/types

## Type Aliases

### WorkspaceActionResult

> **WorkspaceActionResult** = `object`

Defined in: [src/lib/workspace/types.ts:283](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L283)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### action

> **action**: `string`

Defined in: [src/lib/workspace/types.ts:284](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L284)

***

### WorkspaceActivityEvent

> **WorkspaceActivityEvent** = `object`

Defined in: [src/lib/workspace/types.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L121)

#### Properties

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:125](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L125)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:134](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L134)

##### description

> **description**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:128](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L128)

##### eventType

> **eventType**: `string`

Defined in: [src/lib/workspace/types.ts:124](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L124)

##### id

> **id**: `number`

Defined in: [src/lib/workspace/types.ts:122](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L122)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:130](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L130)

##### relatedAlertId

> **relatedAlertId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:133](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L133)

##### relatedApprovalId

> **relatedApprovalId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:132](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L132)

##### relatedTaskId

> **relatedTaskId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:131](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L131)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [src/lib/workspace/types.ts:129](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L129)

##### source

> **source**: `string`

Defined in: [src/lib/workspace/types.ts:126](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L126)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:127](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L127)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:123](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L123)

***

### WorkspaceActivityItem

> **WorkspaceActivityItem** = `object`

Defined in: [src/lib/workspace/types.ts:158](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L158)

#### Properties

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L165)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:166](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L166)

##### description

> **description**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:163](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L163)

##### eventType

> **eventType**: `string`

Defined in: [src/lib/workspace/types.ts:161](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L161)

##### id

> **id**: `string`

Defined in: [src/lib/workspace/types.ts:159](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L159)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:167](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L167)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [src/lib/workspace/types.ts:164](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L164)

##### source

> **source**: `"workspace"` \| `"keepr"` \| `"chat"`

Defined in: [src/lib/workspace/types.ts:160](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L160)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:162](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L162)

***

### WorkspaceActivityResponse

> **WorkspaceActivityResponse** = `object`

Defined in: [src/lib/workspace/types.ts:170](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L170)

#### Properties

##### activity

> **activity**: [`WorkspaceActivityItem`](#workspaceactivityitem)[]

Defined in: [src/lib/workspace/types.ts:171](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L171)

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:173](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L173)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:172](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L172)

***

### WorkspaceAlertEvent

> **WorkspaceAlertEvent** = `object`

Defined in: [src/lib/workspace/types.ts:100](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L100)

#### Properties

##### acknowledgedAt

> **acknowledgedAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:114](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L114)

##### acknowledgedBy

> **acknowledgedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:113](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L113)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L117)

##### createdBy

> **createdBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L112)

##### dedupeKey

> **dedupeKey**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L110)

##### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:108](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L108)

##### id

> **id**: `number`

Defined in: [src/lib/workspace/types.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L101)

##### kind

> **kind**: `string`

Defined in: [src/lib/workspace/types.ts:105](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L105)

##### message

> **message**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:107](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L107)

##### relatedTaskId

> **relatedTaskId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:111](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L111)

##### resolvedAt

> **resolvedAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:116](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L116)

##### resolvedBy

> **resolvedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L115)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [src/lib/workspace/types.ts:104](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L104)

##### source

> **source**: `string`

Defined in: [src/lib/workspace/types.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L103)

##### status

> **status**: `string`

Defined in: [src/lib/workspace/types.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L109)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:106](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L106)

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L118)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:102](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L102)

***

### WorkspaceApprovalRequest

> **WorkspaceApprovalRequest** = `object`

Defined in: [src/lib/workspace/types.ts:221](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L221)

#### Properties

##### actionType

> **actionType**: `string`

Defined in: [src/lib/workspace/types.ts:224](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L224)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:236](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L236)

##### deadlineAt

> **deadlineAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:231](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L231)

##### decidedAt

> **decidedAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:233](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L233)

##### decidedBy

> **decidedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:232](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L232)

##### decisionReason

> **decisionReason**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:234](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L234)

##### id

> **id**: `number`

Defined in: [src/lib/workspace/types.ts:222](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L222)

##### linkedTaskId

> **linkedTaskId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:235](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L235)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:225](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L225)

##### requestedBy

> **requestedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:229](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L229)

##### severity

> **severity**: `string`

Defined in: [src/lib/workspace/types.ts:227](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L227)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:230](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L230)

##### source

> **source**: `string`

Defined in: [src/lib/workspace/types.ts:226](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L226)

##### status

> **status**: `string`

Defined in: [src/lib/workspace/types.ts:228](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L228)

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:237](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L237)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:223](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L223)

***

### WorkspaceCheck

> **WorkspaceCheck** = `object`

Defined in: [src/lib/workspace/types.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L85)

#### Properties

##### details?

> `optional` **details**: `string`

Defined in: [src/lib/workspace/types.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L89)

##### href?

> `optional` **href**: `string`

Defined in: [src/lib/workspace/types.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L90)

##### id

> **id**: `string`

Defined in: [src/lib/workspace/types.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L86)

##### label

> **label**: `string`

Defined in: [src/lib/workspace/types.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L87)

##### status

> **status**: [`WorkspaceCheckStatus`](#workspacecheckstatus-1)

Defined in: [src/lib/workspace/types.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L88)

***

### WorkspaceCheckSection

> **WorkspaceCheckSection** = `object`

Defined in: [src/lib/workspace/types.ts:93](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L93)

#### Properties

##### checks

> **checks**: [`WorkspaceCheck`](#workspacecheck)[]

Defined in: [src/lib/workspace/types.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L97)

##### description?

> `optional` **description**: `string`

Defined in: [src/lib/workspace/types.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L96)

##### id

> **id**: `string`

Defined in: [src/lib/workspace/types.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L94)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L95)

***

### WorkspaceCheckStatus

> **WorkspaceCheckStatus** = `"pass"` \| `"fail"` \| `"warn"` \| `"info"`

Defined in: [src/lib/workspace/types.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L83)

***

### WorkspaceMonitoringResponse

> **WorkspaceMonitoringResponse** = `object`

Defined in: [src/lib/workspace/types.ts:137](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L137)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:155](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L155)

##### alerts

> **alerts**: [`WorkspaceAlertEvent`](#workspacealertevent)[]

Defined in: [src/lib/workspace/types.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L145)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:154](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L154)

##### incidents

> **incidents**: [`WorkspaceActivityEvent`](#workspaceactivityevent)[]

Defined in: [src/lib/workspace/types.ts:146](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L146)

##### latestSnapshotId

> **latestSnapshotId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:153](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L153)

##### sections

> **sections**: [`WorkspaceCheckSection`](#workspacechecksection)[]

Defined in: [src/lib/workspace/types.ts:138](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L138)

##### summary

> **summary**: `object`

Defined in: [src/lib/workspace/types.ts:139](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L139)

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

Defined in: [src/lib/workspace/types.ts:147](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L147)

###### fail

> **fail**: `number`

###### pass

> **pass**: `number`

###### timestamp

> **timestamp**: `string`

###### warn

> **warn**: `number`

***

### WorkspaceNotificationPreference

> **WorkspaceNotificationPreference** = `object`

Defined in: [src/lib/workspace/types.ts:247](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L247)

#### Properties

##### channels

> **channels**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:254](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L254)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:255](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L255)

##### emailEnabled

> **emailEnabled**: `boolean`

Defined in: [src/lib/workspace/types.ts:252](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L252)

##### minSeverity

> **minSeverity**: `string`

Defined in: [src/lib/workspace/types.ts:253](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L253)

##### principalAddress

> **principalAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:249](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L249)

##### telegramEnabled

> **telegramEnabled**: `boolean`

Defined in: [src/lib/workspace/types.ts:250](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L250)

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:256](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L256)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:248](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L248)

##### xmtpEnabled

> **xmtpEnabled**: `boolean`

Defined in: [src/lib/workspace/types.ts:251](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L251)

***

### WorkspaceRole

> **WorkspaceRole** = `"OWNER"` \| `"ADMIN"` \| `"OPERATOR"` \| `"VIEWER"`

Defined in: [src/lib/workspace/types.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L1)

***

### WorkspaceRoomsResponse

> **WorkspaceRoomsResponse** = `object`

Defined in: [src/lib/workspace/types.ts:176](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L176)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:195](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L195)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:194](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L194)

##### telegram

> **telegram**: `object`

Defined in: [src/lib/workspace/types.ts:177](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L177)

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

> **recentSummaries**: [`WorkspaceActivityEvent`](#workspaceactivityevent)[]

###### roomChatId

> **roomChatId**: `string` \| `null`

##### xmtp

> **xmtp**: `object`

Defined in: [src/lib/workspace/types.ts:187](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L187)

###### agentAddress

> **agentAddress**: `` `0x${string}` `` \| `null`

###### agentType

> **agentType**: `"eoa"` \| `"csw"` \| `null`

###### conversationId

> **conversationId**: `string` \| `null`

###### linked

> **linked**: `boolean`

###### recentMessages

> **recentMessages**: [`WorkspaceActivityEvent`](#workspaceactivityevent)[]

***

### WorkspaceSettingsResponse

> **WorkspaceSettingsResponse** = `object`

Defined in: [src/lib/workspace/types.ts:259](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L259)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:280](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L280)

##### automation

> **automation**: `object`

Defined in: [src/lib/workspace/types.ts:275](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L275)

###### enabled

> **enabled**: `boolean`

###### scope

> **scope**: `string` \| `null`

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:279](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L279)

##### notificationPreferences

> **notificationPreferences**: [`WorkspaceNotificationPreference`](#workspacenotificationpreference)[]

Defined in: [src/lib/workspace/types.ts:260](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L260)

##### strategyTargets

> **strategyTargets**: `object`[]

Defined in: [src/lib/workspace/types.ts:261](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L261)

###### createdAt

> **createdAt**: `string`

###### maxAssetsCap

> **maxAssetsCap**: `string` \| `null`

Mirror of on-chain `strategyMaxAssets[strategy]`. uint256 as string; null = unset.

###### notes

> **notes**: `string` \| `null`

###### status

> **status**: `string`

###### strategyAddress

> **strategyAddress**: `` `0x${string}` ``

###### targetWeightBps

> **targetWeightBps**: `number`

###### updatedAt

> **updatedAt**: `string`

###### updatedBy

> **updatedBy**: `` `0x${string}` `` \| `null`

###### updatedSource

> **updatedSource**: `string` \| `null`

###### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

##### thresholds

> **thresholds**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:274](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L274)

***

### WorkspaceSeverity

> **WorkspaceSeverity** = `"info"` \| `"warn"` \| `"critical"`

Defined in: [src/lib/workspace/types.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L3)

***

### WorkspaceStrategiesResponse

> **WorkspaceStrategiesResponse** = `object`

Defined in: [src/lib/workspace/types.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L77)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L80)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L79)

##### strategies

> **strategies**: [`WorkspaceStrategyRow`](#workspacestrategyrow)[]

Defined in: [src/lib/workspace/types.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L78)

***

### WorkspaceStrategyRow

> **WorkspaceStrategyRow** = `object`

Defined in: [src/lib/workspace/types.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L50)

#### Properties

##### aprSignal

> **aprSignal**: `object`

Defined in: [src/lib/workspace/types.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L68)

###### confidence

> **confidence**: `"unknown"` \| `"low"` \| `"medium"` \| `"high"`

###### expectedAprBps

> **expectedAprBps**: `number` \| `null`

###### source

> **source**: `"keeper_report"` \| `"p0_placeholder"` \| `"none"`

##### asset

> **asset**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L65)

##### availableActions

> **availableActions**: `string`[]

Defined in: [src/lib/workspace/types.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L74)

##### currentWeightRaw

> **currentWeightRaw**: `string`

Defined in: [src/lib/workspace/types.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L55)

##### isActive

> **isActive**: `boolean` \| `null`

Defined in: [src/lib/workspace/types.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L54)

##### kind

> **kind**: `"ajna"` \| `"charm"` \| `"solana"` \| `"unknown"`

Defined in: [src/lib/workspace/types.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L52)

##### lastRebalanceAt

> **lastRebalanceAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L73)

##### liquidityHint

> **liquidityHint**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L66)

##### maxAssetsCap

> **maxAssetsCap**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L63)

Operator-intended on-chain cap (`strategyMaxAssets[strategy]`) as a
decimal uint256 string. `null` = no cap configured in Supabase yet.
The on-chain value is authoritative — this is the operator-side mirror
surfaced by the admin UI for drift detection.

##### owner

> **owner**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L64)

##### performanceHint

> **performanceHint**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L67)

##### status

> **status**: `"active"` \| `"paused"` \| `"inactive"` \| `"unknown"`

Defined in: [src/lib/workspace/types.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L53)

##### strategyAddress

> **strategyAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L51)

##### targetWeightBps

> **targetWeightBps**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L56)

***

### WorkspaceSummary

> **WorkspaceSummary** = `object`

Defined in: [src/lib/workspace/types.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L5)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L47)

##### automation

> **automation**: `object`

Defined in: [src/lib/workspace/types.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L40)

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

Defined in: [src/lib/workspace/types.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L9)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L46)

##### groupId

> **groupId**: `string`

Defined in: [src/lib/workspace/types.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L7)

##### latestActivity

> **latestActivity**: [`WorkspaceActivityEvent`](#workspaceactivityevent)[]

Defined in: [src/lib/workspace/types.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L39)

##### latestAlerts

> **latestAlerts**: [`WorkspaceAlertEvent`](#workspacealertevent)[]

Defined in: [src/lib/workspace/types.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L38)

##### metrics

> **metrics**: `object`

Defined in: [src/lib/workspace/types.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L15)

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

Defined in: [src/lib/workspace/types.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L8)

##### rooms

> **rooms**: `object`

Defined in: [src/lib/workspace/types.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L23)

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

Defined in: [src/lib/workspace/types.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L10)

###### graduatedAt

> **graduatedAt**: `string` \| `null`

###### settledAt

> **settledAt**: `string` \| `null`

###### settlementStage

> **settlementStage**: `string` \| `null`

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L6)

***

### WorkspaceTabId

> **WorkspaceTabId** = `"overview"` \| `"strategies"` \| `"monitoring"` \| `"activity"` \| `"rooms"` \| `"tasks"` \| `"settings"`

Defined in: [src/lib/workspace/types.ts:288](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L288)

***

### WorkspaceTaskItem

> **WorkspaceTaskItem** = `object`

Defined in: [src/lib/workspace/types.ts:198](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L198)

#### Properties

##### actionPayload

> **actionPayload**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:207](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L207)

##### actionType

> **actionType**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:206](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L206)

##### assigneeWallet

> **assigneeWallet**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:212](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L212)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:217](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L217)

##### createdBy

> **createdBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:215](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L215)

##### description

> **description**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:202](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L202)

##### dueAt

> **dueAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:213](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L213)

##### id

> **id**: `number`

Defined in: [src/lib/workspace/types.ts:199](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L199)

##### relatedAlertId

> **relatedAlertId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:208](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L208)

##### relatedApprovalId

> **relatedApprovalId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:209](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L209)

##### roomRef

> **roomRef**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:210](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L210)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [src/lib/workspace/types.ts:204](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L204)

##### snoozedUntil

> **snoozedUntil**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:214](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L214)

##### source

> **source**: `string`

Defined in: [src/lib/workspace/types.ts:203](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L203)

##### status

> **status**: `string`

Defined in: [src/lib/workspace/types.ts:205](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L205)

##### threadRef

> **threadRef**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:211](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L211)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:201](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L201)

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:218](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L218)

##### updatedBy

> **updatedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:216](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L216)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:200](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L200)

***

### WorkspaceTasksResponse

> **WorkspaceTasksResponse** = `object`

Defined in: [src/lib/workspace/types.ts:240](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L240)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:244](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L244)

##### approvals

> **approvals**: [`WorkspaceApprovalRequest`](#workspaceapprovalrequest)[]

Defined in: [src/lib/workspace/types.ts:242](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L242)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:243](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L243)

##### tasks

> **tasks**: [`WorkspaceTaskItem`](#workspacetaskitem)[]

Defined in: [src/lib/workspace/types.ts:241](https://github.com/wenakita/4626/blob/main/frontend/src/lib/workspace/types.ts#L241)
