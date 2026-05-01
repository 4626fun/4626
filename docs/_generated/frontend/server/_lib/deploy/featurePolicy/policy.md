[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / server/\_lib/deploy/featurePolicy/policy

# server/\_lib/deploy/featurePolicy/policy

## Type Aliases

### DeployFeaturePolicy

> **DeployFeaturePolicy** = `object`

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L12)

#### Properties

##### failureCode

> **failureCode**: `string`

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L16)

##### key

> **key**: [`CreatorStrategyFeatureKey`](../../creatorStrategy/catalog.md#creatorstrategyfeaturekey) \| `"deploy_vanity"`

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L13)

##### requiresAnyOf

> **requiresAnyOf**: [`CreatorStrategyFeatureKey`](../../creatorStrategy/catalog.md#creatorstrategyfeaturekey)[]

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L15)

##### stages

> **stages**: (`"create"` \| `"phase2b"` \| `"phase3"` \| `"phase4"`)[]

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L14)

## Variables

### DEPLOY\_FEATURE\_POLICY\_MATRIX

> `const` **DEPLOY\_FEATURE\_POLICY\_MATRIX**: [`DeployFeaturePolicy`](#deployfeaturepolicy)[]

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L19)

## Functions

### hasAnyFeatureActivation()

> **hasAnyFeatureActivation**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L59)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### db

`DbLike`

###### featureKeys

readonly [`CreatorStrategyFeatureKey`](../../creatorStrategy/catalog.md#creatorstrategyfeaturekey)[]

#### Returns

`Promise`\<`boolean`\>

***

### listActiveCreatorFeatureKeys()

> **listActiveCreatorFeatureKeys**(`params`): `Promise`\<[`CreatorStrategyFeatureKey`](../../creatorStrategy/catalog.md#creatorstrategyfeaturekey)[]\>

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L120)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### db

`DbLike`

#### Returns

`Promise`\<[`CreatorStrategyFeatureKey`](../../creatorStrategy/catalog.md#creatorstrategyfeaturekey)[]\>

***

### missingDeployVanityFeatureHints()

> **missingDeployVanityFeatureHints**(`params`): `Promise`\<`string`[]\>

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L74)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### db

`DbLike`

###### shareSuffixRequiredLength

`number` \| `null`

###### vaultPrefixRequiredLength

`number` \| `null`

#### Returns

`Promise`\<`string`[]\>

***

### readPolicyFlagEnabled()

> **readPolicyFlagEnabled**(`envName`, `defaultEnabled`): `boolean`

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L52)

#### Parameters

##### envName

`string`

##### defaultEnabled

`boolean` = `true`

#### Returns

`boolean`

***

### validateFeatureCompatibility()

> **validateFeatureCompatibility**(`activeFeatureKeys`): \{ `ok`: `true`; \} \| \{ `code`: `string`; `message`: `string`; `ok`: `false`; \}

Defined in: [server/\_lib/deploy/featurePolicy/policy.ts:135](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/featurePolicy/policy.ts#L135)

#### Parameters

##### activeFeatureKeys

readonly [`CreatorStrategyFeatureKey`](../../creatorStrategy/catalog.md#creatorstrategyfeaturekey)[]

#### Returns

\{ `ok`: `true`; \} \| \{ `code`: `string`; `message`: `string`; `ok`: `false`; \}
