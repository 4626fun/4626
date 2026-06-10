[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/auth/canonicalization

# src/lib/auth/canonicalization

## Type Aliases

### CanonicalizationResult

> **CanonicalizationResult** = `object`

Defined in: [src/lib/auth/canonicalization.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/canonicalization.ts#L19)

#### Properties

##### flags

> **flags**: `CanonicalizationFlags`

Defined in: [src/lib/auth/canonicalization.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/canonicalization.ts#L23)

##### onboarding

> **onboarding**: `OnboardingBootstrapResponse` \| `null`

Defined in: [src/lib/auth/canonicalization.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/canonicalization.ts#L22)

##### onboardingBootstrapped

> **onboardingBootstrapped**: `boolean`

Defined in: [src/lib/auth/canonicalization.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/canonicalization.ts#L21)

##### privySynced

> **privySynced**: `boolean`

Defined in: [src/lib/auth/canonicalization.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/canonicalization.ts#L20)

## Functions

### runCanonicalizationPipeline()

> **runCanonicalizationPipeline**(`params`): `Promise`\<[`CanonicalizationResult`](#canonicalizationresult)\>

Defined in: [src/lib/auth/canonicalization.ts:125](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/canonicalization.ts#L125)

#### Parameters

##### params

`CanonicalizationParams`

#### Returns

`Promise`\<[`CanonicalizationResult`](#canonicalizationresult)\>
