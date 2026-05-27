[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/resolveWeights

# server/\_lib/creatorStrategy/resolveWeights

## Type Aliases

### ComputeStrategyWeightsResult

> **ComputeStrategyWeightsResult** = \{ `ok`: `true`; `weights`: [`StrategyWeights`](#strategyweights); \} \| \{ `ok`: `false`; `reason`: `"no_paid_strategies"`; \}

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L91)

***

### ResolveCreatorStrategyPlanResult

> **ResolveCreatorStrategyPlanResult** = \{ `ok`: `true`; `plan`: [`ResolvedStrategyPlan`](#resolvedstrategyplan); \} \| \{ `activeFeatureKeys`: [`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)[]; `creatorToken`: `Address`; `ok`: `false`; `reason`: `"no_paid_strategies"`; \}

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:114](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L114)

***

### ResolvedStrategyPlan

> **ResolvedStrategyPlan** = [`StrategyWeights`](#strategyweights) & `object`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L58)

#### Type Declaration

##### activeFeatureKeys

> **activeFeatureKeys**: [`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)[]

##### creatorToken

> **creatorToken**: `Address`

##### reasons

> **reasons**: `object`

###### reasons.ajna

> **ajna**: `"paid"` \| `"unpaid"`

###### reasons.charm

> **charm**: `"paid"` \| `"unpaid"`

###### reasons.solana

> **solana**: `"share_auto_bridge"`

***

### StrategyWeights

> **StrategyWeights** = `object`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L51)

#### Properties

##### ajnaWeightBps

> **ajnaWeightBps**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L53)

##### charmWeightBps

> **charmWeightBps**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L52)

##### idleReserveBps

> **idleReserveBps**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L55)

##### solanaWeightBps

> **solanaWeightBps**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L54)

***

### WeightGateResult

> **WeightGateResult** = \{ `ok`: `true`; \} \| \{ `expected`: [`StrategyWeights`](#strategyweights); `ok`: `false`; `reason`: `"charm_unpaid_but_requested"` \| `"ajna_unpaid_but_requested"` \| `"solana_unpaid_but_requested"` \| `"charm_weight_mismatch"` \| `"ajna_weight_mismatch"` \| `"solana_weight_mismatch"`; `requested`: \{ `ajnaWeightBps`: `bigint`; `charmWeightBps`: `bigint`; `solanaWeightBps`: `bigint`; \}; \}

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:153](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L153)

## Variables

### DEFAULT\_AJNA\_WEIGHT\_BPS

> `const` **DEFAULT\_AJNA\_WEIGHT\_BPS**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L47)

***

### DEFAULT\_CHARM\_WEIGHT\_BPS

> `const` **DEFAULT\_CHARM\_WEIGHT\_BPS**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L46)

Default 45/45 split when both Charm and Ajna are paid.

***

### DEFAULT\_IDLE\_RESERVE\_BPS

> `const` **DEFAULT\_IDLE\_RESERVE\_BPS**: `1000n` = `1_000n`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L41)

Fixed idle reserve in bps. Kept constant across strategy counts so
creators always have a predictable withdrawal buffer.

***

### DEFAULT\_SOLANA\_WEIGHT\_BPS

> `const` **DEFAULT\_SOLANA\_WEIGHT\_BPS**: `0n` = `0n`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L49)

Solana vault strategy weight is always zero on greenfield deploys.

***

### PRODUCTIVE\_ALLOCATION\_BPS

> `const` **PRODUCTIVE\_ALLOCATION\_BPS**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L43)

***

### TOTAL\_ALLOCATION\_BPS

> `const` **TOTAL\_ALLOCATION\_BPS**: `10000n` = `10_000n`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L42)

## Functions

### computeStrategyWeights()

> **computeStrategyWeights**(`activeKeys`): [`ComputeStrategyWeightsResult`](#computestrategyweightsresult)

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L95)

#### Parameters

##### activeKeys

`ReadonlySet`\<[`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)\>

#### Returns

[`ComputeStrategyWeightsResult`](#computestrategyweightsresult)

***

### gateRequestedStrategyWeights()

> **gateRequestedStrategyWeights**(`plan`, `requested`): [`WeightGateResult`](#weightgateresult)

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:172](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L172)

#### Parameters

##### plan

[`ResolvedStrategyPlan`](#resolvedstrategyplan)

##### requested

###### ajnaWeightBps

`bigint`

###### charmWeightBps

`bigint`

###### solanaWeightBps

`bigint`

#### Returns

[`WeightGateResult`](#weightgateresult)

***

### readActiveCreatorFeatureKeys()

> **readActiveCreatorFeatureKeys**(`db`, `creatorToken`): `Promise`\<`Set`\<[`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)\>\>

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L72)

Read which gated features the creator currently has active or pending
payment for. Both `pending` and `active` count as "paid".

#### Parameters

##### db

`Db`

##### creatorToken

`string`

#### Returns

`Promise`\<`Set`\<[`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)\>\>

***

### resolveCreatorStrategyPlan()

> **resolveCreatorStrategyPlan**(`db`, `creatorTokenRaw`): `Promise`\<[`ResolveCreatorStrategyPlanResult`](#resolvecreatorstrategyplanresult)\>

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:123](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L123)

#### Parameters

##### db

`Db`

##### creatorTokenRaw

`string`

#### Returns

`Promise`\<[`ResolveCreatorStrategyPlanResult`](#resolvecreatorstrategyplanresult)\>
