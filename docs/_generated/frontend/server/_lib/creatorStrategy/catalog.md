[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/creatorStrategy/catalog

# server/\_lib/creatorStrategy/catalog

## Type Aliases

### CreatorStrategyFeatureDefinition

> **CreatorStrategyFeatureDefinition** = `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L113)

#### Properties

##### description

> **description**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L121)

Longer explanation of what the feature does and what provisioning entails.

##### displayName

> **displayName**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L117)

Human-readable name (UI).

##### estimatedActivationWindow

> **estimatedActivationWindow**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:129](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L129)

Estimated time from payment to activation (free-form, for UI copy).

##### key

> **key**: [`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey)

Defined in: [server/\_lib/creatorStrategy/catalog.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L115)

Stable machine-readable identifier.

##### priceUsdc

> **priceUsdc**: `bigint`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L123)

Price in USDC base units (6 decimals).

##### provisionerTag

> **provisionerTag**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L125)

Operator-side tag mapping this feature to its runbook / automation.

##### requires

> **requires**: readonly `string`[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L127)

Structured list of prerequisites surfaced to the creator before they pay.

##### tagline

> **tagline**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L119)

One-sentence description (UI).

***

### CreatorStrategyFeatureDto

> **CreatorStrategyFeatureDto** = `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:414](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L414)

Public-safe serialization for the `/api/creator/strategy/features`
endpoint. Converts `priceUsdc` to a string to avoid bigint JSON issues
on clients.

#### Properties

##### description

> **description**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:418](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L418)

##### displayName

> **displayName**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:416](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L416)

##### estimatedActivationWindow

> **estimatedActivationWindow**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:423](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L423)

##### key

> **key**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:415](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L415)

##### priceUsdc

> **priceUsdc**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:419](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L419)

##### priceUsdcDisplay

> **priceUsdcDisplay**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:420](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L420)

##### provisionerTag

> **provisionerTag**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:421](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L421)

##### requires

> **requires**: readonly `string`[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:422](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L422)

##### tagline

> **tagline**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:417](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L417)

***

### CreatorStrategyFeatureKey

> **CreatorStrategyFeatureKey** = `"charm_active_lp"` \| `"ajna_sleeve"` \| `"solana_bridge_strategy"` \| `"solana_ovault_mesh"` \| `"solana_meteora_alpha_vault"` \| `` `deploy_vanity_vault_prefix_len_${DeployVanityLength}` `` \| `` `deploy_vanity_share_suffix_len_${DeployVanityLength}` ``

Defined in: [server/\_lib/creatorStrategy/catalog.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L36)

Creator strategy feature catalog.

Every productive strategy on a `CreatorOVault` (Charm, Ajna, Solana
bridge) is a paid, per-creator feature gated by an activation in
`creator_strategy_features`. There is no free baseline — a creator
must activate at least one feature before Phase 3 deploy, and each
feature entry in this catalog is independently priced in USDC.

Activation is a one-time USDC payment on Base that unlocks
server-side provisioning of the underlying infra. See
`docs/operations/creator-strategy-features.md` for the full product
model (deploy-gating vs post-deploy features, weight scaling, etc.).

Design rules (keep this file boring and declarative):
  - Prices are in USDC base units (6 decimals). 100e6 = $100.
  - Keys are kebab_case + provider-scoped so we can add more without
    namespace collisions (e.g. `solana_meteora_alpha_vault`,
    `charm_auto_rebalance`, `ajna_min_bucket_keeper`).
  - `provisionerTag` is a free-form string the operator / automation
    uses to pick which script / workflow to run. The catalog does NOT
    embed provisioning logic; it only declares intent.
  - `requires` lists onchain / offchain prerequisites surfaced to the
    creator before they pay (e.g. vault deployed, coin bridged).

When adding a feature:
  1. Add a new entry here with a unique key.
  2. Document the provisioning runbook in
     `docs/operations/creator-strategy-features.md`.
  3. If auto-provisioned, wire the dispatcher in
     `frontend/server/_lib/creatorStrategy/provisioner.ts` (create that
     file the first time a feature gets auto-provisioning). For now every
     feature is manually provisioned by an operator watching `pending`.

***

### DeployVanityFeatureKind

> **DeployVanityFeatureKind** = `"vaultPrefix"` \| `"shareSuffix"`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L47)

***

### DeployVanityLength

> **DeployVanityLength** = *typeof* [`DEPLOY_VANITY_ALLOWED_LENGTHS`](#deploy_vanity_allowed_lengths)\[`number`\]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L46)

## Variables

### CREATOR\_STRATEGY\_FEATURE\_CATALOG

> `const` **CREATOR\_STRATEGY\_FEATURE\_CATALOG**: `Record`\<[`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey), [`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)\>

Defined in: [server/\_lib/creatorStrategy/catalog.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L138)

***

### DEFAULT\_CREATOR\_STRATEGY\_PRICE\_USDC

> `const` **DEFAULT\_CREATOR\_STRATEGY\_PRICE\_USDC**: `bigint` = `100_000_000n`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L136)

The default USDC price for a premium feature. Individual features can
override but keeping them uniform at $100 is the initial product rule.

***

### DEPLOY\_GATING\_FEATURE\_KEYS

> `const` **DEPLOY\_GATING\_FEATURE\_KEYS**: `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L57)

Feature keys that gate a strategy's inclusion at deploy time. These
map 1:1 to a `Phase3Params.*WeightBps` field: if the creator has no
active activation for the key, the corresponding weight is forced to
zero and the strategy is skipped by `DeploymentBatcher` (requires the
weight-0-skip contract patch to be live; see
`docs/operations/creator-strategy-features.md` § "Strategy gating").

#### Type Declaration

##### ajna

> `readonly` **ajna**: `"ajna_sleeve"` = `'ajna_sleeve'`

##### charm

> `readonly` **charm**: `"charm_active_lp"` = `'charm_active_lp'`

##### solana

> `readonly` **solana**: `"solana_bridge_strategy"` = `'solana_bridge_strategy'`

***

### DEPLOY\_VANITY\_ALLOWED\_LENGTHS

> `const` **DEPLOY\_VANITY\_ALLOWED\_LENGTHS**: readonly \[`1`, `2`, `3`, `4`, `5`\]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L45)

***

### DEPLOY\_VANITY\_FEATURE\_KEYS\_BY\_KIND\_AND\_LENGTH

> `const` **DEPLOY\_VANITY\_FEATURE\_KEYS\_BY\_KIND\_AND\_LENGTH**: `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L68)

Paid vanity feature keys used by deploy session validation.
These do not affect Phase-3 strategy weights; they gate vanity
address customization only.

#### Type Declaration

##### shareSuffix

> `readonly` **shareSuffix**: `object`

###### shareSuffix.1

> `readonly` **1**: `"deploy_vanity_share_suffix_len_1"` = `'deploy_vanity_share_suffix_len_1'`

###### shareSuffix.2

> `readonly` **2**: `"deploy_vanity_share_suffix_len_2"` = `'deploy_vanity_share_suffix_len_2'`

###### shareSuffix.3

> `readonly` **3**: `"deploy_vanity_share_suffix_len_3"` = `'deploy_vanity_share_suffix_len_3'`

###### shareSuffix.4

> `readonly` **4**: `"deploy_vanity_share_suffix_len_4"` = `'deploy_vanity_share_suffix_len_4'`

###### shareSuffix.5

> `readonly` **5**: `"deploy_vanity_share_suffix_len_5"` = `'deploy_vanity_share_suffix_len_5'`

##### vaultPrefix

> `readonly` **vaultPrefix**: `object`

###### vaultPrefix.1

> `readonly` **1**: `"deploy_vanity_vault_prefix_len_1"` = `'deploy_vanity_vault_prefix_len_1'`

###### vaultPrefix.2

> `readonly` **2**: `"deploy_vanity_vault_prefix_len_2"` = `'deploy_vanity_vault_prefix_len_2'`

###### vaultPrefix.3

> `readonly` **3**: `"deploy_vanity_vault_prefix_len_3"` = `'deploy_vanity_vault_prefix_len_3'`

###### vaultPrefix.4

> `readonly` **4**: `"deploy_vanity_vault_prefix_len_4"` = `'deploy_vanity_vault_prefix_len_4'`

###### vaultPrefix.5

> `readonly` **5**: `"deploy_vanity_vault_prefix_len_5"` = `'deploy_vanity_vault_prefix_len_5'`

***

### DEPLOY\_VANITY\_PRICE\_USDC\_BY\_LENGTH

> `const` **DEPLOY\_VANITY\_PRICE\_USDC\_BY\_LENGTH**: `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L85)

#### Type Declaration

##### 1

> `readonly` **1**: `25000000n` = `25_000_000n`

##### 2

> `readonly` **2**: `75000000n` = `75_000_000n`

##### 3

> `readonly` **3**: `200000000n` = `200_000_000n`

##### 4

> `readonly` **4**: `500000000n` = `500_000_000n`

##### 5

> `readonly` **5**: `1250000000n` = `1_250_000_000n`

## Functions

### getCreatorStrategyFeature()

> **getCreatorStrategyFeature**(`key`): [`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition) \| `null`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:398](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L398)

Returns a catalog entry, or `null` if the key is not in the catalog.
Keep nullable so API handlers can fail with a clean 400 instead of
throwing on unknown keys.

#### Parameters

##### key

`string`

#### Returns

[`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition) \| `null`

***

### getDeployVanityFeatureKey()

> **getDeployVanityFeatureKey**(`params`): [`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey) \| `null`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L93)

#### Parameters

##### params

###### kind

[`DeployVanityFeatureKind`](#deployvanityfeaturekind)

###### length

`number`

#### Returns

[`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey) \| `null`

***

### listCreatorStrategyFeatures()

> **listCreatorStrategyFeatures**(): [`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:405](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L405)

#### Returns

[`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)[]

***

### listDeployVanityFeatureKeysAtOrAbove()

> **listDeployVanityFeatureKeysAtOrAbove**(`params`): [`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey)[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L102)

#### Parameters

##### params

###### kind

[`DeployVanityFeatureKind`](#deployvanityfeaturekind)

###### minLength

`number`

#### Returns

[`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey)[]

***

### toCreatorStrategyFeatureDto()

> **toCreatorStrategyFeatureDto**(`feature`): [`CreatorStrategyFeatureDto`](#creatorstrategyfeaturedto)

Defined in: [server/\_lib/creatorStrategy/catalog.ts:426](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L426)

#### Parameters

##### feature

[`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)

#### Returns

[`CreatorStrategyFeatureDto`](#creatorstrategyfeaturedto)
