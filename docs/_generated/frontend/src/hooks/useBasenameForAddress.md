[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useBasenameForAddress

# src/hooks/useBasenameForAddress

## Type Aliases

### BasenameResult

> **BasenameResult** = `object`

Defined in: [src/hooks/useBasenameForAddress.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useBasenameForAddress.ts#L19)

Cached, component-friendly wrapper over `getBasenameProfile`. Exposes
just what the identity card needs — name + avatar URL + loading
state. The underlying library already memoizes per (address, chainId)
so hitting this hook from multiple components doesn't refetch.

Resolution order inside `getBasenameProfile`:
  1. Base L2 reverse resolver -> basename (e.g. `akita.base.eth`)
  2. Mainnet ENS reverse resolver -> ENS (e.g. `akita.eth`)
  3. Null when nothing resolves

#### Properties

##### avatar

> **avatar**: `string` \| `null`

Defined in: [src/hooks/useBasenameForAddress.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useBasenameForAddress.ts#L25)

Avatar URL from the name's text records, or null.

##### displayName

> **displayName**: `string` \| `null`

Defined in: [src/hooks/useBasenameForAddress.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useBasenameForAddress.ts#L23)

Display form — usually same as `name` but can be pre-formatted.

##### loading

> **loading**: `boolean`

Defined in: [src/hooks/useBasenameForAddress.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useBasenameForAddress.ts#L26)

##### name

> **name**: `string` \| `null`

Defined in: [src/hooks/useBasenameForAddress.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useBasenameForAddress.ts#L21)

Resolved name with `.base.eth` / `.eth` suffix, or null.

## Functions

### prefetchBasenameForAddresses()

> **prefetchBasenameForAddresses**(`addresses`): `void`

Defined in: [src/hooks/useBasenameForAddress.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useBasenameForAddress.ts#L65)

Warm the session cache as soon as wallet addresses are known (e.g. at app launch).

#### Parameters

##### addresses

(`string` \| `null` \| `undefined`)[]

#### Returns

`void`

***

### useBasenameForAddress()

> **useBasenameForAddress**(`address`): [`BasenameResult`](#basenameresult)

Defined in: [src/hooks/useBasenameForAddress.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useBasenameForAddress.ts#L72)

#### Parameters

##### address

`string` | `null` | `undefined`

#### Returns

[`BasenameResult`](#basenameresult)
