[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/catalog

# server/\_lib/creatorStrategy/catalog

## Type Aliases

### CreatorStrategyFeatureDefinition

> **CreatorStrategyFeatureDefinition** = `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:158](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L158)

#### Properties

##### description

> **description**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:166](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L166)

Longer explanation of what the feature does and what provisioning entails.

##### displayName

> **displayName**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:162](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L162)

Human-readable name (UI).

##### estimatedActivationWindow

> **estimatedActivationWindow**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:174](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L174)

Estimated time from payment to activation (free-form, for UI copy).

##### key

> **key**: [`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey)

Defined in: [server/\_lib/creatorStrategy/catalog.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L160)

Stable machine-readable identifier.

##### priceUsdc

> **priceUsdc**: `bigint`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:168](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L168)

Price in USDC base units (6 decimals).

##### provisionerTag

> **provisionerTag**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:170](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L170)

Operator-side tag mapping this feature to its runbook / automation.

##### requires

> **requires**: readonly `string`[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L172)

Structured list of prerequisites surfaced to the creator before they pay.

##### tagline

> **tagline**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:164](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L164)

One-sentence description (UI).

***

### CreatorStrategyFeatureDto

> **CreatorStrategyFeatureDto** = `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:467](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L467)

Public-safe serialization for the `/api/creator/strategy/features`
endpoint. Converts `priceUsdc` to a string to avoid bigint JSON issues
on clients.

#### Properties

##### description

> **description**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:471](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L471)

##### displayName

> **displayName**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:469](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L469)

##### estimatedActivationWindow

> **estimatedActivationWindow**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:476](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L476)

##### key

> **key**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:468](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L468)

##### priceUsdc

> **priceUsdc**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:472](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L472)

##### priceUsdcDisplay

> **priceUsdcDisplay**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:473](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L473)

##### provisionerTag

> **provisionerTag**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:474](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L474)

##### requires

> **requires**: readonly `string`[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:475](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L475)

##### tagline

> **tagline**: `string`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:470](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L470)

***

### CreatorStrategyFeatureKey

> **CreatorStrategyFeatureKey** = `"vault_full_deploy"` \| `"charm_active_lp"` \| `"ajna_sleeve"` \| `"solana_ovault_mesh"` \| `"solana_meteora_alpha_vault"` \| `` `deploy_vanity_vault_prefix_len_${DeployVanityLength}` `` \| `` `deploy_vanity_share_suffix_len_${DeployVanityLength}` ``

Defined in: [server/\_lib/creatorStrategy/catalog.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L34)

Creator strategy feature catalog.

Greenfield vault deploy sells one public SKU: **`vault_full_deploy`**
($499 USDC). Payment expands into bundled sub-entitlements (Charm,
Ajna, Solana mesh, Meteora) via `expandCreatorFeatureKeys`. Individual
à-la-carte purchases of bundled keys return HTTP 410. Legacy per-key
rows from operator comps still resolve for grandfathered creators.

See `docs/operations/creator-strategy-features.md` for the full product
model (bundle, weight scaling, legacy partial entitlements).

Design rules (keep this file boring and declarative):
  - Prices are in USDC base units (6 decimals). 499e6 = $499 bundle.
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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L68)

***

### DeployVanityLength

> **DeployVanityLength** = *typeof* [`DEPLOY_VANITY_ALLOWED_LENGTHS`](#deploy_vanity_allowed_lengths)\[`number`\]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L67)

***

### RetiredCreatorStrategyFeatureKey

> **RetiredCreatorStrategyFeatureKey** = *typeof* [`RETIRED_CREATOR_STRATEGY_FEATURE_KEYS`](#retired_creator_strategy_feature_keys)\[`number`\]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L86)

## Variables

### CREATOR\_STRATEGY\_FEATURE\_CATALOG

> `const` **CREATOR\_STRATEGY\_FEATURE\_CATALOG**: `Record`\<[`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey), [`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)\>

Defined in: [server/\_lib/creatorStrategy/catalog.ts:183](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L183)

***

### DEFAULT\_CREATOR\_STRATEGY\_PRICE\_USDC

> `const` **DEFAULT\_CREATOR\_STRATEGY\_PRICE\_USDC**: `bigint` = `100_000_000n`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:181](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L181)

Legacy list price for bundled sub-feature catalog entries and vanity tiers
($100). Public greenfield deploy SKU is `FULL_VAULT_DEPLOY_PRICE_USDC` ($499).

***

### DEPLOY\_GATING\_FEATURE\_KEYS

> `const` **DEPLOY\_GATING\_FEATURE\_KEYS**: `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L78)

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

***

### DEPLOY\_VANITY\_ALLOWED\_LENGTHS

> `const` **DEPLOY\_VANITY\_ALLOWED\_LENGTHS**: readonly \[`1`, `2`, `3`, `4`, `5`\]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L66)

***

### DEPLOY\_VANITY\_FEATURE\_KEYS\_BY\_KIND\_AND\_LENGTH

> `const` **DEPLOY\_VANITY\_FEATURE\_KEYS\_BY\_KIND\_AND\_LENGTH**: `object`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L113)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:130](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L130)

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

***

### FULL\_DEPLOY\_BUNDLE\_GRANTED\_KEYS

> `const` **FULL\_DEPLOY\_BUNDLE\_GRANTED\_KEYS**: readonly \[`"charm_active_lp"`, `"ajna_sleeve"`, `"solana_ovault_mesh"`, `"solana_meteora_alpha_vault"`\]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L53)

Entitlements granted by `vault_full_deploy`. Legacy rows for these keys
still work; new purchases should use the bundle only.

***

### FULL\_VAULT\_DEPLOY\_FEATURE\_KEY

> `const` **FULL\_VAULT\_DEPLOY\_FEATURE\_KEY**: `"vault_full_deploy"`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L44)

Single SKU for new vault deploys — includes all bundled sub-features below.

***

### FULL\_VAULT\_DEPLOY\_PRICE\_USDC

> `const` **FULL\_VAULT\_DEPLOY\_PRICE\_USDC**: `499000000n` = `499_000_000n`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L47)

$499.00 USDC at 6 decimals.

***

### RETIRED\_CREATOR\_STRATEGY\_FEATURE\_KEYS

> `const` **RETIRED\_CREATOR\_STRATEGY\_FEATURE\_KEYS**: readonly \[`"solana_bridge_strategy"`\]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L84)

Retired keys may still exist on historical DB rows; they are not purchasable.

## Functions

### getCreatorStrategyFeature()

> **getCreatorStrategyFeature**(`key`): [`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition) \| `null`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:442](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L442)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L138)

#### Parameters

##### params

###### kind

[`DeployVanityFeatureKind`](#deployvanityfeaturekind)

###### length

`number`

#### Returns

[`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey) \| `null`

***

### getRetiredCreatorStrategyFeatureMessage()

> **getRetiredCreatorStrategyFeatureMessage**(`key`): `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L95)

#### Parameters

##### key

`string`

#### Returns

`string` \| `null`

***

### isAlacarteDeployFeatureKey()

> **isAlacarteDeployFeatureKey**(`key`): `boolean`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L62)

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### isRetiredCreatorStrategyFeatureKey()

> **isRetiredCreatorStrategyFeatureKey**(`key`): `key is "solana_bridge_strategy"`

Defined in: [server/\_lib/creatorStrategy/catalog.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L89)

#### Parameters

##### key

`string`

#### Returns

`key is "solana_bridge_strategy"`

***

### listCreatorStrategyFeatures()

> **listCreatorStrategyFeatures**(): [`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:449](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L449)

#### Returns

[`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)[]

***

### listCreatorStrategyFeaturesForPurchase()

> **listCreatorStrategyFeaturesForPurchase**(): [`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:454](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L454)

Public purchase catalog: full deploy bundle + optional vanity tiers only.

#### Returns

[`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)[]

***

### listDeployVanityFeatureKeysAtOrAbove()

> **listDeployVanityFeatureKeysAtOrAbove**(`params`): [`CreatorStrategyFeatureKey`](#creatorstrategyfeaturekey)[]

Defined in: [server/\_lib/creatorStrategy/catalog.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L147)

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

Defined in: [server/\_lib/creatorStrategy/catalog.ts:479](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/catalog.ts#L479)

#### Parameters

##### feature

[`CreatorStrategyFeatureDefinition`](#creatorstrategyfeaturedefinition)

#### Returns

[`CreatorStrategyFeatureDto`](#creatorstrategyfeaturedto)
