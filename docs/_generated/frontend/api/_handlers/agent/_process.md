[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/agent/\_process

# api/\_handlers/agent/\_process

## Variables

### DEFAULT\_CHECKPOINT\_WINDOW\_MS

> `const` **DEFAULT\_CHECKPOINT\_WINDOW\_MS**: `120000` = `120_000`

Defined in: [api/\_handlers/agent/\_process.ts:55](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L55)

***

### MAX\_MESSAGES\_PER\_CONVERSATION

> `const` **MAX\_MESSAGES\_PER\_CONVERSATION**: `50` = `50`

Defined in: [api/\_handlers/agent/\_process.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L54)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse`\>

Defined in: [api/\_handlers/agent/\_process.ts:468](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L468)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse`\>

***

### getCheckpointMs()

> **getCheckpointMs**(`lastProcessedAt`, `nowMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:162](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L162)

#### Parameters

##### lastProcessedAt

`unknown`

##### nowMs

`number` = `...`

#### Returns

`number`

***

### getEthereumAddressFromInboxState()

> **getEthereumAddressFromInboxState**(`state`): `string` \| `null`

Defined in: [api/\_handlers/agent/\_process.ts:190](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L190)

#### Parameters

##### state

`any`

#### Returns

`string` \| `null`

***

### getInitialConversationCheckpointMs()

> **getInitialConversationCheckpointMs**(`lastProcessedAt`, `nowMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:170](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L170)

#### Parameters

##### lastProcessedAt

`unknown`

##### nowMs

`number` = `...`

#### Returns

`number`

***

### getMessageQueryOptions()

> **getMessageQueryOptions**(`lastProcessedMs`): `object`

Defined in: [api/\_handlers/agent/\_process.ts:176](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L176)

#### Parameters

##### lastProcessedMs

`number`

#### Returns

`object`

##### direction

> **direction**: `number`

##### limit

> **limit**: `number`

##### sentAfterNs

> **sentAfterNs**: `bigint`

***

### isAgentProcessServerlessRuntime()

> **isAgentProcessServerlessRuntime**(`env`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:110](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L110)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`boolean`

***

### isAuthorized()

> **isAuthorized**(`req`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:441](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L441)

#### Parameters

##### req

`VercelRequest`

#### Returns

`boolean`

***

### mergeCheckpointMs()

> **mergeCheckpointMs**(`previousMs`, `candidateMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:202](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L202)

#### Parameters

##### previousMs

`number`

##### candidateMs

`number`

#### Returns

`number`

***

### parseConversationCheckpointRows()

> **parseConversationCheckpointRows**(`rows`): `Map`\<`string`, `number`\>

Defined in: [api/\_handlers/agent/\_process.ts:278](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L278)

#### Parameters

##### rows

`Record`\<`string`, `unknown`\>[]

#### Returns

`Map`\<`string`, `number`\>

***

### readAgentProcessRequirePersistentDb()

> **readAgentProcessRequirePersistentDb**(`raw`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:104](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L104)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`boolean`

***

### readCronSecretFromHeaders()

> **readCronSecretFromHeaders**(`req`): `string`

Defined in: [api/\_handlers/agent/\_process.ts:430](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L430)

#### Parameters

##### req

`VercelRequest`

#### Returns

`string`

***

### readStrictUnsupportedRetryEnabled()

> **readStrictUnsupportedRetryEnabled**(`raw`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:98](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L98)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`boolean`

***

### resolveAgentProcessXmtpPersistenceError()

> **resolveAgentProcessXmtpPersistenceError**(`input`): `string` \| `null`

Defined in: [api/\_handlers/agent/\_process.ts:120](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L120)

#### Parameters

##### input

###### configuredDbDir?

`string`

###### hasDedicatedMountResult?

`boolean`

###### isServerless

`boolean`

###### mountedAncestor?

`string` \| `null`

###### requirePersistentDb

`boolean`

###### resolvedDbDir

`string`

#### Returns

`string` \| `null`

***

### resolveFallbackCommandReply()

> **resolveFallbackCommandReply**(`params`): `object`

Defined in: [api/\_handlers/agent/\_process.ts:248](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L248)

#### Parameters

##### params

###### result

`FallbackCommandResult`

###### text

`string`

#### Returns

`object`

##### fallbackGenerated

> **fallbackGenerated**: `boolean`

##### replyText

> **replyText**: `string`

***

### shouldDeferFallbackCommand()

> **shouldDeferFallbackCommand**(`params`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:271](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L271)

#### Parameters

##### params

###### fallbackGenerated

`boolean`

###### strictUnsupportedRetry

`boolean`

#### Returns

`boolean`
