[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/auth/canonicalization

# src/lib/auth/canonicalization

## Type Aliases

### CanonicalizationResult

> **CanonicalizationResult** = `object`

Defined in: [src/lib/auth/canonicalization.ts:19](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/canonicalization.ts#L19)

#### Properties

##### flags

> **flags**: `object`

Defined in: [src/lib/auth/canonicalization.ts:23](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/canonicalization.ts#L23)

###### baseAppUrl

> **baseAppUrl**: `string` \| `null`

###### needsBaseAppSetup

> **needsBaseAppSetup**: `boolean`

###### needsEmbeddedWallet

> **needsEmbeddedWallet**: `boolean`

##### onboarding

> **onboarding**: `OnboardingBootstrapResponse` \| `null`

Defined in: [src/lib/auth/canonicalization.ts:22](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/canonicalization.ts#L22)

##### onboardingBootstrapped

> **onboardingBootstrapped**: `boolean`

Defined in: [src/lib/auth/canonicalization.ts:21](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/canonicalization.ts#L21)

##### privySynced

> **privySynced**: `boolean`

Defined in: [src/lib/auth/canonicalization.ts:20](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/canonicalization.ts#L20)

## Functions

### runCanonicalizationPipeline()

> **runCanonicalizationPipeline**(`params`): `Promise`\<[`CanonicalizationResult`](#canonicalizationresult)\>

Defined in: [src/lib/auth/canonicalization.ts:69](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/auth/canonicalization.ts#L69)

#### Parameters

##### params

`CanonicalizationParams`

#### Returns

`Promise`\<[`CanonicalizationResult`](#canonicalizationresult)\>
