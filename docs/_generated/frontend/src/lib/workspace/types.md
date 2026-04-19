[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/workspace/types

# src/lib/workspace/types

## Type Aliases

### WorkspaceActionResult

> **WorkspaceActionResult** = `object`

Defined in: [src/lib/workspace/types.ts:269](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L269)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### action

> **action**: `string`

Defined in: [src/lib/workspace/types.ts:270](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L270)

***

### WorkspaceActivityEvent

> **WorkspaceActivityEvent** = `object`

Defined in: [src/lib/workspace/types.ts:109](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L109)

#### Properties

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:113](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L113)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:122](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L122)

##### description

> **description**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:116](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L116)

##### eventType

> **eventType**: `string`

Defined in: [src/lib/workspace/types.ts:112](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L112)

##### id

> **id**: `number`

Defined in: [src/lib/workspace/types.ts:110](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L110)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:118](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L118)

##### relatedAlertId

> **relatedAlertId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:121](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L121)

##### relatedApprovalId

> **relatedApprovalId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:120](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L120)

##### relatedTaskId

> **relatedTaskId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:119](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L119)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [src/lib/workspace/types.ts:117](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L117)

##### source

> **source**: `string`

Defined in: [src/lib/workspace/types.ts:114](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L114)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:115](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L115)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:111](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L111)

***

### WorkspaceActivityItem

> **WorkspaceActivityItem** = `object`

Defined in: [src/lib/workspace/types.ts:146](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L146)

#### Properties

##### actorAddress

> **actorAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:153](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L153)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:154](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L154)

##### description

> **description**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:151](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L151)

##### eventType

> **eventType**: `string`

Defined in: [src/lib/workspace/types.ts:149](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L149)

##### id

> **id**: `string`

Defined in: [src/lib/workspace/types.ts:147](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L147)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:155](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L155)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [src/lib/workspace/types.ts:152](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L152)

##### source

> **source**: `"workspace"` \| `"keepr"` \| `"chat"` \| `"cre"`

Defined in: [src/lib/workspace/types.ts:148](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L148)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:150](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L150)

***

### WorkspaceActivityResponse

> **WorkspaceActivityResponse** = `object`

Defined in: [src/lib/workspace/types.ts:158](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L158)

#### Properties

##### activity

> **activity**: [`WorkspaceActivityItem`](#workspaceactivityitem)[]

Defined in: [src/lib/workspace/types.ts:159](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L159)

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:161](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L161)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:160](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L160)

***

### WorkspaceAlertEvent

> **WorkspaceAlertEvent** = `object`

Defined in: [src/lib/workspace/types.ts:88](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L88)

#### Properties

##### acknowledgedAt

> **acknowledgedAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:102](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L102)

##### acknowledgedBy

> **acknowledgedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:101](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L101)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:105](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L105)

##### createdBy

> **createdBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:100](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L100)

##### dedupeKey

> **dedupeKey**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:98](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L98)

##### details

> **details**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:96](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L96)

##### id

> **id**: `number`

Defined in: [src/lib/workspace/types.ts:89](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L89)

##### kind

> **kind**: `string`

Defined in: [src/lib/workspace/types.ts:93](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L93)

##### message

> **message**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:95](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L95)

##### relatedTaskId

> **relatedTaskId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:99](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L99)

##### resolvedAt

> **resolvedAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:104](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L104)

##### resolvedBy

> **resolvedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:103](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L103)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [src/lib/workspace/types.ts:92](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L92)

##### source

> **source**: `string`

Defined in: [src/lib/workspace/types.ts:91](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L91)

##### status

> **status**: `string`

Defined in: [src/lib/workspace/types.ts:97](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L97)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:94](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L94)

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:106](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L106)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:90](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L90)

***

### WorkspaceApprovalRequest

> **WorkspaceApprovalRequest** = `object`

Defined in: [src/lib/workspace/types.ts:209](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L209)

#### Properties

##### actionType

> **actionType**: `string`

Defined in: [src/lib/workspace/types.ts:212](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L212)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:224](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L224)

##### deadlineAt

> **deadlineAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:219](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L219)

##### decidedAt

> **decidedAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:221](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L221)

##### decidedBy

> **decidedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:220](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L220)

##### decisionReason

> **decisionReason**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:222](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L222)

##### id

> **id**: `number`

Defined in: [src/lib/workspace/types.ts:210](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L210)

##### linkedTaskId

> **linkedTaskId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:223](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L223)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:213](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L213)

##### requestedBy

> **requestedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:217](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L217)

##### severity

> **severity**: `string`

Defined in: [src/lib/workspace/types.ts:215](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L215)

##### signerAddress

> **signerAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:218](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L218)

##### source

> **source**: `string`

Defined in: [src/lib/workspace/types.ts:214](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L214)

##### status

> **status**: `string`

Defined in: [src/lib/workspace/types.ts:216](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L216)

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:225](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L225)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:211](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L211)

***

### WorkspaceCheck

> **WorkspaceCheck** = `object`

Defined in: [src/lib/workspace/types.ts:73](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L73)

#### Properties

##### details?

> `optional` **details**: `string`

Defined in: [src/lib/workspace/types.ts:77](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L77)

##### href?

> `optional` **href**: `string`

Defined in: [src/lib/workspace/types.ts:78](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L78)

##### id

> **id**: `string`

Defined in: [src/lib/workspace/types.ts:74](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L74)

##### label

> **label**: `string`

Defined in: [src/lib/workspace/types.ts:75](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L75)

##### status

> **status**: [`WorkspaceCheckStatus`](#workspacecheckstatus-1)

Defined in: [src/lib/workspace/types.ts:76](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L76)

***

### WorkspaceCheckSection

> **WorkspaceCheckSection** = `object`

Defined in: [src/lib/workspace/types.ts:81](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L81)

#### Properties

##### checks

> **checks**: [`WorkspaceCheck`](#workspacecheck)[]

Defined in: [src/lib/workspace/types.ts:85](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L85)

##### description?

> `optional` **description**: `string`

Defined in: [src/lib/workspace/types.ts:84](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L84)

##### id

> **id**: `string`

Defined in: [src/lib/workspace/types.ts:82](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L82)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:83](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L83)

***

### WorkspaceCheckStatus

> **WorkspaceCheckStatus** = `"pass"` \| `"fail"` \| `"warn"` \| `"info"`

Defined in: [src/lib/workspace/types.ts:71](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L71)

***

### WorkspaceMonitoringResponse

> **WorkspaceMonitoringResponse** = `object`

Defined in: [src/lib/workspace/types.ts:125](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L125)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:143](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L143)

##### alerts

> **alerts**: [`WorkspaceAlertEvent`](#workspacealertevent)[]

Defined in: [src/lib/workspace/types.ts:133](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L133)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:142](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L142)

##### incidents

> **incidents**: [`WorkspaceActivityEvent`](#workspaceactivityevent)[]

Defined in: [src/lib/workspace/types.ts:134](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L134)

##### latestSnapshotId

> **latestSnapshotId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:141](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L141)

##### sections

> **sections**: [`WorkspaceCheckSection`](#workspacechecksection)[]

Defined in: [src/lib/workspace/types.ts:126](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L126)

##### summary

> **summary**: `object`

Defined in: [src/lib/workspace/types.ts:127](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L127)

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

Defined in: [src/lib/workspace/types.ts:135](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L135)

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

Defined in: [src/lib/workspace/types.ts:235](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L235)

#### Properties

##### channels

> **channels**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:242](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L242)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:243](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L243)

##### emailEnabled

> **emailEnabled**: `boolean`

Defined in: [src/lib/workspace/types.ts:240](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L240)

##### minSeverity

> **minSeverity**: `string`

Defined in: [src/lib/workspace/types.ts:241](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L241)

##### principalAddress

> **principalAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:237](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L237)

##### telegramEnabled

> **telegramEnabled**: `boolean`

Defined in: [src/lib/workspace/types.ts:238](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L238)

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:244](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L244)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:236](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L236)

##### xmtpEnabled

> **xmtpEnabled**: `boolean`

Defined in: [src/lib/workspace/types.ts:239](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L239)

***

### WorkspaceRole

> **WorkspaceRole** = `"OWNER"` \| `"ADMIN"` \| `"OPERATOR"` \| `"VIEWER"`

Defined in: [src/lib/workspace/types.ts:1](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L1)

***

### WorkspaceRoomsResponse

> **WorkspaceRoomsResponse** = `object`

Defined in: [src/lib/workspace/types.ts:164](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L164)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:183](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L183)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:182](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L182)

##### telegram

> **telegram**: `object`

Defined in: [src/lib/workspace/types.ts:165](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L165)

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

Defined in: [src/lib/workspace/types.ts:175](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L175)

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

Defined in: [src/lib/workspace/types.ts:247](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L247)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:266](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L266)

##### automation

> **automation**: `object`

Defined in: [src/lib/workspace/types.ts:261](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L261)

###### enabled

> **enabled**: `boolean`

###### scope

> **scope**: `string` \| `null`

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:265](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L265)

##### notificationPreferences

> **notificationPreferences**: [`WorkspaceNotificationPreference`](#workspacenotificationpreference)[]

Defined in: [src/lib/workspace/types.ts:248](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L248)

##### strategyTargets

> **strategyTargets**: `object`[]

Defined in: [src/lib/workspace/types.ts:249](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L249)

###### createdAt

> **createdAt**: `string`

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

Defined in: [src/lib/workspace/types.ts:260](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L260)

***

### WorkspaceSeverity

> **WorkspaceSeverity** = `"info"` \| `"warn"` \| `"critical"`

Defined in: [src/lib/workspace/types.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L3)

***

### WorkspaceStrategiesResponse

> **WorkspaceStrategiesResponse** = `object`

Defined in: [src/lib/workspace/types.ts:65](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L65)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:68](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L68)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:67](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L67)

##### strategies

> **strategies**: [`WorkspaceStrategyRow`](#workspacestrategyrow)[]

Defined in: [src/lib/workspace/types.ts:66](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L66)

***

### WorkspaceStrategyRow

> **WorkspaceStrategyRow** = `object`

Defined in: [src/lib/workspace/types.ts:50](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L50)

#### Properties

##### asset

> **asset**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:58](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L58)

##### availableActions

> **availableActions**: `string`[]

Defined in: [src/lib/workspace/types.ts:62](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L62)

##### currentWeightRaw

> **currentWeightRaw**: `string`

Defined in: [src/lib/workspace/types.ts:55](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L55)

##### isActive

> **isActive**: `boolean` \| `null`

Defined in: [src/lib/workspace/types.ts:54](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L54)

##### kind

> **kind**: `"ajna"` \| `"charm"` \| `"solana"` \| `"unknown"`

Defined in: [src/lib/workspace/types.ts:52](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L52)

##### lastRebalanceAt

> **lastRebalanceAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:61](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L61)

##### liquidityHint

> **liquidityHint**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:59](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L59)

##### owner

> **owner**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:57](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L57)

##### performanceHint

> **performanceHint**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:60](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L60)

##### status

> **status**: `"active"` \| `"paused"` \| `"inactive"` \| `"unknown"`

Defined in: [src/lib/workspace/types.ts:53](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L53)

##### strategyAddress

> **strategyAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:51](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L51)

##### targetWeightBps

> **targetWeightBps**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:56](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L56)

***

### WorkspaceSummary

> **WorkspaceSummary** = `object`

Defined in: [src/lib/workspace/types.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L5)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:47](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L47)

##### automation

> **automation**: `object`

Defined in: [src/lib/workspace/types.ts:40](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L40)

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

Defined in: [src/lib/workspace/types.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L9)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:46](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L46)

##### groupId

> **groupId**: `string`

Defined in: [src/lib/workspace/types.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L7)

##### latestActivity

> **latestActivity**: [`WorkspaceActivityEvent`](#workspaceactivityevent)[]

Defined in: [src/lib/workspace/types.ts:39](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L39)

##### latestAlerts

> **latestAlerts**: [`WorkspaceAlertEvent`](#workspacealertevent)[]

Defined in: [src/lib/workspace/types.ts:38](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L38)

##### metrics

> **metrics**: `object`

Defined in: [src/lib/workspace/types.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L15)

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

Defined in: [src/lib/workspace/types.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L8)

##### rooms

> **rooms**: `object`

Defined in: [src/lib/workspace/types.ts:23](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L23)

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

Defined in: [src/lib/workspace/types.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L10)

###### graduatedAt

> **graduatedAt**: `string` \| `null`

###### settledAt

> **settledAt**: `string` \| `null`

###### settlementStage

> **settlementStage**: `string` \| `null`

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L6)

***

### WorkspaceTabId

> **WorkspaceTabId** = `"overview"` \| `"strategies"` \| `"monitoring"` \| `"activity"` \| `"rooms"` \| `"tasks"` \| `"settings"`

Defined in: [src/lib/workspace/types.ts:274](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L274)

***

### WorkspaceTaskItem

> **WorkspaceTaskItem** = `object`

Defined in: [src/lib/workspace/types.ts:186](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L186)

#### Properties

##### actionPayload

> **actionPayload**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/workspace/types.ts:195](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L195)

##### actionType

> **actionType**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:194](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L194)

##### assigneeWallet

> **assigneeWallet**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:200](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L200)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/workspace/types.ts:205](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L205)

##### createdBy

> **createdBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:203](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L203)

##### description

> **description**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:190](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L190)

##### dueAt

> **dueAt**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:201](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L201)

##### id

> **id**: `number`

Defined in: [src/lib/workspace/types.ts:187](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L187)

##### relatedAlertId

> **relatedAlertId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:196](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L196)

##### relatedApprovalId

> **relatedApprovalId**: `number` \| `null`

Defined in: [src/lib/workspace/types.ts:197](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L197)

##### roomRef

> **roomRef**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:198](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L198)

##### severity

> **severity**: [`WorkspaceSeverity`](#workspaceseverity)

Defined in: [src/lib/workspace/types.ts:192](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L192)

##### snoozedUntil

> **snoozedUntil**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:202](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L202)

##### source

> **source**: `string`

Defined in: [src/lib/workspace/types.ts:191](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L191)

##### status

> **status**: `string`

Defined in: [src/lib/workspace/types.ts:193](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L193)

##### threadRef

> **threadRef**: `string` \| `null`

Defined in: [src/lib/workspace/types.ts:199](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L199)

##### title

> **title**: `string`

Defined in: [src/lib/workspace/types.ts:189](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L189)

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:206](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L206)

##### updatedBy

> **updatedBy**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/workspace/types.ts:204](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L204)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [src/lib/workspace/types.ts:188](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L188)

***

### WorkspaceTasksResponse

> **WorkspaceTasksResponse** = `object`

Defined in: [src/lib/workspace/types.ts:228](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L228)

#### Properties

##### actorRole

> **actorRole**: [`WorkspaceRole`](#workspacerole)

Defined in: [src/lib/workspace/types.ts:232](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L232)

##### approvals

> **approvals**: [`WorkspaceApprovalRequest`](#workspaceapprovalrequest)[]

Defined in: [src/lib/workspace/types.ts:230](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L230)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/lib/workspace/types.ts:231](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L231)

##### tasks

> **tasks**: [`WorkspaceTaskItem`](#workspacetaskitem)[]

Defined in: [src/lib/workspace/types.ts:229](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/workspace/types.ts#L229)
