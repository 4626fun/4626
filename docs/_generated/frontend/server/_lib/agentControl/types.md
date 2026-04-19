[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agentControl/types

# server/\_lib/agentControl/types

## Type Aliases

### ActionProposal

> **ActionProposal** = `object`

Defined in: [server/\_lib/agentControl/types.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L57)

#### Properties

##### action

> **action**: `string`

Defined in: [server/\_lib/agentControl/types.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L61)

##### bounds

> **bounds**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/agentControl/types.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L64)

##### capability\_id

> **capability\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L59)

##### correlation\_id

> **correlation\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L65)

##### created\_at

> **created\_at**: `string`

Defined in: [server/\_lib/agentControl/types.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L66)

##### intent

> **intent**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/agentControl/types.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L62)

##### metadata

> **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/agentControl/types.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L68)

##### proposal\_id

> **proposal\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L58)

##### rationale

> **rationale**: `string`

Defined in: [server/\_lib/agentControl/types.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L63)

##### requested\_confirmation\_class

> **requested\_confirmation\_class**: [`ConfirmationClass`](#confirmationclass)

Defined in: [server/\_lib/agentControl/types.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L67)

##### subsystem

> **subsystem**: `string`

Defined in: [server/\_lib/agentControl/types.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L60)

***

### ConfirmationClass

> **ConfirmationClass** = `"none"` \| `"policy_only"` \| `"human_required"` \| `"human_plus_policy"`

Defined in: [server/\_lib/agentControl/types.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L3)

***

### ConfirmationEvidence

> **ConfirmationEvidence** = `object`

Defined in: [server/\_lib/agentControl/types.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L81)

#### Properties

##### approval\_actor\_id?

> `optional` **approval\_actor\_id**: `string` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L85)

##### approved

> **approved**: `boolean`

Defined in: [server/\_lib/agentControl/types.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L83)

##### approved\_at?

> `optional` **approved\_at**: `string` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L84)

##### confirmation\_class

> **confirmation\_class**: [`ConfirmationClass`](#confirmationclass)

Defined in: [server/\_lib/agentControl/types.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L82)

##### token\_consumed\_at?

> `optional` **token\_consumed\_at**: `string` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L87)

##### token\_id?

> `optional` **token\_id**: `string` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L86)

***

### ControlActorType

> **ControlActorType** = `"telegram_user"` \| `"session_user"` \| `"machine"` \| `"runtime"` \| `"system"`

Defined in: [server/\_lib/agentControl/types.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L9)

***

### ControlAuditEvent

> **ControlAuditEvent** = `object`

Defined in: [server/\_lib/agentControl/types.ts:134](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L134)

#### Properties

##### action

> **action**: `string`

Defined in: [server/\_lib/agentControl/types.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L142)

##### actor\_id

> **actor\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L140)

##### actor\_type

> **actor\_type**: [`ControlActorType`](#controlactortype)

Defined in: [server/\_lib/agentControl/types.ts:139](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L139)

##### capability\_id

> **capability\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L138)

##### correlation\_id

> **correlation\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:144](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L144)

##### created\_at

> **created\_at**: `string`

Defined in: [server/\_lib/agentControl/types.ts:149](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L149)

##### error\_code?

> `optional` **error\_code**: `string` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L146)

##### error\_message?

> `optional` **error\_message**: `string` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L147)

##### event\_id

> **event\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:135](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L135)

##### event\_type

> **event\_type**: [`ControlAuditEventType`](#controlauditeventtype)

Defined in: [server/\_lib/agentControl/types.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L136)

##### metadata

> **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/agentControl/types.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L148)

##### proposal\_id

> **proposal\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L137)

##### reason?

> `optional` **reason**: `string` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L145)

##### status

> **status**: `"allow"` \| `"deny"` \| `"success"` \| `"failed"`

Defined in: [server/\_lib/agentControl/types.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L143)

##### subsystem

> **subsystem**: `string`

Defined in: [server/\_lib/agentControl/types.ts:141](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L141)

***

### ControlAuditEventType

> **ControlAuditEventType** = `"proposal.created"` \| `"proposal.denied"` \| `"confirmation.accepted"` \| `"confirmation.rejected"` \| `"policy.denied"` \| `"execution.started"` \| `"execution.succeeded"` \| `"execution.failed"`

Defined in: [server/\_lib/agentControl/types.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L124)

***

### ControlCapability

> **ControlCapability** = `object`

Defined in: [server/\_lib/agentControl/types.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L42)

#### Properties

##### action

> **action**: `string`

Defined in: [server/\_lib/agentControl/types.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L47)

##### actor\_id

> **actor\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L45)

##### actor\_type

> **actor\_type**: [`ControlActorType`](#controlactortype)

Defined in: [server/\_lib/agentControl/types.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L44)

##### capability\_id

> **capability\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L43)

##### confirmation\_class

> **confirmation\_class**: [`ConfirmationClass`](#confirmationclass)

Defined in: [server/\_lib/agentControl/types.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L50)

##### expires\_at

> **expires\_at**: `string`

Defined in: [server/\_lib/agentControl/types.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L52)

##### issued\_at

> **issued\_at**: `string`

Defined in: [server/\_lib/agentControl/types.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L51)

##### issued\_by

> **issued\_by**: `string`

Defined in: [server/\_lib/agentControl/types.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L53)

##### limits

> **limits**: [`ControlCapabilityLimits`](#controlcapabilitylimits-1)

Defined in: [server/\_lib/agentControl/types.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L49)

##### metadata

> **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/agentControl/types.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L54)

##### scope

> **scope**: [`ControlCapabilityScope`](#controlcapabilityscope-1)

Defined in: [server/\_lib/agentControl/types.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L48)

##### subsystem

> **subsystem**: `string`

Defined in: [server/\_lib/agentControl/types.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L46)

***

### ControlCapabilityLimits

> **ControlCapabilityLimits** = `object`

Defined in: [server/\_lib/agentControl/types.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L32)

#### Properties

##### allowed\_targets?

> `optional` **allowed\_targets**: `string`[]

Defined in: [server/\_lib/agentControl/types.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L38)

##### amount\_ceiling?

> `optional` **amount\_ceiling**: `object`

Defined in: [server/\_lib/agentControl/types.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L33)

###### unit

> **unit**: `"eth"` \| `"usd"` \| `"shares"` \| `"wei"` \| `string`

###### value

> **value**: `number`

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/agentControl/types.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L39)

##### ttl\_seconds?

> `optional` **ttl\_seconds**: `number`

Defined in: [server/\_lib/agentControl/types.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L37)

***

### ControlCapabilityScope

> **ControlCapabilityScope** = `object`

Defined in: [server/\_lib/agentControl/types.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L16)

#### Properties

##### account\_address?

> `optional` **account\_address**: `` `0x${string}` ``

Defined in: [server/\_lib/agentControl/types.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L22)

##### actor\_binding?

> `optional` **actor\_binding**: `object`

Defined in: [server/\_lib/agentControl/types.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L25)

###### canonical\_wallet?

> `optional` **canonical\_wallet**: `` `0x${string}` ``

###### chat\_id?

> `optional` **chat\_id**: `string`

###### telegram\_user\_id?

> `optional` **telegram\_user\_id**: `string`

##### chain\_id?

> `optional` **chain\_id**: `number`

Defined in: [server/\_lib/agentControl/types.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L17)

##### creator\_coin\_address?

> `optional` **creator\_coin\_address**: `` `0x${string}` ``

Defined in: [server/\_lib/agentControl/types.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L23)

##### group\_id?

> `optional` **group\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L21)

##### market\_id?

> `optional` **market\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L19)

##### queue?

> `optional` **queue**: `string`

Defined in: [server/\_lib/agentControl/types.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L20)

##### token\_class?

> `optional` **token\_class**: `string`

Defined in: [server/\_lib/agentControl/types.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L24)

##### vault\_address?

> `optional` **vault\_address**: `` `0x${string}` ``

Defined in: [server/\_lib/agentControl/types.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L18)

***

### PolicyCheckResult

> **PolicyCheckResult** = \{ `allowed`: `true`; `capability_id`: `string`; `checked_at`: `string`; `confirmation_class`: [`ConfirmationClass`](#confirmationclass); `proposal_id`: `string`; \} \| \{ `allowed`: `false`; `capability_id`: `string`; `checked_at`: `string`; `confirmation_class`: [`ConfirmationClass`](#confirmationclass); `deny_code`: [`PolicyDenyCode`](#policydenycode); `details?`: `Record`\<`string`, `unknown`\>; `proposal_id`: `string`; `reason`: `string`; \}

Defined in: [server/\_lib/agentControl/types.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L105)

***

### PolicyDenyCode

> **PolicyDenyCode** = `"capability_missing"` \| `"capability_expired"` \| `"proposal_expired"` \| `"actor_mismatch"` \| `"subsystem_mismatch"` \| `"action_mismatch"` \| `"scope_mismatch"` \| `"amount_exceeded"` \| `"target_not_allowed"` \| `"confirmation_missing"` \| `"confirmation_rejected"` \| `"confirmation_actor_mismatch"` \| `"replay_detected"`

Defined in: [server/\_lib/agentControl/types.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L90)

***

### ProposalExecutionContext

> **ProposalExecutionContext** = `object`

Defined in: [server/\_lib/agentControl/types.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L71)

#### Properties

##### actor\_id

> **actor\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L74)

##### actor\_type

> **actor\_type**: [`ControlActorType`](#controlactortype)

Defined in: [server/\_lib/agentControl/types.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L73)

##### canonical\_wallet?

> `optional` **canonical\_wallet**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L78)

##### chat\_id?

> `optional` **chat\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L76)

##### message\_id?

> `optional` **message\_id**: `number` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L77)

##### source

> **source**: `string`

Defined in: [server/\_lib/agentControl/types.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L72)

##### telegram\_user\_id?

> `optional` **telegram\_user\_id**: `string`

Defined in: [server/\_lib/agentControl/types.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L75)

## Functions

### addSeconds()

> **addSeconds**(`isoDate`, `seconds`): `string`

Defined in: [server/\_lib/agentControl/types.ts:156](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L156)

#### Parameters

##### isoDate

`string`

##### seconds

`number`

#### Returns

`string`

***

### createActionProposal()

> **createActionProposal**(`input`): [`ActionProposal`](#actionproposal)

Defined in: [server/\_lib/agentControl/types.ts:240](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L240)

#### Parameters

##### input

###### action

`string`

###### bounds?

`Record`\<`string`, `unknown`\>

###### capability_id

`string`

###### correlation_id

`string`

###### created_at?

`string`

###### intent

`Record`\<`string`, `unknown`\>

###### metadata?

`Record`\<`string`, `unknown`\>

###### rationale?

`string`

###### requested_confirmation_class

[`ConfirmationClass`](#confirmationclass)

###### subsystem

`string`

#### Returns

[`ActionProposal`](#actionproposal)

***

### createCapabilityId()

> **createCapabilityId**(`prefix`): `string`

Defined in: [server/\_lib/agentControl/types.ts:162](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L162)

#### Parameters

##### prefix

`string` = `'cap'`

#### Returns

`string`

***

### createControlCapability()

> **createControlCapability**(`input`): [`ControlCapability`](#controlcapability)

Defined in: [server/\_lib/agentControl/types.ts:205](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L205)

#### Parameters

##### input

###### action

`string`

###### actor_id

`string`

###### actor_type

[`ControlActorType`](#controlactortype)

###### confirmation_class

[`ConfirmationClass`](#confirmationclass)

###### expires_at?

`string`

###### issued_at?

`string`

###### issued_by

`string`

###### limits?

[`ControlCapabilityLimits`](#controlcapabilitylimits-1)

###### metadata?

`Record`\<`string`, `unknown`\>

###### scope?

[`ControlCapabilityScope`](#controlcapabilityscope-1)

###### subsystem

`string`

#### Returns

[`ControlCapability`](#controlcapability)

***

### createEventId()

> **createEventId**(`prefix`): `string`

Defined in: [server/\_lib/agentControl/types.ts:170](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L170)

#### Parameters

##### prefix

`string` = `'evt'`

#### Returns

`string`

***

### createProposalId()

> **createProposalId**(`prefix`): `string`

Defined in: [server/\_lib/agentControl/types.ts:166](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L166)

#### Parameters

##### prefix

`string` = `'prop'`

#### Returns

`string`

***

### hasExpired()

> **hasExpired**(`isoDate`, `now`): `boolean`

Defined in: [server/\_lib/agentControl/types.ts:200](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L200)

#### Parameters

##### isoDate

`string`

##### now

`number` = `...`

#### Returns

`boolean`

***

### isAddressLike()

> **isAddressLike**(`value`): `` value is `0x${string}` ``

Defined in: [server/\_lib/agentControl/types.ts:182](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L182)

#### Parameters

##### value

`unknown`

#### Returns

`` value is `0x${string}` ``

***

### normalizeAddressOrNull()

> **normalizeAddressOrNull**(`value`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/agentControl/types.ts:186](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L186)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### normalizeConfirmationClass()

> **normalizeConfirmationClass**(`input`): [`ConfirmationClass`](#confirmationclass)

Defined in: [server/\_lib/agentControl/types.ts:191](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L191)

#### Parameters

##### input

`unknown`

#### Returns

[`ConfirmationClass`](#confirmationclass)

***

### nowIso()

> **nowIso**(): `string`

Defined in: [server/\_lib/agentControl/types.ts:152](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L152)

#### Returns

`string`

***

### toSafeLower()

> **toSafeLower**(`value`): `string`

Defined in: [server/\_lib/agentControl/types.ts:174](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L174)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### toTrimmed()

> **toTrimmed**(`value`): `string`

Defined in: [server/\_lib/agentControl/types.ts:178](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/types.ts#L178)

#### Parameters

##### value

`unknown`

#### Returns

`string`
