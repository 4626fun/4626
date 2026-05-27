[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/bundleEntitlements

# server/\_lib/creatorStrategy/bundleEntitlements

## Functions

### expandCreatorFeatureKeys()

> **expandCreatorFeatureKeys**(`keys`): `Set`\<[`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)\>

Defined in: [server/\_lib/creatorStrategy/bundleEntitlements.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/bundleEntitlements.ts#L16)

Expand stored activation keys into effective deploy entitlements.
A paid `vault_full_deploy` row satisfies every bundled sub-feature.

#### Parameters

##### keys

`Iterable`\<`string`\>

#### Returns

`Set`\<[`CreatorStrategyFeatureKey`](catalog.md#creatorstrategyfeaturekey)\>

***

### getAlacarteDeployPurchaseBlockedMessage()

> **getAlacarteDeployPurchaseBlockedMessage**(`featureKey`): `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/bundleEntitlements.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/bundleEntitlements.ts#L54)

#### Parameters

##### featureKey

`string`

#### Returns

`string` \| `null`

***

### isFeatureGrantedByKeys()

> **isFeatureGrantedByKeys**(`featureKey`, `activeKeys`): `boolean`

Defined in: [server/\_lib/creatorStrategy/bundleEntitlements.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/bundleEntitlements.ts#L47)

#### Parameters

##### featureKey

`string`

##### activeKeys

`Iterable`\<`string`\>

#### Returns

`boolean`

***

### listEntitlementLookupKeys()

> **listEntitlementLookupKeys**(`featureKey`): `string`[]

Defined in: [server/\_lib/creatorStrategy/bundleEntitlements.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/bundleEntitlements.ts#L38)

Feature keys to match in SQL when checking live entitlement for a sub-feature.

#### Parameters

##### featureKey

`string`

#### Returns

`string`[]

## References

### FULL\_DEPLOY\_BUNDLE\_GRANTED\_KEYS

Re-exports [FULL_DEPLOY_BUNDLE_GRANTED_KEYS](catalog.md#full_deploy_bundle_granted_keys)

***

### FULL\_VAULT\_DEPLOY\_FEATURE\_KEY

Re-exports [FULL_VAULT_DEPLOY_FEATURE_KEY](catalog.md#full_vault_deploy_feature_key)
