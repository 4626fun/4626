[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agents/eliza/\_retry

# server/agents/eliza/\_retry

## Functions

### sleep()

> **sleep**(`ms`): `Promise`\<`void`\>

Defined in: [server/agents/eliza/\_retry.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_retry.ts#L16)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>

***

### withRetry()

> **withRetry**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [server/agents/eliza/\_retry.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_retry.ts#L20)

#### Type Parameters

##### T

`T`

#### Parameters

##### params

###### baseDelayMs?

`number`

###### correlationId?

`string`

###### maxRetries?

`number`

###### operation

`string`

###### run

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### withTimeout()

> **withTimeout**\<`T`\>(`promise`, `timeoutMs`, `timeoutMessage`): `Promise`\<`T`\>

Defined in: [server/agents/eliza/\_retry.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_retry.ts#L7)

#### Type Parameters

##### T

`T`

#### Parameters

##### promise

`Promise`\<`T`\>

##### timeoutMs

`number`

##### timeoutMessage

`string`

#### Returns

`Promise`\<`T`\>
