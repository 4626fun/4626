[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/wallet/canonicalStateMachine

# src/wallet/canonicalStateMachine

## Type Aliases

### CanonicalMachineCommand

> **CanonicalMachineCommand** = \{ `type`: `"RUN_PRIVY_SYNC"`; \} \| \{ `type`: `"RESOLVE_CANONICAL_FROM_SERVER"`; `userId`: `string`; \} \| \{ `reason`: `"auth"` \| `"zora"`; `type`: `"REFRESH_ACCOUNT_PAYLOAD"`; `userId`: `string`; \} \| \{ `type`: `"CHECK_OWNER_DELEGATION"`; `userId`: `string`; \} \| \{ `type`: `"FORCE_RECOVERY_LINK_FLOW"`; \}

Defined in: [src/wallet/canonicalStateMachine.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L24)

***

### CanonicalMachineContext

> **CanonicalMachineContext** = `object`

Defined in: [src/wallet/canonicalStateMachine.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L9)

#### Properties

##### appAccessStatus

> **appAccessStatus**: `string` \| `null`

Defined in: [src/wallet/canonicalStateMachine.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L13)

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/wallet/canonicalStateMachine.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L11)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string` \| `null`

Defined in: [src/wallet/canonicalStateMachine.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L12)

##### ownerDelegationVerified

> **ownerDelegationVerified**: `boolean` \| `null`

Defined in: [src/wallet/canonicalStateMachine.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L16)

##### tier

> **tier**: `number`

Defined in: [src/wallet/canonicalStateMachine.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L14)

##### userId

> **userId**: `string` \| `null`

Defined in: [src/wallet/canonicalStateMachine.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L10)

##### zoraResolved

> **zoraResolved**: `boolean`

Defined in: [src/wallet/canonicalStateMachine.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L15)

***

### CanonicalMachineEvent

> **CanonicalMachineEvent** = \{ `source`: `"desktop"` \| `"telegram"` \| `"wallet"` \| `"zora_deep_link"`; `type`: `"START_AUTH"`; \} \| \{ `type`: `"PRIVY_AUTH_SUCCESS"`; `userId`: `string`; \} \| \{ `type`: `"PRIVY_AUTH_FAILED"`; \} \| \{ `canonicalCswAddress`: `string`; `embeddedEoaAddress`: `string` \| `null`; `type`: `"CANONICAL_CSW_RESOLVED_FROM_SERVER"`; \} \| \{ `appAccessStatus`: `string` \| `null`; `tier`: `number`; `type`: `"ACCOUNT_PAYLOAD_REFRESHED"`; \} \| \{ `type`: `"ZORA_MINT_COMPLETE"`; \} \| \{ `type`: `"BEFORE_SIGNER_ACTION"`; \} \| \{ `type`: `"OWNER_DELEGATION_VERIFIED"`; \} \| \{ `type`: `"OWNER_DELEGATION_FAILED"`; \} \| \{ `type`: `"AMBIGUOUS_MERGE_DETECTED"`; \} \| \{ `type`: `"RECOVERY_COMPLETED"`; \}

Defined in: [src/wallet/canonicalStateMachine.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L31)

***

### CanonicalMachineSnapshot

> **CanonicalMachineSnapshot** = `object`

Defined in: [src/wallet/canonicalStateMachine.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L19)

#### Properties

##### context

> **context**: [`CanonicalMachineContext`](#canonicalmachinecontext)

Defined in: [src/wallet/canonicalStateMachine.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L21)

##### state

> **state**: [`CanonicalMachineState`](#canonicalmachinestate)

Defined in: [src/wallet/canonicalStateMachine.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L20)

***

### CanonicalMachineState

> **CanonicalMachineState** = `"unauthenticated"` \| `"authenticating"` \| `"canonicalizing"` \| `"onboarding"` \| `"ready"` \| `"recovery_required"`

Defined in: [src/wallet/canonicalStateMachine.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L1)

***

### CanonicalMachineTransition

> **CanonicalMachineTransition** = `object`

Defined in: [src/wallet/canonicalStateMachine.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L44)

#### Properties

##### commands

> **commands**: [`CanonicalMachineCommand`](#canonicalmachinecommand)[]

Defined in: [src/wallet/canonicalStateMachine.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L46)

##### snapshot

> **snapshot**: [`CanonicalMachineSnapshot`](#canonicalmachinesnapshot)

Defined in: [src/wallet/canonicalStateMachine.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L45)

## Functions

### createCanonicalMachineSnapshot()

> **createCanonicalMachineSnapshot**(): [`CanonicalMachineSnapshot`](#canonicalmachinesnapshot)

Defined in: [src/wallet/canonicalStateMachine.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L73)

#### Returns

[`CanonicalMachineSnapshot`](#canonicalmachinesnapshot)

***

### reduceCanonicalMachine()

> **reduceCanonicalMachine**(`snapshot`, `event`): [`CanonicalMachineTransition`](#canonicalmachinetransition)

Defined in: [src/wallet/canonicalStateMachine.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalStateMachine.ts#L88)

#### Parameters

##### snapshot

[`CanonicalMachineSnapshot`](#canonicalmachinesnapshot)

##### event

[`CanonicalMachineEvent`](#canonicalmachineevent)

#### Returns

[`CanonicalMachineTransition`](#canonicalmachinetransition)
