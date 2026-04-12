[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/admin/AgentPublishStatus

# src/pages/admin/AgentPublishStatus

## Type Aliases

### AgentPublishData

> **AgentPublishData** = `object`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L3)

#### Properties

##### grove?

> `optional` **grove**: `object`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L14)

###### gatewayUrl

> **gatewayUrl**: `string`

###### lensUri

> **lensUri**: `string`

###### statusUrl

> **statusUrl**: `string` \| `null`

###### storageKey

> **storageKey**: `string`

##### groveStatus

> **groveStatus**: `"stored"` \| `"unavailable"` \| `"skipped"`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L13)

##### uriPolicy

> **uriPolicy**: `object`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L4)

###### compatibilityFallbackUrl

> **compatibilityFallbackUrl**: `string` \| `null`

###### domainVerificationUrl

> **domainVerificationUrl**: `string`

###### mirrorUrl

> **mirrorUrl**: `string`

###### mode

> **mode**: `string`

###### preferredOnchainUri

> **preferredOnchainUri**: `string`

###### preferredOnchainUriKind

> **preferredOnchainUriKind**: `string`

###### writeOnchainHint

> **writeOnchainHint**: `string`

***

### AgentPublishStatusView

> **AgentPublishStatusView** = `object`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L22)

#### Properties

##### canonicalMessage

> **canonicalMessage**: `string`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L27)

##### canonicalUriReady

> **canonicalUriReady**: `boolean`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:23](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L23)

##### groveMessage

> **groveMessage**: `string`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L28)

##### groveSkipped

> **groveSkipped**: `boolean`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L26)

##### groveStored

> **groveStored**: `boolean`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L24)

##### groveUnavailable

> **groveUnavailable**: `boolean`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L25)

## Functions

### AgentPublishStatus()

> **AgentPublishStatus**(`__namedParameters`): `Element`

Defined in: [src/pages/admin/AgentPublishStatus.tsx:59](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L59)

#### Parameters

##### \_\_namedParameters

`AgentPublishStatusProps`

#### Returns

`Element`

***

### getAgentPublishStatusView()

> **getAgentPublishStatusView**(`publish`): [`AgentPublishStatusView`](#agentpublishstatusview)

Defined in: [src/pages/admin/AgentPublishStatus.tsx:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AgentPublishStatus.tsx#L31)

#### Parameters

##### publish

[`AgentPublishData`](#agentpublishdata)

#### Returns

[`AgentPublishStatusView`](#agentpublishstatusview)
