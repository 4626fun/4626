[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/siwaAgentAuth

# src/lib/siwaAgentAuth

## Type Aliases

### SignInWithSiwaAgentParams

> **SignInWithSiwaAgentParams** = `object`

Defined in: [src/lib/siwaAgentAuth.ts:65](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/siwaAgentAuth.ts#L65)

#### Properties

##### agentId

> **agentId**: `number`

Defined in: [src/lib/siwaAgentAuth.ts:66](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/siwaAgentAuth.ts#L66)

##### agentRegistry?

> `optional` **agentRegistry**: `string`

Defined in: [src/lib/siwaAgentAuth.ts:69](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/siwaAgentAuth.ts#L69)

##### ownerAddress?

> `optional` **ownerAddress**: `string`

Defined in: [src/lib/siwaAgentAuth.ts:68](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/siwaAgentAuth.ts#L68)

##### signMessage()

> **signMessage**: (`message`) => `Promise`\<`string`\>

Defined in: [src/lib/siwaAgentAuth.ts:67](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/siwaAgentAuth.ts#L67)

###### Parameters

###### message

`string`

###### Returns

`Promise`\<`string`\>

##### statement?

> `optional` **statement**: `string`

Defined in: [src/lib/siwaAgentAuth.ts:70](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/siwaAgentAuth.ts#L70)

***

### SignInWithSiwaAgentResult

> **SignInWithSiwaAgentResult** = `AgentVerifyResponse`

Defined in: [src/lib/siwaAgentAuth.ts:73](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/siwaAgentAuth.ts#L73)

## Functions

### signInWithSiwaAgent()

> **signInWithSiwaAgent**(`params`): `Promise`\<`AgentVerifyResponse`\>

Defined in: [src/lib/siwaAgentAuth.ts:92](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/siwaAgentAuth.ts#L92)

#### Parameters

##### params

[`SignInWithSiwaAgentParams`](#signinwithsiwaagentparams)

#### Returns

`Promise`\<`AgentVerifyResponse`\>
