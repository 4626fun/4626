[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/controlPlane/policyDegradation

# server/\_lib/controlPlane/policyDegradation

## Type Aliases

### DegradationContext

> **DegradationContext** = `object`

Defined in: [server/\_lib/controlPlane/policyDegradation.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/policyDegradation.ts#L4)

#### Properties

##### hasDeploySession?

> `optional` **hasDeploySession**: `boolean`

Defined in: [server/\_lib/controlPlane/policyDegradation.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/policyDegradation.ts#L5)

##### hasKeeprVault?

> `optional` **hasKeeprVault**: `boolean`

Defined in: [server/\_lib/controlPlane/policyDegradation.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/policyDegradation.ts#L6)

##### isStale?

> `optional` **isStale**: `boolean`

Defined in: [server/\_lib/controlPlane/policyDegradation.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/policyDegradation.ts#L7)

## Functions

### enforceMutatingDegradation()

> **enforceMutatingDegradation**(`params`): `object`

Defined in: [server/\_lib/controlPlane/policyDegradation.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/policyDegradation.ts#L35)

#### Parameters

##### params

###### context

[`DegradationContext`](#degradationcontext)

###### verb

[`ControlPlaneVerb`](policy.md#controlplaneverb)

#### Returns

`object`

##### blocked

> **blocked**: `boolean`

##### message?

> `optional` **message**: `string`

##### mode

> **mode**: [`DegradationMode`](policy.md#degradationmode)

***

### evaluateFreshness()

> **evaluateFreshness**(`lastUpdatedAt`): `object`

Defined in: [server/\_lib/controlPlane/policyDegradation.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/policyDegradation.ts#L20)

#### Parameters

##### lastUpdatedAt

`string` | `null` | `undefined`

#### Returns

`object`

##### ageMinutes

> **ageMinutes**: `number` \| `null`

##### freshness

> **freshness**: `"fresh"` \| `"stale"`

***

### getStaleThresholdMinutes()

> **getStaleThresholdMinutes**(): `number`

Defined in: [server/\_lib/controlPlane/policyDegradation.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/policyDegradation.ts#L14)

#### Returns

`number`

***

### resolveDegradationMode()

> **resolveDegradationMode**(`verb`): [`DegradationMode`](policy.md#degradationmode)

Defined in: [server/\_lib/controlPlane/policyDegradation.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/policyDegradation.ts#L10)

#### Parameters

##### verb

[`ControlPlaneVerb`](policy.md#controlplaneverb)

#### Returns

[`DegradationMode`](policy.md#degradationmode)
