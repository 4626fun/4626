[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/agent/\_process

# api/\_handlers/agent/\_process

## Variables

### DEFAULT\_CHECKPOINT\_WINDOW\_MS

> `const` **DEFAULT\_CHECKPOINT\_WINDOW\_MS**: `120000` = `120_000`

Defined in: [api/\_handlers/agent/\_process.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L57)

***

### MAX\_MESSAGES\_PER\_CONVERSATION

> `const` **MAX\_MESSAGES\_PER\_CONVERSATION**: `50` = `50`

Defined in: [api/\_handlers/agent/\_process.ts:56](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L56)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse`\>

Defined in: [api/\_handlers/agent/\_process.ts:470](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L470)

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

Defined in: [api/\_handlers/agent/\_process.ts:164](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L164)

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

Defined in: [api/\_handlers/agent/\_process.ts:192](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L192)

#### Parameters

##### state

`any`

#### Returns

`string` \| `null`

***

### getInitialConversationCheckpointMs()

> **getInitialConversationCheckpointMs**(`lastProcessedAt`, `nowMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:172](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L172)

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

Defined in: [api/\_handlers/agent/\_process.ts:178](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L178)

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

Defined in: [api/\_handlers/agent/\_process.ts:112](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L112)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`boolean`

***

### isAuthorized()

> **isAuthorized**(`req`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:443](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L443)

#### Parameters

##### req

`VercelRequest`

#### Returns

`boolean`

***

### mergeCheckpointMs()

> **mergeCheckpointMs**(`previousMs`, `candidateMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:204](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L204)

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

Defined in: [api/\_handlers/agent/\_process.ts:280](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L280)

#### Parameters

##### rows

`Record`\<`string`, `unknown`\>[]

#### Returns

`Map`\<`string`, `number`\>

***

### readAgentProcessRequirePersistentDb()

> **readAgentProcessRequirePersistentDb**(`raw`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:106](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L106)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`boolean`

***

### readCronSecretFromHeaders()

> **readCronSecretFromHeaders**(`req`): `string`

Defined in: [api/\_handlers/agent/\_process.ts:432](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L432)

#### Parameters

##### req

`VercelRequest`

#### Returns

`string`

***

### readStrictUnsupportedRetryEnabled()

> **readStrictUnsupportedRetryEnabled**(`raw`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:100](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L100)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`boolean`

***

### resolveAgentProcessXmtpPersistenceError()

> **resolveAgentProcessXmtpPersistenceError**(`input`): `string` \| `null`

Defined in: [api/\_handlers/agent/\_process.ts:122](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L122)

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

Defined in: [api/\_handlers/agent/\_process.ts:250](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L250)

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

Defined in: [api/\_handlers/agent/\_process.ts:273](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/agent/_process.ts#L273)

#### Parameters

##### params

###### fallbackGenerated

`boolean`

###### strictUnsupportedRetry

`boolean`

#### Returns

`boolean`
