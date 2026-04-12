[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/auth/\_siwa

# server/auth/\_siwa

## Functions

### consumeSiwaNonce()

> **consumeSiwaNonce**(`db`, `params`): `Promise`\<\{ `ownerAddress`: `string`; \} \| `null`\>

Defined in: [server/auth/\_siwa.ts:183](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L183)

#### Parameters

##### db

`DbWithSql`

##### params

###### agentId

`number`

###### agentRegistry

`string`

###### nonce

`string`

#### Returns

`Promise`\<\{ `ownerAddress`: `string`; \} \| `null`\>

***

### createSiwaReceiptToken()

> **createSiwaReceiptToken**(`payload`, `opts`): `ReceiptResult` \| `null`

Defined in: [server/auth/\_siwa.ts:79](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L79)

#### Parameters

##### payload

`Omit`\<`ReceiptPayload`, `"iat"` \| `"exp"`\>

##### opts

###### ttlMs?

`number`

#### Returns

`ReceiptResult` \| `null`

***

### ensureSiwaNonceSchema()

> **ensureSiwaNonceSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/auth/\_siwa.ts:88](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L88)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### getSiwaReceiptSecret()

> **getSiwaReceiptSecret**(): `string` \| `null`

Defined in: [server/auth/\_siwa.ts:59](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L59)

#### Returns

`string` \| `null`

***

### isAddressLike()

> **isAddressLike**(`value`): `boolean`

Defined in: [server/auth/\_siwa.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L14)

#### Parameters

##### value

`string`

#### Returns

`boolean`

***

### parseAgentRegistryRef()

> **parseAgentRegistryRef**(`value`): \{ `chainId`: `number`; `registryAddress`: `string`; \} \| `null`

Defined in: [server/auth/\_siwa.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L18)

#### Parameters

##### value

`string`

#### Returns

\{ `chainId`: `number`; `registryAddress`: `string`; \} \| `null`

***

### parseSiwaMessageSafe()

> **parseSiwaMessageSafe**(`message`): `SIWAMessageFields` \| `null`

Defined in: [server/auth/\_siwa.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L28)

#### Parameters

##### message

`string`

#### Returns

`SIWAMessageFields` \| `null`

***

### readSiwaAgentFromRequest()

> **readSiwaAgentFromRequest**(`req`): `ReceiptPayload` \| `null`

Defined in: [server/auth/\_siwa.ts:71](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L71)

#### Parameters

##### req

`VercelRequest`

#### Returns

`ReceiptPayload` \| `null`

***

### readSiwaReceiptFromRequest()

> **readSiwaReceiptFromRequest**(`req`): `string` \| `null`

Defined in: [server/auth/\_siwa.ts:41](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L41)

#### Parameters

##### req

`VercelRequest`

#### Returns

`string` \| `null`

***

### storeSiwaNonce()

> **storeSiwaNonce**(`db`, `params`): `Promise`\<`void`\>

Defined in: [server/auth/\_siwa.ts:144](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_siwa.ts#L144)

#### Parameters

##### db

`DbWithSql`

##### params

###### agentId

`number`

###### agentRegistry

`string`

###### createdByAddress?

`string` \| `null`

###### expiresAt

`Date`

###### nonce

`string`

###### ownerAddress

`string`

#### Returns

`Promise`\<`void`\>
