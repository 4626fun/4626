[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistAccountTypes

# src/features/waitlist/waitlistAccountTypes

## Type Aliases

### WaitlistAccountsSummary

> **WaitlistAccountsSummary** = [`AccountSetupMe`](../accountSetup/types.md#accountsetupme)

Defined in: [src/features/waitlist/waitlistAccountTypes.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistAccountTypes.ts#L3)

***

### WaitlistBootstrapResponse

> **WaitlistBootstrapResponse** = \{ `email`: `string` \| `null`; `requiresPrivyAuth`: `true`; `waitlistEntryId`: `number` \| `null`; \} \| `object` & [`WaitlistAccountsSummary`](#waitlistaccountssummary)

Defined in: [src/features/waitlist/waitlistAccountTypes.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistAccountTypes.ts#L5)

## Functions

### getSubAccountCompletionAccountKey()

> **getSubAccountCompletionAccountKey**(`account`): `string` \| `null`

Defined in: [src/features/waitlist/waitlistAccountTypes.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistAccountTypes.ts#L15)

#### Parameters

##### account

`Pick`\<[`AccountSetupMe`](../accountSetup/types.md#accountsetupme), `"email"` \| `"privyUserId"`\> | `null`

#### Returns

`string` \| `null`
