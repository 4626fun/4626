[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/identityRecovery

# server/\_lib/identityRecovery

## Type Aliases

### IdentityRecoveryRequiredError

> **IdentityRecoveryRequiredError** = `Error` & `object`

Defined in: [server/\_lib/identityRecovery.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identityRecovery.ts#L5)

#### Type Declaration

##### code

> **code**: `"IDENTITY_RECOVERY_REQUIRED"`

##### email

> **email**: `string`

##### existingPrivyUserId

> **existingPrivyUserId**: `string`

##### reason

> **reason**: `"EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER"`

##### requestedPrivyUserId

> **requestedPrivyUserId**: `string`

##### source

> **source**: `EmailCollisionSource`

## Functions

### assertNoEmailPrivyCollision()

> **assertNoEmailPrivyCollision**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identityRecovery.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identityRecovery.ts#L82)

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

### isIdentityRecoveryRequiredError()

> **isIdentityRecoveryRequiredError**(`error`): `error is IdentityRecoveryRequiredError`

Defined in: [server/\_lib/identityRecovery.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identityRecovery.ts#L112)

#### Parameters

##### error

`unknown`

#### Returns

`error is IdentityRecoveryRequiredError`
