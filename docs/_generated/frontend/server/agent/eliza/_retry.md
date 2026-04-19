[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/\_retry

# server/agent/eliza/\_retry

## Functions

### sleep()

> **sleep**(`ms`): `Promise`\<`void`\>

Defined in: [server/agent/eliza/\_retry.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/eliza/_retry.ts#L16)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>

***

### withRetry()

> **withRetry**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [server/agent/eliza/\_retry.ts:20](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/eliza/_retry.ts#L20)

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

Defined in: [server/agent/eliza/\_retry.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/eliza/_retry.ts#L7)

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
