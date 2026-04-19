[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/identityRecovery

# server/\_lib/identity/identityRecovery

## Type Aliases

### IdentityRecoveryRequiredError

> **IdentityRecoveryRequiredError** = `Error` & `object` & \{ `email`: `string`; `existingPrivyUserId`: `string`; `reason`: `"EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER"`; `source`: `EmailCollisionSource`; \} \| \{ `canonicalEmail`: `string`; `canonicalProfileId`: `number`; `reason`: `"WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE"`; `wallet`: `string`; \}

Defined in: [server/\_lib/identity/identityRecovery.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/identityRecovery.ts#L7)

#### Type Declaration

##### code

> **code**: `"IDENTITY_RECOVERY_REQUIRED"`

##### requestedPrivyUserId

> **requestedPrivyUserId**: `string`

## Functions

### assertNoEmailPrivyCollision()

> **assertNoEmailPrivyCollision**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/identityRecovery.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/identityRecovery.ts#L118)

#### Parameters

##### params

###### db

`Db`

###### email

`string` \| `null` \| `undefined`

###### privyUserId

`string` \| `null` \| `undefined`

#### Returns

`Promise`\<`void`\>

***

### assertNoWalletPrivyCollision()

> **assertNoWalletPrivyCollision**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/identityRecovery.ts:168](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/identityRecovery.ts#L168)

Block wallet-only Privy sign-ins that would otherwise mint a fragmented
profile for a human whose canonical account (verified email) already
exists. This is the prevention counterpart to `assertNoEmailPrivyCollision`:
that one catches "same email, different Privy user", this one catches
"same EOA, no email on incoming, canonical email profile already owns
that EOA."

Runs even when the incoming Privy user has an email (in which case
`assertNoEmailPrivyCollision` does the primary check); for the email-
less case this is the ONLY guard against split-identity creation.

No-op when:
  - the incoming Privy user id is already aliased to the canonical
    profile (expected re-auth after a prior merge),
  - the incoming Privy user has no EVM wallets (nothing to collide),
  - `privy_user_aliases` table does not exist yet (legacy envs — in
    that case we can't safely distinguish expected re-auth from
    fragmentation, so we err on the side of not blocking).

#### Parameters

##### params

###### db

`Db`

###### evmAddresses?

readonly `string`[]

###### privyUser?

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

Provide exactly one source of EVM addresses: a raw Privy user (we
 extract via `classifyLinkedAccounts`), or a pre-computed list. The
 pre-computed form lets callers like `walletSync` skip the re-parse.

###### privyUserId

`string`

#### Returns

`Promise`\<`void`\>

***

### isIdentityRecoveryRequiredError()

> **isIdentityRecoveryRequiredError**(`error`): `error is IdentityRecoveryRequiredError`

Defined in: [server/\_lib/identity/identityRecovery.ts:272](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/identityRecovery.ts#L272)

#### Parameters

##### error

`unknown`

#### Returns

`error is IdentityRecoveryRequiredError`
