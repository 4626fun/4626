[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistBootstrapUtils

# src/features/waitlist/waitlistBootstrapUtils

## Variables

### FINALIZING\_BACKGROUND\_RETRY\_MAX\_ATTEMPTS

> `const` **FINALIZING\_BACKGROUND\_RETRY\_MAX\_ATTEMPTS**: `5` = `5`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L13)

***

### FINALIZING\_BACKGROUND\_RETRY\_MS

> `const` **FINALIZING\_BACKGROUND\_RETRY\_MS**: `1500` = `1_500`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L12)

***

### FLOW\_TIMEOUT\_MS

> `const` **FLOW\_TIMEOUT\_MS**: `20000` = `20_000`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L9)

***

### PRIVY\_LOGOUT\_SETTLE\_ATTEMPTS

> `const` **PRIVY\_LOGOUT\_SETTLE\_ATTEMPTS**: `10` = `10`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L14)

***

### PRIVY\_LOGOUT\_SETTLE\_DELAY\_MS

> `const` **PRIVY\_LOGOUT\_SETTLE\_DELAY\_MS**: `150` = `150`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L15)

***

### RECOVERY\_REQUIRED\_BOOTSTRAP\_COOLDOWN\_MS

> `const` **RECOVERY\_REQUIRED\_BOOTSTRAP\_COOLDOWN\_MS**: `15000` = `15_000`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L11)

***

### RECOVERY\_REQUIRED\_MESSAGE

> `const` **RECOVERY\_REQUIRED\_MESSAGE**: `"This email already has a 4626 account. Use existing account sign-in to continue."` = `'This email already has a 4626 account. Use existing account sign-in to continue.'`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L1)

***

### SESSION\_FINALIZING\_RETRY\_MESSAGE

> `const` **SESSION\_FINALIZING\_RETRY\_MESSAGE**: `"Sign-in session is still finalizing. We will keep retrying automatically."` = `'Sign-in session is still finalizing. We will keep retrying automatically.'`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L4)

***

### SESSION\_MISMATCH\_MESSAGE

> `const` **SESSION\_MISMATCH\_MESSAGE**: `"Signed in as a different account. Click Continue with email to try again."` = `'Signed in as a different account. Click Continue with email to try again.'`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L3)

***

### STALE\_PRIVY\_SESSION\_MESSAGE

> `const` **STALE\_PRIVY\_SESSION\_MESSAGE**: `"Sign-in got stuck in an old session. Tap Continue to retry with a fresh email sign-in."` = `'Sign-in got stuck in an old session. Tap Continue to retry with a fresh email sign-in.'`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L6)

***

### TOKENLESS\_FINALIZING\_BOOTSTRAP\_COOLDOWN\_MS

> `const` **TOKENLESS\_FINALIZING\_BOOTSTRAP\_COOLDOWN\_MS**: `2500` = `2_500`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L10)

## Functions

### getWalletProviderCollisionMessage()

> **getWalletProviderCollisionMessage**(): `string`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L61)

#### Returns

`string`

***

### isSessionFinalizingError()

> **isSessionFinalizingError**(`error`): `boolean`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L35)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isWalletProviderCollisionError()

> **isWalletProviderCollisionError**(`error`): `boolean`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L45)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### readApiErrorMessage()

> **readApiErrorMessage**(`payload`, `fallback`): `string`

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L27)

#### Parameters

##### payload

`unknown`

##### fallback

`string`

#### Returns

`string`

***

### withTimeout()

> **withTimeout**\<`T`\>(`promise`, `ms`, `label`): `Promise`\<`T`\>

Defined in: [src/features/waitlist/waitlistBootstrapUtils.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistBootstrapUtils.ts#L17)

#### Type Parameters

##### T

`T`

#### Parameters

##### promise

`Promise`\<`T`\>

##### ms

`number`

##### label

`string`

#### Returns

`Promise`\<`T`\>
