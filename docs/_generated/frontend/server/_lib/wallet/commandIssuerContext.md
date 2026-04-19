[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/commandIssuerContext

# server/\_lib/wallet/commandIssuerContext

## Type Aliases

### CommandIssuerContext

> **CommandIssuerContext** = `object`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:53](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L53)

#### Properties

##### capsVersion

> **capsVersion**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:60](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L60)

##### dailyCapWei

> **dailyCapWei**: `bigint`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:62](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L62)

##### ownerEoa

> **ownerEoa**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L57)

##### ownerIndex

> **ownerIndex**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:58](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L58)

##### paymasterPolicy

> **paymasterPolicy**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:59](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L59)

##### perTxCapWei

> **perTxCapWei**: `bigint`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:61](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L61)

##### privyOwnerWalletId

> **privyOwnerWalletId**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:56](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L56)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:54](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L54)

##### provisionedAt

> **provisionedAt**: `Date`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:63](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L63)

##### revokedAt

> **revokedAt**: `Date` \| `null`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:64](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L64)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:55](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L55)

***

### CommandIssuerResolution

> **CommandIssuerResolution** = \{ `context`: [`CommandIssuerContext`](#commandissuercontext); `status`: `"ready"`; \} \| \{ `profileId`: `number` \| `null`; `status`: `"not_provisioned"`; \} \| \{ `profileId`: `number`; `reason`: `string` \| `null`; `revokedAt`: `Date`; `status`: `"revoked"`; \} \| \{ `status`: `"db_unavailable"`; \}

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:67](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L67)

***

### ExecutionReadiness

> **ExecutionReadiness** = `"ready"` \| `"not_provisioned"` \| `"revoked"` \| `"db_unavailable"`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:51](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L51)

## Functions

### envBigInt()

> **envBigInt**(`key`, `fallback`): `bigint`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:40](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L40)

Read an environment variable as a positive bigint, returning `fallback` if
the variable is absent, empty, non-numeric, or non-positive.
Shared by user-facing arch-b handlers and the admin provisioning endpoint.

#### Parameters

##### key

`string`

##### fallback

`bigint`

#### Returns

`bigint`

***

### isExecutionReady()

> **isExecutionReady**(`resolution`): `resolution is { context: CommandIssuerContext; status: "ready" }`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:190](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L190)

Type-narrow helper: true iff resolution returned a non-revoked, provisioned
context.

#### Parameters

##### resolution

[`CommandIssuerResolution`](#commandissuerresolution)

#### Returns

`resolution is { context: CommandIssuerContext; status: "ready" }`

***

### provisionCommandIssuerContext()

> **provisionCommandIssuerContext**(`params`): `Promise`\<\{ `context`: [`CommandIssuerContext`](#commandissuercontext); `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:200](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L200)

Provision (or re-provision) an execution context for a profile.
Called only from admin surfaces — never from the hot path.

#### Parameters

##### params

###### dailyCapWei

`bigint`

###### ownerEoa

`string`

###### ownerIndex?

`number`

###### paymasterPolicy?

`string`

###### perTxCapWei

`bigint`

###### privyOwnerWalletId

`string`

###### profileId

`number`

###### provisionedBy?

`string` \| `null`

###### smartWallet

`string`

#### Returns

`Promise`\<\{ `context`: [`CommandIssuerContext`](#commandissuercontext); `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

***

### readIssuerDailySpend()

> **readIssuerDailySpend**(`profileId`): `Promise`\<`bigint`\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:378](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L378)

Read today's spend total without mutation. Used for preflight cap checks.

#### Parameters

##### profileId

`number`

#### Returns

`Promise`\<`bigint`\>

***

### recordIssuerDailySpend()

> **recordIssuerDailySpend**(`params`): `Promise`\<\{ `newTotalWei`: `bigint`; `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:309](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L309)

Durable per-profile daily spend: increments today's counter atomically
and returns the new total. Used by the submitter to enforce dailyCapWei
**across vaults**, whereas the legacy `recordDailySpend` in sendCommand.ts
is keyed per vault.

Rollback (decrement) is available via `adjustIssuerDailySpend` with a
negative amount; the CHECK constraint prevents underflow.

#### Parameters

##### params

###### amountWei

`bigint`

###### profileId

`number`

#### Returns

`Promise`\<\{ `newTotalWei`: `bigint`; `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

***

### resolveCommandIssuerContextByAddress()

> **resolveCommandIssuerContextByAddress**(`address`): `Promise`\<[`CommandIssuerResolution`](#commandissuerresolution)\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:101](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L101)

Resolve the execution context for a wallet address that issued a command
(typically `params.senderWallet` in command handlers). The address is
reverse-looked-up to a profile via `profile_wallets`, then the active
`command_issuer_execution_context` row is returned.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`CommandIssuerResolution`](#commandissuerresolution)\>

***

### resolveCommandIssuerContextByProfileId()

> **resolveCommandIssuerContextByProfileId**(`profileId`): `Promise`\<[`CommandIssuerResolution`](#commandissuerresolution)\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:147](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L147)

Resolve execution context directly by profile id (used by admin provisioning
endpoints and tests).

#### Parameters

##### profileId

`number`

#### Returns

`Promise`\<[`CommandIssuerResolution`](#commandissuerresolution)\>

***

### revokeCommandIssuerContext()

> **revokeCommandIssuerContext**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:274](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L274)

Soft-revoke an execution context. The row stays for audit but
`isExecutionReady` returns false after this.

#### Parameters

##### params

###### profileId

`number`

###### reason

`string`

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

***

### rollbackIssuerDailySpend()

> **rollbackIssuerDailySpend**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:346](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/commandIssuerContext.ts#L346)

Roll back a previously-recorded spend (e.g., after a submission failure).
Subtracts `amountWei` from today's counter. Uses GREATEST to prevent
the value from going negative even under unexpected ordering.

#### Parameters

##### params

###### amountWei

`bigint`

###### profileId

`number`

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>
