[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / src/features/home/vault-flow/model/flowProfile

# src/features/home/vault-flow/model/flowProfile

## Type Aliases

### FlowProfile

> **FlowProfile** = `"desktop"` \| `"mobile"` \| `"reduced"`

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:6](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L6)

***

### FlowProfileConfig

> **FlowProfileConfig** = `object`

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L8)

#### Properties

##### maxAnimatedSystems

> **maxAnimatedSystems**: `number`

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L15)

##### profile

> **profile**: [`FlowProfile`](#flowprofile)

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L9)

##### quantizedTransitions

> **quantizedTransitions**: `boolean`

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L13)

##### scrollSource

> **scrollSource**: `"continuous"` \| `"section"`

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L11)

## Variables

### FLOW\_PROFILE\_CONFIGS

> `const` **FLOW\_PROFILE\_CONFIGS**: `Record`\<[`FlowProfile`](#flowprofile), [`FlowProfileConfig`](#flowprofileconfig)\>

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L18)

## Functions

### resolveFlowProfile()

> **resolveFlowProfile**(): [`FlowProfile`](#flowprofile)

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:56](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L56)

Resolves the FlowProfile at mount time based on device capabilities.
The resolved profile is stable for the lifetime of the component — no
mid-session profile switching.

#### Returns

[`FlowProfile`](#flowprofile)

***

### useVaultFlowProfile()

> **useVaultFlowProfile**(): [`FlowProfile`](#flowprofile)

Defined in: [src/features/home/vault-flow/model/flowProfile.ts:74](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/flowProfile.ts#L74)

#### Returns

[`FlowProfile`](#flowprofile)
