[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onchain/solanaOvaultCompatibility

# server/\_lib/onchain/solanaOvaultCompatibility

## Type Aliases

### SolanaAdapterMode

> **SolanaAdapterMode** = `"regular-oft"` \| `"oft-adapter"`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:3](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L3)

***

### SolanaAssetMintOrigin

> **SolanaAssetMintOrigin** = `"existing"` \| `"new"`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:1](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L1)

***

### SolanaOvaultEligibility

> **SolanaOvaultEligibility** = `object`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:27](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L27)

#### Properties

##### depositEligible

> **depositEligible**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:29](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L29)

##### existingMintCompatible

> **existingMintCompatible**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:28](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L28)

##### mintCompatibility

> **mintCompatibility**: [`SolanaOvaultMintCompatibility`](#solanaovaultmintcompatibility)

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:31](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L31)

##### redeemEligible

> **redeemEligible**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:30](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L30)

***

### SolanaOvaultMintCompatibility

> **SolanaOvaultMintCompatibility** = `object`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:14](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L14)

#### Properties

##### adapterModeDisallowed

> **adapterModeDisallowed**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:20](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L20)

##### assetMintOrigin

> **assetMintOrigin**: [`SolanaAssetMintOrigin`](#solanaassetmintorigin)

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L15)

##### authorityCompatible

> **authorityCompatible**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:22](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L22)

##### blockers

> **blockers**: `string`[]

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:24](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L24)

##### checksRequired

> **checksRequired**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L16)

##### oftFeeIsZero

> **oftFeeIsZero**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:21](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L21)

##### programSupported

> **programSupported**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L17)

##### regularOftMode

> **regularOftMode**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L19)

##### rentValueLamports

> **rentValueLamports**: `string` \| `null`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:23](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L23)

##### transferHookDetected

> **transferHookDetected**: `boolean`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L18)

***

### SolanaOvaultMintCompatibilityHints

> **SolanaOvaultMintCompatibilityHints** = `object`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:5](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L5)

#### Properties

##### adapterMode

> **adapterMode**: [`SolanaAdapterMode`](#solanaadaptermode) \| `null`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L9)

##### authorityCompatible

> **authorityCompatible**: `boolean` \| `null`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:10](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L10)

##### oftFeeBps

> **oftFeeBps**: `number` \| `null`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L8)

##### rentValueLamports

> **rentValueLamports**: `string` \| `null`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L11)

##### tokenProgram

> **tokenProgram**: [`SolanaTokenProgram`](#solanatokenprogram) \| `null`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:6](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L6)

##### transferHookDetected

> **transferHookDetected**: `boolean` \| `null`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L7)

***

### SolanaTokenProgram

> **SolanaTokenProgram** = `"spl-token"` \| `"token-2022"`

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:2](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L2)

## Functions

### evaluateSolanaOvaultMintCompatibility()

> **evaluateSolanaOvaultMintCompatibility**(`params`): [`SolanaOvaultEligibility`](#solanaovaulteligibility)

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:133](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L133)

#### Parameters

##### params

###### assetMintOrigin

[`SolanaAssetMintOrigin`](#solanaassetmintorigin)

###### hints

[`SolanaOvaultMintCompatibilityHints`](#solanaovaultmintcompatibilityhints)

###### requireHintsForExisting

`boolean`

###### routeReady

`boolean` \| `null`

#### Returns

[`SolanaOvaultEligibility`](#solanaovaulteligibility)

***

### normalizeSolanaAssetMintOrigin()

> **normalizeSolanaAssetMintOrigin**(`value`, `fallback`): [`SolanaAssetMintOrigin`](#solanaassetmintorigin)

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:94](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L94)

#### Parameters

##### value

`unknown`

##### fallback

[`SolanaAssetMintOrigin`](#solanaassetmintorigin) = `'new'`

#### Returns

[`SolanaAssetMintOrigin`](#solanaassetmintorigin)

***

### parseSolanaOvaultMintCompatibilityHints()

> **parseSolanaOvaultMintCompatibilityHints**(`value`): [`SolanaOvaultMintCompatibilityHints`](#solanaovaultmintcompatibilityhints)

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:105](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L105)

#### Parameters

##### value

`unknown`

#### Returns

[`SolanaOvaultMintCompatibilityHints`](#solanaovaultmintcompatibilityhints)

***

### readSolanaOvaultMintCompatibilityHintsFromEnv()

> **readSolanaOvaultMintCompatibilityHintsFromEnv**(): [`SolanaOvaultMintCompatibilityHints`](#solanaovaultmintcompatibilityhints)

Defined in: [server/\_lib/onchain/solanaOvaultCompatibility.ts:122](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/onchain/solanaOvaultCompatibility.ts#L122)

#### Returns

[`SolanaOvaultMintCompatibilityHints`](#solanaovaultmintcompatibilityhints)
