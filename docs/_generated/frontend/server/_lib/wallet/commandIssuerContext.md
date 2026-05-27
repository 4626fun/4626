[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/commandIssuerContext

# server/\_lib/wallet/commandIssuerContext

## Type Aliases

### CommandIssuerContext

> **CommandIssuerContext** = `object`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L84)

#### Properties

##### capsVersion

> **capsVersion**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L91)

##### dailyCapWei

> **dailyCapWei**: `bigint`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L93)

##### ownerEoa

> **ownerEoa**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L88)

##### ownerIndex

> **ownerIndex**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L89)

##### paymasterPolicy

> **paymasterPolicy**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L90)

##### perTxCapWei

> **perTxCapWei**: `bigint`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L92)

##### privyOwnerWalletId

> **privyOwnerWalletId**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L87)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L85)

##### provisionedAt

> **provisionedAt**: `Date`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:94](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L94)

##### revokedAt

> **revokedAt**: `Date` \| `null`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L95)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L86)

##### subAccount

> **subAccount**: [`CommandIssuerSubAccount`](#commandissuersubaccount) \| `null`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:96](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L96)

***

### CommandIssuerResolution

> **CommandIssuerResolution** = \{ `context`: [`CommandIssuerContext`](#commandissuercontext); `status`: `"ready"`; \} \| \{ `profileId`: `number` \| `null`; `status`: `"not_provisioned"`; \} \| \{ `profileId`: `number`; `reason`: `string` \| `null`; `revokedAt`: `Date`; `status`: `"revoked"`; \} \| \{ `status`: `"db_unavailable"`; \}

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L99)

***

### CommandIssuerSubAccount

> **CommandIssuerSubAccount** = `object`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:70](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L70)

#### Properties

##### parentCswAddress

> **parentCswAddress**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L72)

##### spendPermission

> **spendPermission**: `object`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:73](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L73)

###### allowanceWei

> **allowanceWei**: `bigint`

###### endAt

> **endAt**: `Date`

###### hash

> **hash**: `` `0x${string}` ``

###### payload

> **payload**: [`SpendPermissionPayload`](#spendpermissionpayload)

###### periodSeconds

> **periodSeconds**: `number`

###### revokedAt

> **revokedAt**: `Date` \| `null`

###### signature

> **signature**: `` `0x${string}` ``

##### subAccountAddress

> **subAccountAddress**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L71)

***

### ExecutionReadiness

> **ExecutionReadiness** = `"ready"` \| `"not_provisioned"` \| `"revoked"` \| `"db_unavailable"`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L51)

***

### ProvisionSubAccountInput

> **ProvisionSubAccountInput** = `object`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:401](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L401)

Provision (or re-provision) an execution context for a profile.
Called only from admin surfaces — never from the hot path.

#### Properties

##### parentCswAddress

> **parentCswAddress**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:403](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L403)

##### spendPermission

> **spendPermission**: `object`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:404](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L404)

###### allowanceWei

> **allowanceWei**: `bigint`

###### endAt

> **endAt**: `Date`

###### hash

> **hash**: `` `0x${string}` ``

###### payload

> **payload**: [`SpendPermissionPayload`](#spendpermissionpayload)

###### periodSeconds

> **periodSeconds**: `number`

###### signature

> **signature**: `` `0x${string}` ``

##### subAccountAddress

> **subAccountAddress**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:402](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L402)

***

### SpendPermissionPayload

> **SpendPermissionPayload** = `object`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L58)

EIP-712 SpendPermission payload shape, exactly matching the
`SpendPermissionManager` struct on Base mainnet. Bigints are serialized as
decimal strings for JSONB-round-trip safety.

#### Properties

##### account

> **account**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L59)

##### allowance

> **allowance**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L62)

##### end

> **end**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L65)

##### extraData

> **extraData**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L67)

##### period

> **period**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L63)

##### salt

> **salt**: `string`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L66)

##### spender

> **spender**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L60)

##### start

> **start**: `number`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L64)

##### token

> **token**: `Address`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L61)

## Functions

### envBigInt()

> **envBigInt**(`key`, `fallback`): `bigint`

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L40)

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

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:391](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L391)

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

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:414](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L414)

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

###### subAccount?

[`ProvisionSubAccountInput`](#provisionsubaccountinput) \| `null`

#### Returns

`Promise`\<\{ `context`: [`CommandIssuerContext`](#commandissuercontext); `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

***

### provisionSubAccountSpendPermission()

> **provisionSubAccountSpendPermission**(`params`): `Promise`\<\{ `context`: [`CommandIssuerContext`](#commandissuercontext); `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:549](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L549)

Update just the sub-account columns on an existing execution-context row.
Used by PR-B's provisioning endpoint after the parent-signed SpendPermission
has been verified. Fails if no row exists for the profile (no implicit
create — caller must provision the base context first).

#### Parameters

##### params

###### parentCswAddress

`string`

###### profileId

`number`

###### spendPermission

\{ `allowanceWei`: `bigint`; `endAt`: `Date`; `hash`: `` `0x${string}` ``; `payload`: [`SpendPermissionPayload`](#spendpermissionpayload); `periodSeconds`: `number`; `signature`: `` `0x${string}` ``; \}

###### spendPermission.allowanceWei

`bigint`

###### spendPermission.endAt

`Date`

###### spendPermission.hash

`` `0x${string}` ``

###### spendPermission.payload

[`SpendPermissionPayload`](#spendpermissionpayload)

###### spendPermission.periodSeconds

`number`

###### spendPermission.signature

`` `0x${string}` ``

###### subAccountAddress

`string`

#### Returns

`Promise`\<\{ `context`: [`CommandIssuerContext`](#commandissuercontext); `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

***

### readIssuerDailySpend()

> **readIssuerDailySpend**(`profileId`): `Promise`\<`bigint`\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:796](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L796)

Read today's spend total without mutation. Used for preflight cap checks.

#### Parameters

##### profileId

`number`

#### Returns

`Promise`\<`bigint`\>

***

### recordIssuerDailySpend()

> **recordIssuerDailySpend**(`params`): `Promise`\<\{ `newTotalWei`: `bigint`; `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:727](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L727)

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

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:282](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L282)

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

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:337](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L337)

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

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:626](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L626)

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

### revokeSubAccountSpendPermission()

> **revokeSubAccountSpendPermission**(`params`): `Promise`\<\{ `alreadyRevoked`: `boolean`; `ok`: `true`; \} \| \{ `error`: `"not_provisioned"` \| `"db_unavailable"` \| `"db_write_failed"` \| `"context_row_missing"`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:669](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L669)

Revoke JUST the sub-account spend permission on a context row.

Distinct from `revokeCommandIssuerContext` above, which revokes the
entire context (kills delegation + execution + sub-account together).
This narrower revoke lets users turn off bot-initiated spending of
their parent CSW's funds while keeping the Privy delegation and
sub-account intact — they can re-provision a new spend permission
later without re-enrolling Privy.

Only flips `spend_permission_revoked_at`. The submitter preflight
rejects any UserOp whose issuer context has this column set, which
is what actually stops in-chat commands from debiting the parent.

Returns 'not_provisioned' if the row exists but has no sub-account,
or 'context_row_missing' if there's no row at all.

#### Parameters

##### params

###### profileId

`number`

#### Returns

`Promise`\<\{ `alreadyRevoked`: `boolean`; `ok`: `true`; \} \| \{ `error`: `"not_provisioned"` \| `"db_unavailable"` \| `"db_write_failed"` \| `"context_row_missing"`; `ok`: `false`; \}\>

***

### rollbackIssuerDailySpend()

> **rollbackIssuerDailySpend**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/commandIssuerContext.ts:764](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/commandIssuerContext.ts#L764)

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
