[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useWaitlistBootstrap

# src/features/waitlist/useWaitlistBootstrap

## Functions

### useWaitlistBootstrap()

> **useWaitlistBootstrap**(`params`): `object`

Defined in: [src/features/waitlist/useWaitlistBootstrap.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useWaitlistBootstrap.ts#L39)

#### Parameters

##### params

`UseWaitlistBootstrapParams`

#### Returns

`object`

##### recoveryRequiredBootstrapCooldownUntilRef

> **recoveryRequiredBootstrapCooldownUntilRef**: `RefObject`\<`number`\>

##### requestBootstrap()

> **requestBootstrap**: (`opts?`) => `Promise`\<[`AccountSetupMe`](../accountSetup/types.md#accountsetupme) \| `null`\>

###### Parameters

###### opts?

###### bypassRecoveryCooldown?

`boolean`

###### forceNew?

`boolean`

###### waitForTokenHydration?

`boolean`

###### Returns

`Promise`\<[`AccountSetupMe`](../accountSetup/types.md#accountsetupme) \| `null`\>

##### resetBootstrapCooldowns()

> **resetBootstrapCooldowns**: () => `void`

###### Returns

`void`

##### settleBootstrapAfterRecoverableLoginError()

> **settleBootstrapAfterRecoverableLoginError**: (`opts?`) => `Promise`\<[`AccountSetupMe`](../accountSetup/types.md#accountsetupme)\>

###### Parameters

###### opts?

###### bypassRecoveryCooldown?

`boolean`

###### Returns

`Promise`\<[`AccountSetupMe`](../accountSetup/types.md#accountsetupme)\>

##### tokenlessFinalizingBootstrapCooldownUntilRef

> **tokenlessFinalizingBootstrapCooldownUntilRef**: `RefObject`\<`number`\>
