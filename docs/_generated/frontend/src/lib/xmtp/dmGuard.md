[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/dmGuard

# src/lib/xmtp/dmGuard

## Functions

### normalizeDmGuardAddress()

> **normalizeDmGuardAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/xmtp/dmGuard.ts:1](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/dmGuard.ts#L1)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`` `0x${string}` `` \| `null`

***

### shouldBlockSelfDm()

> **shouldBlockSelfDm**(`params`): `boolean`

Defined in: [src/lib/xmtp/dmGuard.ts:7](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/dmGuard.ts#L7)

#### Parameters

##### params

###### identityAddress

`string` \| `null` \| `undefined`

###### peerAddress

`string` \| `null` \| `undefined`

#### Returns

`boolean`
