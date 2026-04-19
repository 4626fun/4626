[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/admin/AgentOperatorStatus

# src/pages/admin/AgentOperatorStatus

## Type Aliases

### AgentOperatorNextAction

> **AgentOperatorNextAction** = `object`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L11)

#### Properties

##### detail

> **detail**: `string`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L14)

##### id

> **id**: `string`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L12)

##### label

> **label**: `string`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:13](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L13)

***

### AgentOperatorStatusData

> **AgentOperatorStatusData** = `object`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L17)

#### Properties

##### checkedAt

> **checkedAt**: `string`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L22)

##### discoverability

> **discoverability**: `VerificationSummary`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L20)

##### nextActions

> **nextActions**: [`AgentOperatorNextAction`](#agentoperatornextaction)[]

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L21)

##### publish

> **publish**: [`AgentPublishData`](AgentPublishStatus.md#agentpublishdata)

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L19)

##### registration

> **registration**: `Record`\<`string`, `unknown`\>

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L18)

***

### AgentOperatorSummaryView

> **AgentOperatorSummaryView** = `object`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:30](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L30)

#### Properties

##### readinessBadge

> **readinessBadge**: `BadgeView`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:31](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L31)

##### summaryMessage

> **summaryMessage**: `string`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:34](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L34)

##### uriBadge

> **uriBadge**: `BadgeView`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:33](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L33)

##### walletBadge

> **walletBadge**: `BadgeView`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:32](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L32)

## Functions

### AgentOperatorStatus()

> **AgentOperatorStatus**(`__namedParameters`): `Element`

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:73](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L73)

#### Parameters

##### \_\_namedParameters

`AgentOperatorStatusProps`

#### Returns

`Element`

***

### getAgentOperatorSummaryView()

> **getAgentOperatorSummaryView**(`status`): [`AgentOperatorSummaryView`](#agentoperatorsummaryview)

Defined in: [src/pages/admin/AgentOperatorStatus.tsx:43](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/pages/admin/AgentOperatorStatus.tsx#L43)

#### Parameters

##### status

[`AgentOperatorStatusData`](#agentoperatorstatusdata)

#### Returns

[`AgentOperatorSummaryView`](#agentoperatorsummaryview)
