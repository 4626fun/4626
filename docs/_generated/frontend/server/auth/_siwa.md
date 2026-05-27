[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/auth/\_siwa

# server/auth/\_siwa

## Functions

### consumeSiwaNonce()

> **consumeSiwaNonce**(`db`, `params`): `Promise`\<\{ `ownerAddress`: `string`; \} \| `null`\>

Defined in: [server/auth/\_siwa.ts:218](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L218)

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

Defined in: [server/auth/\_siwa.ts:114](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L114)

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

Defined in: [server/auth/\_siwa.ts:123](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L123)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### getSiwaReceiptSecret()

> **getSiwaReceiptSecret**(): `string` \| `null`

Defined in: [server/auth/\_siwa.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L81)

M-20 (4626-329) remediation. Returns the SIWA receipt HMAC key, or
null if it is not configured. The previous implementation fell back
to AUTH_SESSION_SECRET when @buildersgarden/siwa's resolveReceiptSecret
threw, which silently reused the user-session signing key to sign
agent-identity receipts. That merged two security boundaries — a
compromise of AUTH_SESSION_SECRET would have let an attacker forge
agent receipts even though that secret is only supposed to sign
user session cookies.

New contract:
  - Prefer an explicit SIWA_RECEIPT_SECRET env var.
  - Otherwise, delegate to resolveReceiptSecret() from the library.
  - If neither is present, return null. No silent AUTH_SESSION_SECRET
    fallback. Upstream handlers already treat null as a 503, which is
    the correct behavior for a missing machine-to-machine secret.

Key-separation is also enforced defensively: if an operator sets
SIWA_RECEIPT_SECRET to the same value as AUTH_SESSION_SECRET, we
return null so the misconfiguration surfaces immediately rather than
leaving the security boundary collapsed.

#### Returns

`string` \| `null`

***

### isAddressLike()

> **isAddressLike**(`value`): `boolean`

Defined in: [server/auth/\_siwa.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L14)

#### Parameters

##### value

`string`

#### Returns

`boolean`

***

### parseAgentRegistryRef()

> **parseAgentRegistryRef**(`value`): \{ `chainId`: `number`; `registryAddress`: `string`; \} \| `null`

Defined in: [server/auth/\_siwa.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L18)

#### Parameters

##### value

`string`

#### Returns

\{ `chainId`: `number`; `registryAddress`: `string`; \} \| `null`

***

### parseSiwaMessageSafe()

> **parseSiwaMessageSafe**(`message`): `SIWAMessageFields` \| `null`

Defined in: [server/auth/\_siwa.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L28)

#### Parameters

##### message

`string`

#### Returns

`SIWAMessageFields` \| `null`

***

### readSiwaAgentFromRequest()

> **readSiwaAgentFromRequest**(`req`): `ReceiptPayload` \| `null`

Defined in: [server/auth/\_siwa.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L106)

#### Parameters

##### req

`VercelRequest`

#### Returns

`ReceiptPayload` \| `null`

***

### readSiwaReceiptFromRequest()

> **readSiwaReceiptFromRequest**(`req`): `string` \| `null`

Defined in: [server/auth/\_siwa.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L41)

#### Parameters

##### req

`VercelRequest`

#### Returns

`string` \| `null`

***

### storeSiwaNonce()

> **storeSiwaNonce**(`db`, `params`): `Promise`\<`void`\>

Defined in: [server/auth/\_siwa.ts:179](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_siwa.ts#L179)

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
