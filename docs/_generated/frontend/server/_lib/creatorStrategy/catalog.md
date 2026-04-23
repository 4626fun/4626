[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/creatorStrategy/catalog

# server/\_lib/creatorStrategy/catalog

## Type Aliases

### CreatorStrategyFeatureDefinition

> **CreatorStrategyFeatureDefinition** = `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L112)

#### Properties

##### description

> **description**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L120)

Longer explanation of what the feature does and what provisioning entails.

##### displayName

> **displayName**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L116)

Human-readable name (UI).

##### estimatedActivationWindow

> **estimatedActivationWindow**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L128)

Estimated time from payment to activation (free-form, for UI copy).

##### key

> **key**: [`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey)

Defined in: [server/\_lib/creatorStrategy/catalog.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L114)

Stable machine-readable identifier.

##### priceUsdc

> **priceUsdc**: `bigint`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L122)

Price in USDC base units (6 decimals).

##### provisionerTag

> **provisionerTag**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L124)

Operator-side tag mapping this feature to its runbook / automation.

##### requires

> **requires**: readonly `string`[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L126)

Structured list of prerequisites surfaced to the creator before they pay.

##### tagline

> **tagline**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L118)

One-sentence description (UI).

***

### CreatorStrategyFeatureDto

> **CreatorStrategyFeatureDto** = `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:396](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L396)

Public-safe serialization for the `/api/creator/strategy/features`
endpoint. Converts `priceUsdc` to a string to avoid bigint JSON issues
on clients.

#### Properties

##### description

> **description**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:400](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L400)

##### displayName

> **displayName**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:398](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L398)

##### estimatedActivationWindow

> **estimatedActivationWindow**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:405](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L405)

##### key

> **key**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:397](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L397)

##### priceUsdc

> **priceUsdc**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:401](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L401)

##### priceUsdcDisplay

> **priceUsdcDisplay**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:402](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L402)

##### provisionerTag

> **provisionerTag**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:403](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L403)

##### requires

> **requires**: readonly `string`[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:404](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L404)

##### tagline

> **tagline**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:399](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L399)

***

### CreatorStrategyFeatureKey

> **CreatorStrategyFeatureKey** = `"charm_active_lp"` \| `"ajna_sleeve"` \| `"solana_bridge_strategy"` \| `"solana_meteora_alpha_vault"` \| `` `deploy_vanity_vault_prefix_len_${DeployVanityLength}` `` \| `` `deploy_vanity_share_suffix_len_${DeployVanityLength}` ``

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L46)

***

### DeployVanityLength

> **DeployVanityLength** = *typeof* [`DEPLOY_VANITY_ALLOWED_LENGTHS`](#deploy_vanity_allowed_lengths)\[`number`\]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L45)

## Variables

### CREATOR\_STRATEGY\_FEATURE\_CATALOG

> `const` **CREATOR\_STRATEGY\_FEATURE\_CATALOG**: `Record`\<[`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey), [`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)\>

Defined in: [server/\_lib/creatorStrategy/catalog.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L137)

***

### DEFAULT\_CREATOR\_STRATEGY\_PRICE\_USDC

> `const` **DEFAULT\_CREATOR\_STRATEGY\_PRICE\_USDC**: `bigint` = `100_000_000n`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:135](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L135)

The default USDC price for a premium feature. Individual features can
override but keeping them uniform at $100 is the initial product rule.

***

### DEPLOY\_GATING\_FEATURE\_KEYS

> `const` **DEPLOY\_GATING\_FEATURE\_KEYS**: `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L56)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L44)

***

### DEPLOY\_VANITY\_FEATURE\_KEYS\_BY\_KIND\_AND\_LENGTH

> `const` **DEPLOY\_VANITY\_FEATURE\_KEYS\_BY\_KIND\_AND\_LENGTH**: `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L67)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L84)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:380](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L380)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L92)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:387](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L387)

#### Returns

[`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)[]

***

### listDeployVanityFeatureKeysAtOrAbove()

> **listDeployVanityFeatureKeysAtOrAbove**(`params`): [`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey)[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L101)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:408](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L408)

#### Parameters

##### feature

[`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)

#### Returns

[`CreatorStrategyFeatureDto`](#creatorstrategyfeaturedto)
