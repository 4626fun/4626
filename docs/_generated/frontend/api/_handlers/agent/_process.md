[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/agent/\_process

# api/\_handlers/agent/\_process

## Variables

### DEFAULT\_CHECKPOINT\_WINDOW\_MS

> `const` **DEFAULT\_CHECKPOINT\_WINDOW\_MS**: `120000` = `120_000`

Defined in: [api/\_handlers/agent/\_process.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L54)

***

### MAX\_MESSAGES\_PER\_CONVERSATION

> `const` **MAX\_MESSAGES\_PER\_CONVERSATION**: `50` = `50`

Defined in: [api/\_handlers/agent/\_process.ts:53](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L53)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse`\>

Defined in: [api/\_handlers/agent/\_process.ts:466](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L466)

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

Defined in: [api/\_handlers/agent/\_process.ts:161](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L161)

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

Defined in: [api/\_handlers/agent/\_process.ts:189](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L189)

#### Parameters

##### state

`any`

#### Returns

`string` \| `null`

***

### getInitialConversationCheckpointMs()

> **getInitialConversationCheckpointMs**(`lastProcessedAt`, `nowMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:169](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L169)

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

Defined in: [api/\_handlers/agent/\_process.ts:175](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L175)

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

Defined in: [api/\_handlers/agent/\_process.ts:109](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L109)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`boolean`

***

### isAuthorized()

> **isAuthorized**(`req`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:440](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L440)

#### Parameters

##### req

`VercelRequest`

#### Returns

`boolean`

***

### mergeCheckpointMs()

> **mergeCheckpointMs**(`previousMs`, `candidateMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:201](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L201)

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

Defined in: [api/\_handlers/agent/\_process.ts:277](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L277)

#### Parameters

##### rows

`Record`\<`string`, `unknown`\>[]

#### Returns

`Map`\<`string`, `number`\>

***

### readAgentProcessRequirePersistentDb()

> **readAgentProcessRequirePersistentDb**(`raw`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:103](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L103)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`boolean`

***

### readCronSecretFromHeaders()

> **readCronSecretFromHeaders**(`req`): `string`

Defined in: [api/\_handlers/agent/\_process.ts:429](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L429)

#### Parameters

##### req

`VercelRequest`

#### Returns

`string`

***

### readStrictUnsupportedRetryEnabled()

> **readStrictUnsupportedRetryEnabled**(`raw`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:97](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L97)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`boolean`

***

### resolveAgentProcessXmtpPersistenceError()

> **resolveAgentProcessXmtpPersistenceError**(`input`): `string` \| `null`

Defined in: [api/\_handlers/agent/\_process.ts:119](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L119)

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

Defined in: [api/\_handlers/agent/\_process.ts:247](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L247)

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

Defined in: [api/\_handlers/agent/\_process.ts:270](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L270)

#### Parameters

##### params

###### fallbackGenerated

`boolean`

###### strictUnsupportedRetry

`boolean`

#### Returns

`boolean`
