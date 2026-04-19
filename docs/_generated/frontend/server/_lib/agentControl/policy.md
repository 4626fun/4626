[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agentControl/policy

# server/\_lib/agentControl/policy

## Classes

### ControlPolicyError

Defined in: [server/\_lib/agentControl/policy.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L56)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ControlPolicyError**(`denyCode`, `message`, `details?`): [`ControlPolicyError`](#controlpolicyerror)

Defined in: [server/\_lib/agentControl/policy.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L60)

###### Parameters

###### denyCode

[`PolicyDenyCode`](types.md#policydenycode)

###### message

`string`

###### details?

`Record`\<`string`, `unknown`\>

###### Returns

[`ControlPolicyError`](#controlpolicyerror)

###### Overrides

`Error.constructor`

#### Properties

##### deny\_code

> **deny\_code**: [`PolicyDenyCode`](types.md#policydenycode)

Defined in: [server/\_lib/agentControl/policy.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L57)

##### details?

> `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/agentControl/policy.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L58)

## Type Aliases

### EvaluatePolicyInput

> **EvaluatePolicyInput** = `object`

Defined in: [server/\_lib/agentControl/policy.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L48)

#### Properties

##### allowlist?

> `optional` **allowlist**: `PolicyAllowlist`

Defined in: [server/\_lib/agentControl/policy.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L52)

##### capability

> **capability**: [`ControlCapability`](types.md#controlcapability) \| `null` \| `undefined`

Defined in: [server/\_lib/agentControl/policy.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L49)

##### context

> **context**: `PolicyContext`

Defined in: [server/\_lib/agentControl/policy.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L51)

##### proposal

> **proposal**: [`ActionProposal`](types.md#actionproposal) \| `null` \| `undefined`

Defined in: [server/\_lib/agentControl/policy.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L50)

##### replayGuard?

> `optional` **replayGuard**: [`ReplayGuard`](replay.md#replayguard)

Defined in: [server/\_lib/agentControl/policy.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L53)

## Functions

### assertPolicy()

> **assertPolicy**(`input`): `object`

Defined in: [server/\_lib/agentControl/policy.ts:462](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L462)

#### Parameters

##### input

[`EvaluatePolicyInput`](#evaluatepolicyinput)

#### Returns

`object`

##### allowed

> **allowed**: `true`

##### capability\_id

> **capability\_id**: `string`

##### checked\_at

> **checked\_at**: `string`

##### confirmation\_class

> **confirmation\_class**: [`ConfirmationClass`](types.md#confirmationclass)

##### proposal\_id

> **proposal\_id**: `string`

***

### evaluatePolicy()

> **evaluatePolicy**(`input`): [`PolicyCheckResult`](types.md#policycheckresult)

Defined in: [server/\_lib/agentControl/policy.ts:228](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/policy.ts#L228)

#### Parameters

##### input

[`EvaluatePolicyInput`](#evaluatepolicyinput)

#### Returns

[`PolicyCheckResult`](types.md#policycheckresult)
