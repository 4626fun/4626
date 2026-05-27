[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/cswSendCalls

# src/lib/wallet/cswSendCalls

## Type Aliases

### CswSendCallsTelemetry

> **CswSendCallsTelemetry** = `object`

Defined in: [src/lib/wallet/cswSendCalls.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L37)

#### Properties

##### detail

> **detail**: `unknown`

Defined in: [src/lib/wallet/cswSendCalls.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L46)

##### step

> **step**: `"preflight"` \| `"prompt_sign"` \| `"broadcast_success"` \| `"broadcast_error"` \| `"status_poll"` \| `"status_resolved"` \| `"status_timeout"`

Defined in: [src/lib/wallet/cswSendCalls.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L38)

***

### SendCallsCall

> **SendCallsCall** = `object`

Defined in: [src/lib/wallet/cswSendCalls.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L53)

One EIP-5792 call entry. Mirrors the shape the backend preview handler
returns and the shape EIP-5792 wallets accept in wallet_sendCalls.calls[].

#### Properties

##### data

> **data**: `Hex`

Defined in: [src/lib/wallet/cswSendCalls.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L55)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/wallet/cswSendCalls.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L54)

##### value?

> `optional` **value**: `bigint` \| `` `0x${string}` ``

Defined in: [src/lib/wallet/cswSendCalls.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L60)

Native value to send with this specific call. Accepts either a bigint
(which we'll hex-encode here) or a pre-hex-encoded string. Defaults to 0.

***

### SubmitViaSendCallsParams

> **SubmitViaSendCallsParams** = `object`

Defined in: [src/lib/wallet/cswSendCalls.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L63)

#### Properties

##### atomicRequired?

> `optional` **atomicRequired**: `boolean`

Defined in: [src/lib/wallet/cswSendCalls.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L87)

Optional. Defaults to true so Base App treats the calls as a single bundle.

##### calls

> **calls**: [`SendCallsCall`](#sendcallscall)[]

Defined in: [src/lib/wallet/cswSendCalls.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L83)

Ordered list of calls to dispatch in this single wallet_sendCalls. For
the two-part Relay owner-mutation flow this is exactly 2 entries:

  [0] depositNative → RelayDepository (Part 1, pre-fund)
  [1] removeOwnerAtIndex → CSW          (Part 2, mutation)

EIP-5792 wallets either bundle both into one UserOp's executeBatch OR
submit them as two sequential UserOps in the same block; either is
fine because the on-chain outcome matches the May 5 reference flow.

##### chainId

> **chainId**: `number`

Defined in: [src/lib/wallet/cswSendCalls.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L85)

Target chain id. Currently Base mainnet (8453).

##### csw

> **csw**: `` `0x${string}` ``

Defined in: [src/lib/wallet/cswSendCalls.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L71)

The CSW address (used as `from` in the EIP-5792 payload).

##### onTelemetry()?

> `optional` **onTelemetry**: (`event`) => `void`

Defined in: [src/lib/wallet/cswSendCalls.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L88)

###### Parameters

###### event

[`CswSendCallsTelemetry`](#cswsendcallstelemetry)

###### Returns

`void`

##### walletRequest()

> **walletRequest**: (`args`) => `Promise`\<`unknown`\>

Defined in: [src/lib/wallet/cswSendCalls.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L69)

Wallet provider RPC bridge. For Base App self-auth sessions this is the
Base App wallet's request bridge; for external-signer sessions it's the
connected wallet (Privy / WalletConnect / etc.).

###### Parameters

###### args

###### method

`string`

###### params?

`unknown`[]

###### Returns

`Promise`\<`unknown`\>

***

### WaitForCallsTxHashParams

> **WaitForCallsTxHashParams** = `object`

Defined in: [src/lib/wallet/cswSendCalls.ts:225](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L225)

#### Properties

##### callBundleId

> **callBundleId**: `string`

Defined in: [src/lib/wallet/cswSendCalls.ts:227](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L227)

##### intervalMs?

> `optional` **intervalMs**: `number`

Defined in: [src/lib/wallet/cswSendCalls.ts:231](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L231)

Interval between polls in ms. Defaults to 1500.

##### onTelemetry()?

> `optional` **onTelemetry**: (`event`) => `void`

Defined in: [src/lib/wallet/cswSendCalls.ts:232](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L232)

###### Parameters

###### event

[`CswSendCallsTelemetry`](#cswsendcallstelemetry)

###### Returns

`void`

##### timeoutMs?

> `optional` **timeoutMs**: `number`

Defined in: [src/lib/wallet/cswSendCalls.ts:229](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L229)

Total wait budget in ms. Defaults to 60_000.

##### walletRequest()

> **walletRequest**: (`args`) => `Promise`\<`unknown`\>

Defined in: [src/lib/wallet/cswSendCalls.ts:226](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L226)

###### Parameters

###### args

###### method

`string`

###### params?

`unknown`[]

###### Returns

`Promise`\<`unknown`\>

## Functions

### \_submitOwnerViaSendCalls()

> **\_submitOwnerViaSendCalls**(`params`): `Promise`\<\{ `callBundleId`: `string`; \}\>

Defined in: [src/lib/wallet/cswSendCalls.ts:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L101)

#### Parameters

##### params

[`SubmitViaSendCallsParams`](#submitviasendcallsparams)

#### Returns

`Promise`\<\{ `callBundleId`: `string`; \}\>

***

### waitForCallsTxHash()

> **waitForCallsTxHash**(`params`): `Promise`\<\{ `rawStatus`: `unknown`; `transactionHash`: `` `0x${string}` `` \| `null`; \}\>

Defined in: [src/lib/wallet/cswSendCalls.ts:264](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/cswSendCalls.ts#L264)

Poll `wallet_getCallsStatus` until the wallet reports at least one receipt
with a real `transactionHash`, then resolve. Returns null on timeout so the
caller can fall back to surfacing the bundle id without a broken explorer
link.

Why we need this: `wallet_sendCalls` returns a call-bundle id (not a tx
hash). EIP-5792 wallets may batch multiple users' calls into a single
on-chain tx, so the bundle id is opaque until the wallet schedules and
broadcasts the underlying tx. Building a Basescan `/tx/<id>` link from the
bundle id produces a broken explorer URL.

Wallet return shapes we handle:

  1. EIP-5792 current spec: `{ version, id, chainId, status: number,
     atomic, receipts: [{ status: number, transactionHash, blockHash,
     blockNumber, gasUsed, logs }] }`. `status` is a 3-digit code:
     100 = pending, 200 = confirmed (atomic), 400/500 = error.

  2. Pre-spec Coinbase shape: `{ status: 'PENDING' | 'CONFIRMED' |
     'FAILED', receipts: [{ transactionHash, ... }] }`.

  3. Hybrid / partial: only `status` is set, no `receipts` yet. We treat
     that as "keep polling".

We resolve as soon as we see a non-empty `receipts[].transactionHash`,
regardless of confirmation status, so the user can click through to
Basescan and watch confirmation themselves.

#### Parameters

##### params

[`WaitForCallsTxHashParams`](#waitforcallstxhashparams)

#### Returns

`Promise`\<\{ `rawStatus`: `unknown`; `transactionHash`: `` `0x${string}` `` \| `null`; \}\>
