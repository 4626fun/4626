[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/creatorStrategy/resolveWeights

# server/\_lib/creatorStrategy/resolveWeights

## Type Aliases

### ComputeStrategyWeightsResult

> **ComputeStrategyWeightsResult** = \{ `ok`: `true`; `weights`: [`StrategyWeights`](#strategyweights); \} \| \{ `ok`: `false`; `reason`: `"no_paid_strategies"`; \}

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L138)

Turn a set of active feature keys into the Phase 3 weight triple.

Returns `{ ok: false }` when zero strategies are paid — the contract
rejects a zero-weight deploy so we bail out early rather than
producing a plan that will revert.

Weight scaling splits `PRODUCTIVE_ALLOCATION_BPS` (9_000) evenly
across the active strategies. 9_000 is divisible cleanly by 1, 2, and
3 (9_000 / 9_000 / 4_500 / 3_000 respectively), so there are no
rounding remainders to allocate; total always sums to exactly
`TOTAL_ALLOCATION_BPS`. Pure function — no I/O — easily testable.

***

### ResolveCreatorStrategyPlanResult

> **ResolveCreatorStrategyPlanResult** = \{ `ok`: `true`; `plan`: [`ResolvedStrategyPlan`](#resolvedstrategyplan); \} \| \{ `activeFeatureKeys`: [`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)[]; `creatorToken`: `Address`; `ok`: `false`; `reason`: `"no_paid_strategies"`; \}

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:164](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L164)

***

### ResolvedStrategyPlan

> **ResolvedStrategyPlan** = [`StrategyWeights`](#strategyweights) & `object`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L73)

#### Type Declaration

##### activeFeatureKeys

> **activeFeatureKeys**: [`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)[]

##### creatorToken

> **creatorToken**: `Address`

##### reasons

> **reasons**: `object`

Human-friendly reason string for each strategy (why it's included / skipped).
Useful for surfacing in the UI and for support triage.

###### reasons.ajna

> **ajna**: `"paid"` \| `"unpaid"`

###### reasons.charm

> **charm**: `"paid"` \| `"unpaid"`

###### reasons.solana

> **solana**: `"paid"` \| `"unpaid"`

***

### StrategyWeights

> **StrategyWeights** = `object`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L66)

#### Properties

##### ajnaWeightBps

> **ajnaWeightBps**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L68)

##### charmWeightBps

> **charmWeightBps**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L67)

##### idleReserveBps

> **idleReserveBps**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:70](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L70)

##### solanaWeightBps

> **solanaWeightBps**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:69](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L69)

***

### WeightGateResult

> **WeightGateResult** = \{ `ok`: `true`; \} \| \{ `expected`: [`StrategyWeights`](#strategyweights); `ok`: `false`; `reason`: `"charm_unpaid_but_requested"` \| `"ajna_unpaid_but_requested"` \| `"solana_unpaid_but_requested"` \| `"charm_weight_mismatch"` \| `"ajna_weight_mismatch"` \| `"solana_weight_mismatch"`; `requested`: \{ `ajnaWeightBps`: `bigint`; `charmWeightBps`: `bigint`; `solanaWeightBps`: `bigint`; \}; \}

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:221](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L221)

Assert that a client-supplied Phase 3 weight triple matches the
server's authoritative plan for this creator. Returns an error shape
(not throwing) so the deploy-continue handler can produce a clean API
envelope.

The check is strict: requested weights must equal the resolver's
defaults for paid strategies (so the client can't request 9_900 bps
for Charm with a $100 payment). If we later let creators customize
weights, extend this to enforce sane minima / maxima per strategy.

## Variables

### DEFAULT\_AJNA\_WEIGHT\_BPS

> `const` **DEFAULT\_AJNA\_WEIGHT\_BPS**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L63)

***

### DEFAULT\_CHARM\_WEIGHT\_BPS

> `const` **DEFAULT\_CHARM\_WEIGHT\_BPS**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L62)

Per-strategy weights for the canonical 3-strategy split. Exported as
named constants for test-time reference, but the runtime resolver
computes them dynamically by dividing `PRODUCTIVE_ALLOCATION_BPS` by
the number of active strategies (so 1 active ⇒ 9_000, not 3_000).

***

### DEFAULT\_IDLE\_RESERVE\_BPS

> `const` **DEFAULT\_IDLE\_RESERVE\_BPS**: `1000n` = `1_000n`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L52)

Fixed idle reserve in bps. Kept constant across strategy counts so
creators always have a predictable withdrawal buffer. If we later let
creators customize this, it becomes a per-creator column rather than
a constant — but the resolver's API shape doesn't change.

***

### DEFAULT\_SOLANA\_WEIGHT\_BPS

> `const` **DEFAULT\_SOLANA\_WEIGHT\_BPS**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L64)

***

### PRODUCTIVE\_ALLOCATION\_BPS

> `const` **PRODUCTIVE\_ALLOCATION\_BPS**: `bigint`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L54)

***

### TOTAL\_ALLOCATION\_BPS

> `const` **TOTAL\_ALLOCATION\_BPS**: `10000n` = `10_000n`

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L53)

## Functions

### computeStrategyWeights()

> **computeStrategyWeights**(`activeKeys`): [`ComputeStrategyWeightsResult`](#computestrategyweightsresult)

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L142)

#### Parameters

##### activeKeys

`ReadonlySet`\<[`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)\>

#### Returns

[`ComputeStrategyWeightsResult`](#computestrategyweightsresult)

***

### gateRequestedStrategyWeights()

> **gateRequestedStrategyWeights**(`plan`, `requested`): [`WeightGateResult`](#weightgateresult)

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:240](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L240)

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

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L95)

Read which gated features the creator currently has active or pending
payment for. Both `pending` (payment verified, awaiting operator
provisioning) and `active` count as "paid" — because payment is
authoritative and provisioning is an internal-ops concern. Returning
pending as paid lets the creator deploy their vault the instant their
USDC transfer clears rather than blocking on an operator step.

#### Parameters

##### db

`Db`

##### creatorToken

`` `0x${string}` ``

#### Returns

`Promise`\<`Set`\<[`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)\>\>

***

### resolveCreatorStrategyPlan()

> **resolveCreatorStrategyPlan**(`db`, `creatorTokenRaw`): `Promise`\<[`ResolveCreatorStrategyPlanResult`](#resolvecreatorstrategyplanresult)\>

Defined in: [server/\_lib/creatorStrategy/resolveWeights.ts:180](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/resolveWeights.ts#L180)

Convenience: read DB + compute weights in one call.

Returns a tagged result so callers can handle the "no strategies
paid" case explicitly rather than getting a zero-weight plan that
would revert on-chain.

#### Parameters

##### db

`Db`

##### creatorTokenRaw

`` `0x${string}` ``

#### Returns

`Promise`\<[`ResolveCreatorStrategyPlanResult`](#resolvecreatorstrategyplanresult)\>
