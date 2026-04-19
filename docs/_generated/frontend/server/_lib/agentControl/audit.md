[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agentControl/audit

# server/\_lib/agentControl/audit

## Type Aliases

### AppendControlAuditInput

> **AppendControlAuditInput** = `object`

Defined in: [server/\_lib/agentControl/audit.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L85)

#### Properties

##### action

> **action**: `string`

Defined in: [server/\_lib/agentControl/audit.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L93)

##### actor\_id

> **actor\_id**: `string`

Defined in: [server/\_lib/agentControl/audit.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L91)

##### actor\_type

> **actor\_type**: [`ControlActorType`](types.md#controlactortype)

Defined in: [server/\_lib/agentControl/audit.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L90)

##### capability\_id

> **capability\_id**: `string`

Defined in: [server/\_lib/agentControl/audit.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L89)

##### correlation\_id

> **correlation\_id**: `string`

Defined in: [server/\_lib/agentControl/audit.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L95)

##### db?

> `optional` **db**: `DbLike` \| `null`

Defined in: [server/\_lib/agentControl/audit.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L86)

##### error\_code?

> `optional` **error\_code**: `string` \| `null`

Defined in: [server/\_lib/agentControl/audit.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L97)

##### error\_message?

> `optional` **error\_message**: `string` \| `null`

Defined in: [server/\_lib/agentControl/audit.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L98)

##### event\_type

> **event\_type**: [`ControlAuditEventType`](types.md#controlauditeventtype)

Defined in: [server/\_lib/agentControl/audit.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L87)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/agentControl/audit.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L99)

##### proposal\_id

> **proposal\_id**: `string`

Defined in: [server/\_lib/agentControl/audit.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L88)

##### reason?

> `optional` **reason**: `string` \| `null`

Defined in: [server/\_lib/agentControl/audit.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L96)

##### status

> **status**: `"allow"` \| `"deny"` \| `"success"` \| `"failed"`

Defined in: [server/\_lib/agentControl/audit.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L94)

##### subsystem

> **subsystem**: `string`

Defined in: [server/\_lib/agentControl/audit.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L92)

## Functions

### appendControlAuditEvent()

> **appendControlAuditEvent**(`input`): `Promise`\<[`ControlAuditEvent`](types.md#controlauditevent) \| `null`\>

Defined in: [server/\_lib/agentControl/audit.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L102)

#### Parameters

##### input

[`AppendControlAuditInput`](#appendcontrolauditinput)

#### Returns

`Promise`\<[`ControlAuditEvent`](types.md#controlauditevent) \| `null`\>

***

### ensureAgentControlAuditSchema()

> **ensureAgentControlAuditSchema**(`inputDb?`): `Promise`\<`void`\>

Defined in: [server/\_lib/agentControl/audit.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/audit.ts#L38)

#### Parameters

##### inputDb?

`DbLike` | `null`

#### Returns

`Promise`\<`void`\>
