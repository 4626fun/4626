[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/auth/siwaAgentAuth

# src/lib/auth/siwaAgentAuth

## Type Aliases

### SignInWithSiwaAgentParams

> **SignInWithSiwaAgentParams** = `object`

Defined in: [src/lib/auth/siwaAgentAuth.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/siwaAgentAuth.ts#L64)

#### Properties

##### agentId

> **agentId**: `number`

Defined in: [src/lib/auth/siwaAgentAuth.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/siwaAgentAuth.ts#L65)

##### agentRegistry?

> `optional` **agentRegistry**: `string`

Defined in: [src/lib/auth/siwaAgentAuth.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/siwaAgentAuth.ts#L68)

##### ownerAddress?

> `optional` **ownerAddress**: `string`

Defined in: [src/lib/auth/siwaAgentAuth.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/siwaAgentAuth.ts#L67)

##### signMessage()

> **signMessage**: (`message`) => `Promise`\<`string`\>

Defined in: [src/lib/auth/siwaAgentAuth.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/siwaAgentAuth.ts#L66)

###### Parameters

###### message

`string`

###### Returns

`Promise`\<`string`\>

##### statement?

> `optional` **statement**: `string`

Defined in: [src/lib/auth/siwaAgentAuth.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/siwaAgentAuth.ts#L69)

***

### SignInWithSiwaAgentResult

> **SignInWithSiwaAgentResult** = `AgentVerifyResponse`

Defined in: [src/lib/auth/siwaAgentAuth.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/siwaAgentAuth.ts#L72)

## Functions

### signInWithSiwaAgent()

> **signInWithSiwaAgent**(`params`): `Promise`\<`AgentVerifyResponse`\>

Defined in: [src/lib/auth/siwaAgentAuth.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/siwaAgentAuth.ts#L83)

#### Parameters

##### params

[`SignInWithSiwaAgentParams`](#signinwithsiwaagentparams)

#### Returns

`Promise`\<`AgentVerifyResponse`\>
