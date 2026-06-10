[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/useCanonicalSwapWarmup

# src/lib/swap/useCanonicalSwapWarmup

## Type Aliases

### CanonicalSwapWarmupInput

> **CanonicalSwapWarmupInput** = `object`

Defined in: [src/lib/swap/useCanonicalSwapWarmup.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useCanonicalSwapWarmup.ts#L13)

#### Properties

##### canonicalAddress

> **canonicalAddress**: `string` \| `null` \| `undefined`

Defined in: [src/lib/swap/useCanonicalSwapWarmup.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useCanonicalSwapWarmup.ts#L17)

##### enabled

> **enabled**: `boolean`

Defined in: [src/lib/swap/useCanonicalSwapWarmup.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useCanonicalSwapWarmup.ts#L14)

##### executionMode

> **executionMode**: `"canonical"` \| `"eoa"`

Defined in: [src/lib/swap/useCanonicalSwapWarmup.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useCanonicalSwapWarmup.ts#L15)

##### executionReady

> **executionReady**: `boolean`

Defined in: [src/lib/swap/useCanonicalSwapWarmup.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useCanonicalSwapWarmup.ts#L16)

##### publicClient

> **publicClient**: `PublicClientLike` \| `null` \| `undefined`

Defined in: [src/lib/swap/useCanonicalSwapWarmup.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useCanonicalSwapWarmup.ts#L19)

##### signerAddress

> **signerAddress**: `string` \| `null` \| `undefined`

Defined in: [src/lib/swap/useCanonicalSwapWarmup.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useCanonicalSwapWarmup.ts#L18)

## Functions

### useCanonicalSwapWarmup()

> **useCanonicalSwapWarmup**(`input`): `void`

Defined in: [src/lib/swap/useCanonicalSwapWarmup.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useCanonicalSwapWarmup.ts#L26)

Prefetch CSW owner index, native balance, and warm the paymaster proxy while the user
is on /swap so ERC-4337 submit avoids cold RPC/cache misses.

#### Parameters

##### input

[`CanonicalSwapWarmupInput`](#canonicalswapwarmupinput)

#### Returns

`void`
