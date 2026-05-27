[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/agent/agentCreative

# src/lib/agent/agentCreative

## Type Aliases

### CreativeEnvelope

> **CreativeEnvelope** = [`CreativeSuccessEnvelope`](#creativesuccessenvelope) \| [`CreativeMissingContextEnvelope`](#creativemissingcontextenvelope)

Defined in: [src/lib/agent/agentCreative.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L67)

***

### CreativeMissingContextEnvelope

> **CreativeMissingContextEnvelope** = `object`

Defined in: [src/lib/agent/agentCreative.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L59)

#### Properties

##### error

> **error**: `"missing_required_context"`

Defined in: [src/lib/agent/agentCreative.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L63)

##### missing

> **missing**: `string`[]

Defined in: [src/lib/agent/agentCreative.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L64)

##### mode

> **mode**: [`CreativeMode`](#creativemode) \| `"unknown"`

Defined in: [src/lib/agent/agentCreative.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L61)

##### ok

> **ok**: `false`

Defined in: [src/lib/agent/agentCreative.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L60)

##### version

> **version**: [`CreativeVersion`](#creativeversion)

Defined in: [src/lib/agent/agentCreative.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L62)

***

### CreativeMode

> **CreativeMode** = `"referral_og"` \| `"share_page_copy"` \| `"quest_reward"` \| `"metadata_bundle"`

Defined in: [src/lib/agent/agentCreative.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L5)

***

### CreativeSuccessEnvelope

> **CreativeSuccessEnvelope**\<`M`\> = `object`

Defined in: [src/lib/agent/agentCreative.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L51)

#### Type Parameters

##### M

`M` *extends* [`CreativeMode`](#creativemode) = [`CreativeMode`](#creativemode)

#### Properties

##### mode

> **mode**: `M`

Defined in: [src/lib/agent/agentCreative.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L53)

##### ok

> **ok**: `true`

Defined in: [src/lib/agent/agentCreative.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L52)

##### result

> **result**: `CreativeResultByMode`\[`M`\]

Defined in: [src/lib/agent/agentCreative.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L56)

##### version

> **version**: [`CreativeVersion`](#creativeversion)

Defined in: [src/lib/agent/agentCreative.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L54)

##### voice

> **voice**: [`CreativeVoice`](#creativevoice)

Defined in: [src/lib/agent/agentCreative.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L55)

***

### CreativeVersion

> **CreativeVersion** = `"v1"`

Defined in: [src/lib/agent/agentCreative.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L6)

***

### CreativeVoice

> **CreativeVoice** = `"premium_dark_crypto"`

Defined in: [src/lib/agent/agentCreative.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L7)

***

### MetadataBundleEnvelope

> **MetadataBundleEnvelope** = [`CreativeSuccessEnvelope`](#creativesuccessenvelope)\<`"metadata_bundle"`\>

Defined in: [src/lib/agent/agentCreative.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L72)

***

### MetadataBundleResult

> **MetadataBundleResult** = `object`

Defined in: [src/lib/agent/agentCreative.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L31)

#### Properties

##### alt

> **alt**: `string`

Defined in: [src/lib/agent/agentCreative.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L35)

##### asset\_type

> **asset\_type**: `"og"` \| `"share_card"`

Defined in: [src/lib/agent/agentCreative.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L32)

##### description

> **description**: `string`

Defined in: [src/lib/agent/agentCreative.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L34)

##### filename\_hint

> **filename\_hint**: `string`

Defined in: [src/lib/agent/agentCreative.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L37)

##### pinata\_metadata

> **pinata\_metadata**: `object`

Defined in: [src/lib/agent/agentCreative.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L38)

###### keyvalues

> **keyvalues**: `Record`\<`string`, `string` \| `number` \| `boolean`\>

###### name

> **name**: `string`

##### tags

> **tags**: `string`[]

Defined in: [src/lib/agent/agentCreative.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L36)

##### title

> **title**: `string`

Defined in: [src/lib/agent/agentCreative.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L33)

***

### QuestRewardEnvelope

> **QuestRewardEnvelope** = [`CreativeSuccessEnvelope`](#creativesuccessenvelope)\<`"quest_reward"`\>

Defined in: [src/lib/agent/agentCreative.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L71)

***

### QuestRewardResult

> **QuestRewardResult** = `object`

Defined in: [src/lib/agent/agentCreative.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L24)

#### Properties

##### next\_step

> **next\_step**: `string`

Defined in: [src/lib/agent/agentCreative.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L28)

##### status

> **status**: `"locked"` \| `"unlocked"` \| `"claimed"`

Defined in: [src/lib/agent/agentCreative.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L26)

##### tier

> **tier**: `"base"` \| `"supporter"` \| `"boosted"` \| `"premium"`

Defined in: [src/lib/agent/agentCreative.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L25)

##### unlock\_message

> **unlock\_message**: `string`

Defined in: [src/lib/agent/agentCreative.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L27)

***

### ReferralOgEnvelope

> **ReferralOgEnvelope** = [`CreativeSuccessEnvelope`](#creativesuccessenvelope)\<`"referral_og"`\>

Defined in: [src/lib/agent/agentCreative.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L69)

***

### ReferralOgResult

> **ReferralOgResult** = `object`

Defined in: [src/lib/agent/agentCreative.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L9)

#### Properties

##### cta

> **cta**: `string`

Defined in: [src/lib/agent/agentCreative.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L12)

##### headline

> **headline**: `string`

Defined in: [src/lib/agent/agentCreative.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L10)

##### keywords

> **keywords**: `string`[]

Defined in: [src/lib/agent/agentCreative.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L14)

##### subheadline

> **subheadline**: `string`

Defined in: [src/lib/agent/agentCreative.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L11)

##### visual\_direction

> **visual\_direction**: `string`[]

Defined in: [src/lib/agent/agentCreative.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L13)

***

### SharePageCopyEnvelope

> **SharePageCopyEnvelope** = [`CreativeSuccessEnvelope`](#creativesuccessenvelope)\<`"share_page_copy"`\>

Defined in: [src/lib/agent/agentCreative.ts:70](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L70)

***

### SharePageCopyResult

> **SharePageCopyResult** = `object`

Defined in: [src/lib/agent/agentCreative.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L17)

#### Properties

##### body\_short

> **body\_short**: `string`

Defined in: [src/lib/agent/agentCreative.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L20)

##### cta

> **cta**: `string`

Defined in: [src/lib/agent/agentCreative.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L21)

##### subtitle

> **subtitle**: `string`

Defined in: [src/lib/agent/agentCreative.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L19)

##### title

> **title**: `string`

Defined in: [src/lib/agent/agentCreative.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L18)

## Functions

### generateAgentCreative()

> **generateAgentCreative**(`params`): `Promise`\<[`CreativeEnvelope`](#creativeenvelope)\>

Defined in: [src/lib/agent/agentCreative.ts:221](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L221)

#### Parameters

##### params

###### context

`Record`\<`string`, `unknown`\>

###### mode

[`CreativeMode`](#creativemode)

#### Returns

`Promise`\<[`CreativeEnvelope`](#creativeenvelope)\>

***

### isReferralOgEnvelope()

> **isReferralOgEnvelope**(`envelope`): `envelope is ReferralOgEnvelope`

Defined in: [src/lib/agent/agentCreative.ts:241](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/agent/agentCreative.ts#L241)

#### Parameters

##### envelope

[`CreativeEnvelope`](#creativeenvelope)

#### Returns

`envelope is ReferralOgEnvelope`
