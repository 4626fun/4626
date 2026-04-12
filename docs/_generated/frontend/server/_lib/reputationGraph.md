[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/reputationGraph

# server/\_lib/reputationGraph

## Type Aliases

### ReputationGraph

> **ReputationGraph** = `object`

Defined in: [server/\_lib/reputationGraph.ts:74](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L74)

#### Properties

##### agentId

> **agentId**: `number`

Defined in: [server/\_lib/reputationGraph.ts:75](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L75)

##### agentRegistry

> **agentRegistry**: `string`

Defined in: [server/\_lib/reputationGraph.ts:76](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L76)

##### agentWallet?

> `optional` **agentWallet**: `string`

Defined in: [server/\_lib/reputationGraph.ts:82](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L82)

Agent wallet address (typically the CSW) if known

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/reputationGraph.ts:78](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L78)

##### edges

> **edges**: [`ReputationGraphEdge`](#reputationgraphedge)[]

Defined in: [server/\_lib/reputationGraph.ts:84](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L84)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/reputationGraph.ts:93](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L93)

##### groups

> **groups**: [`ReputationGraphGroup`](#reputationgraphgroup)[]

Defined in: [server/\_lib/reputationGraph.ts:85](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L85)

##### nodes

> **nodes**: [`ReputationGraphNode`](#reputationgraphnode)[]

Defined in: [server/\_lib/reputationGraph.ts:83](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L83)

##### reputationRegistry

> **reputationRegistry**: `string`

Defined in: [server/\_lib/reputationGraph.ts:77](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L77)

##### source

> **source**: `string`

Defined in: [server/\_lib/reputationGraph.ts:94](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L94)

##### summary

> **summary**: `object`

Defined in: [server/\_lib/reputationGraph.ts:86](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L86)

###### averageValue

> **averageValue**: `string`

###### averageValueDecimals

> **averageValueDecimals**: `number`

###### label

> **label**: `string`

###### totalFeedback

> **totalFeedback**: `number`

###### totalReviewers

> **totalReviewers**: `number`

##### xmtpAddress?

> `optional` **xmtpAddress**: `string`

Defined in: [server/\_lib/reputationGraph.ts:80](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L80)

XMTP messaging address (CSW or EOA) if known

***

### ReputationGraphEdge

> **ReputationGraphEdge** = `object`

Defined in: [server/\_lib/reputationGraph.ts:60](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L60)

#### Properties

##### source

> **source**: `string`

Defined in: [server/\_lib/reputationGraph.ts:61](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L61)

##### target

> **target**: `string`

Defined in: [server/\_lib/reputationGraph.ts:62](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L62)

##### type

> **type**: `"reviewed"` \| `"has_feedback"` \| `"authored"` \| `"responded_to"`

Defined in: [server/\_lib/reputationGraph.ts:63](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L63)

##### weight?

> `optional` **weight**: `number`

Defined in: [server/\_lib/reputationGraph.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L64)

***

### ReputationGraphGroup

> **ReputationGraphGroup** = `object`

Defined in: [server/\_lib/reputationGraph.ts:67](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L67)

#### Properties

##### id

> **id**: `string`

Defined in: [server/\_lib/reputationGraph.ts:68](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L68)

##### label

> **label**: `string`

Defined in: [server/\_lib/reputationGraph.ts:69](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L69)

##### namespace?

> `optional` **namespace**: `string`

Defined in: [server/\_lib/reputationGraph.ts:71](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L71)

##### nodeIds

> **nodeIds**: `string`[]

Defined in: [server/\_lib/reputationGraph.ts:70](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L70)

***

### ReputationGraphNode

> **ReputationGraphNode** = `object`

Defined in: [server/\_lib/reputationGraph.ts:44](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L44)

#### Properties

##### address?

> `optional` **address**: `string`

Defined in: [server/\_lib/reputationGraph.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L48)

##### agentId?

> `optional` **agentId**: `number`

Defined in: [server/\_lib/reputationGraph.ts:49](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L49)

##### displayValue?

> `optional` **displayValue**: `string`

Defined in: [server/\_lib/reputationGraph.ts:53](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L53)

##### feedbackIndex?

> `optional` **feedbackIndex**: `number`

Defined in: [server/\_lib/reputationGraph.ts:50](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L50)

##### id

> **id**: `string`

Defined in: [server/\_lib/reputationGraph.ts:45](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L45)

##### isRevoked?

> `optional` **isRevoked**: `boolean`

Defined in: [server/\_lib/reputationGraph.ts:57](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L57)

##### label

> **label**: `string`

Defined in: [server/\_lib/reputationGraph.ts:46](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L46)

##### ratingLabel?

> `optional` **ratingLabel**: `string`

Defined in: [server/\_lib/reputationGraph.ts:54](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L54)

##### tag1?

> `optional` **tag1**: `string`

Defined in: [server/\_lib/reputationGraph.ts:55](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L55)

##### tag2?

> `optional` **tag2**: `string`

Defined in: [server/\_lib/reputationGraph.ts:56](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L56)

##### type

> **type**: `"agent"` \| `"reviewer"` \| `"feedback"`

Defined in: [server/\_lib/reputationGraph.ts:47](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L47)

##### value?

> `optional` **value**: `number`

Defined in: [server/\_lib/reputationGraph.ts:51](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L51)

##### valueDecimals?

> `optional` **valueDecimals**: `number`

Defined in: [server/\_lib/reputationGraph.ts:52](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L52)

## Functions

### buildReputationGraph()

> **buildReputationGraph**(`params`): `Promise`\<[`ReputationGraph`](#reputationgraph)\>

Defined in: [server/\_lib/reputationGraph.ts:110](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/reputationGraph.ts#L110)

#### Parameters

##### params

###### agentId

`number`

###### includeRevoked?

`boolean`

###### tag1Filter?

`string`

###### tag2Filter?

`string`

#### Returns

`Promise`\<[`ReputationGraph`](#reputationgraph)\>
