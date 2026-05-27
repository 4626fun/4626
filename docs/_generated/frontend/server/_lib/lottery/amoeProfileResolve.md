[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeProfileResolve

# server/\_lib/lottery/amoeProfileResolve

## Type Aliases

### AmoePointsProfileKind

> **AmoePointsProfileKind** = `"verified_privy"` \| `"linked"` \| `"synthetic"`

Defined in: [server/\_lib/lottery/amoeProfileResolve.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeProfileResolve.ts#L8)

How an AMOE `points.signup_id` was resolved for a wallet.

***

### AmoePointsProfilePolicy

> **AmoePointsProfilePolicy** = `"verified_privy_only"` \| `"privy_linked"` \| `"lottery_ledger"`

Defined in: [server/\_lib/lottery/amoeProfileResolve.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeProfileResolve.ts#L18)

- `verified_privy_only` — Privy account with verified, non-synthetic email.
  Used for Twitter daily awards and credit snapshots. No synthetic fallback.
- `privy_linked` — Any Privy-backed profile linked via `profile_wallets`.
  Used for the waitlist `amoe_checkin` bridge. No synthetic fallback.
- `lottery_ledger` — Prefer any linked profile (tombstone-aware, real email first);
  otherwise create `amoe-*@wallet.4626.fun` for anonymous lottery bookkeeping.

***

### ResolveAmoePointsProfileResult

> **ResolveAmoePointsProfileResult** = `object`

Defined in: [server/\_lib/lottery/amoeProfileResolve.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeProfileResolve.ts#L20)

#### Properties

##### kind

> **kind**: [`AmoePointsProfileKind`](#amoepointsprofilekind)

Defined in: [server/\_lib/lottery/amoeProfileResolve.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeProfileResolve.ts#L22)

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/lottery/amoeProfileResolve.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeProfileResolve.ts#L21)

## Functions

### normalizeAmoeWallet()

> **normalizeAmoeWallet**(`wallet`): `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeProfileResolve.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeProfileResolve.ts#L41)

Normalize and validate an EVM address used in AMOE flows.

#### Parameters

##### wallet

`string`

#### Returns

`` `0x${string}` ``

***

### resolveAmoePointsProfile()

> **resolveAmoePointsProfile**(`db`, `walletInput`, `policy`): `Promise`\<[`ResolveAmoePointsProfileResult`](#resolveamoepointsprofileresult) \| `null`\>

Defined in: [server/\_lib/lottery/amoeProfileResolve.ts:191](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeProfileResolve.ts#L191)

Resolve which `profiles.id` should own AMOE `points` rows for `wallet`.
All AMOE award/spend paths must go through this helper.

#### Parameters

##### db

`Db`

##### walletInput

`string`

##### policy

[`AmoePointsProfilePolicy`](#amoepointsprofilepolicy)

#### Returns

`Promise`\<[`ResolveAmoePointsProfileResult`](#resolveamoepointsprofileresult) \| `null`\>

***

### resolveAmoePointsProfileId()

> **resolveAmoePointsProfileId**(`db`, `walletInput`, `policy`): `Promise`\<`number` \| `null`\>

Defined in: [server/\_lib/lottery/amoeProfileResolve.ts:221](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeProfileResolve.ts#L221)

Convenience when callers only need `profiles.id`.

#### Parameters

##### db

`Db`

##### walletInput

`string`

##### policy

[`AmoePointsProfilePolicy`](#amoepointsprofilepolicy)

#### Returns

`Promise`\<`number` \| `null`\>
