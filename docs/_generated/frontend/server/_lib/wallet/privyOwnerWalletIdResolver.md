[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/privyOwnerWalletIdResolver

# server/\_lib/wallet/privyOwnerWalletIdResolver

## Type Aliases

### ResolveOwnerWalletIdOutcome

> **ResolveOwnerWalletIdOutcome** = \{ `candidate`: [`WalletCandidate`](#walletcandidate); `status`: `"ready"`; \} \| \{ `matches`: [`WalletCandidate`](#walletcandidate)[]; `status`: `"no_server_id"`; \} \| \{ `inspected`: [`WalletCandidate`](#walletcandidate)[]; `status`: `"no_match"`; \}

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L148)

***

### WalletCandidate

> **WalletCandidate** = `object`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L21)

Architecture B Phase 2 — Privy owner wallet-id resolver helpers.

Pure helpers that traverse every wallet-bearing surface of a Privy user
payload and surface the server wallet id for a target owner EOA. Mirrors
`classifyLinkedAccounts` in this directory: walks `user.wallet`,
`user.wallets`, `user.linkedAccounts`, `user.linked_accounts`, and nested
`smartWallets`/`smart_wallets`/`embeddedWallets`/`embedded_wallets` arrays
on each linked-account entry; accepts camelCase and snake_case field
names (`chainType`/`chain_type`, `walletClientType`/`wallet_client_type`,
`id`/`wallet_id`, etc.).

Used by:
  - `frontend/scripts/arch-b-find-privy-owner-wallet-id.ts` (operator CLI)
  - tests in this directory

Not used on the hot path — this only drives operator provisioning for
`command_issuer_execution_context`.

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L22)

##### chainType

> **chainType**: `string` \| `null`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L24)

##### delegated

> **delegated**: `boolean` \| `null`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L27)

##### hdWalletIndex

> **hdWalletIndex**: `number` \| `null`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L26)

##### id

> **id**: `string` \| `null`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L23)

##### rawType

> **rawType**: `string` \| `null`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L28)

##### walletClientType

> **walletClientType**: `string` \| `null`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L25)

## Functions

### collectWalletCandidates()

> **collectWalletCandidates**(`user`): `any`[]

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L52)

#### Parameters

##### user

`any`

#### Returns

`any`[]

***

### mergeByAddress()

> **mergeByAddress**(`entries`): [`WalletCandidate`](#walletcandidate)[]

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L126)

Merge candidates for the same address. Prefer entries that carry a server
id or richer metadata — this avoids picking a sparse snake_case shim over
a fuller camelCase record for the same wallet.

#### Parameters

##### entries

[`WalletCandidate`](#walletcandidate)[]

#### Returns

[`WalletCandidate`](#walletcandidate)[]

***

### nestedWalletEntries()

> **nestedWalletEntries**(`raw`): `any`[]

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L38)

#### Parameters

##### raw

`any`

#### Returns

`any`[]

***

### normalizeAddress()

> **normalizeAddress**(`value`): `string` \| `null`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L31)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### resolveOwnerWalletId()

> **resolveOwnerWalletId**(`user`, `ownerEoa`): [`ResolveOwnerWalletIdOutcome`](#resolveownerwalletidoutcome)

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:158](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L158)

End-to-end: walk every wallet surface on `user`, dedupe by address,
return the entry for `ownerEoa` plus a status indicating whether the
caller has a usable server wallet id.

#### Parameters

##### user

`unknown`

##### ownerEoa

`string`

#### Returns

[`ResolveOwnerWalletIdOutcome`](#resolveownerwalletidoutcome)

***

### toCandidate()

> **toCandidate**(`raw`): [`WalletCandidate`](#walletcandidate) \| `null`

Defined in: [server/\_lib/wallet/privyOwnerWalletIdResolver.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyOwnerWalletIdResolver.ts#L107)

#### Parameters

##### raw

`any`

#### Returns

[`WalletCandidate`](#walletcandidate) \| `null`
