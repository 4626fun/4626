[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onboarding/waitlistPreprovision

# server/\_lib/onboarding/waitlistPreprovision

## Type Aliases

### PreprovisionResult

> **PreprovisionResult** = `object`

Defined in: [server/\_lib/onboarding/waitlistPreprovision.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPreprovision.ts#L93)

#### Properties

##### coinAddress

> **coinAddress**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPreprovision.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPreprovision.ts#L96)

##### coinSymbol

> **coinSymbol**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPreprovision.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPreprovision.ts#L97)

##### serverWalletAddress

> **serverWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPreprovision.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPreprovision.ts#L95)

##### serverWalletId

> **serverWalletId**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPreprovision.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPreprovision.ts#L94)

##### zoraHandle

> **zoraHandle**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPreprovision.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPreprovision.ts#L98)

## Functions

### preprovisionWaitlistUser()

> **preprovisionWaitlistUser**(`signupId`, `walletAddress`): `Promise`\<[`PreprovisionResult`](#preprovisionresult) \| `null`\>

Defined in: [server/\_lib/onboarding/waitlistPreprovision.ts:111](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPreprovision.ts#L111)

Pre-provision a waitlist user. This resolves identities and provisions
a Privy server wallet, then stores the results on the `profiles` row.

This function is safe to call multiple times (idempotent).
It should be called in a fire-and-forget fashion after waitlist signup.

#### Parameters

##### signupId

`number`

The `profiles.id` of the waitlist entry

##### walletAddress

`string`

The user's primary EVM wallet (CSW or EOA)

#### Returns

`Promise`\<[`PreprovisionResult`](#preprovisionresult) \| `null`\>
