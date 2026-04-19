[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/userOperationSubmitter

# server/\_lib/wallet/userOperationSubmitter

## Type Aliases

### SubmitUserOpInput

> **SubmitUserOpInput** = `object`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:228](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L228)

#### Properties

##### bundlerUrl?

> `optional` **bundlerUrl**: `string` \| `null`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:245](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L245)

Optional bundler URL override (for tests). If omitted, env is read.

##### calls

> **calls**: [`CoinbaseSmartWalletCall`](privyCoinbaseSmartWallet.md#coinbasesmartwalletcall)[]

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:230](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L230)

##### correlationId?

> `optional` **correlationId**: `string`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:247](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L247)

Optional log correlation id.

##### issuer

> **issuer**: [`CommandIssuerContext`](commandIssuerContext.md#commandissuercontext)

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:229](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L229)

##### publicClient?

> `optional` **publicClient**: `PublicClient` \| `null`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:241](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L241)

Optional pre-constructed viem PublicClient (for tests). If omitted, a
shared Base client is used.

##### simulate?

> `optional` **simulate**: `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:249](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L249)

Passed through to the viem account-abstraction simulator.

##### valueWei

> **valueWei**: `bigint`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:236](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L236)

Total native ETH value that leaves the CSW as a consequence of `calls`.
For native ETH transfers this equals the ETH value of the transfer; for
ERC-20 transfers this is 0. Used for caps + preflight math only.

***

### UserOpRefusal

> **UserOpRefusal** = \{ `alreadySpentWei?`: `bigint`; `code`: `"cap_exceeded"`; `limitWei`: `bigint`; `ok`: `false`; `requestedWei`: `bigint`; `response`: `string`; `scope`: `"per_tx"` \| `"daily"`; \} \| \{ `balanceWei`: `bigint`; `code`: `"insufficient_funds"`; `ok`: `false`; `requiredWei`: `bigint`; `response`: `string`; \} \| \{ `code`: `"bundler_unavailable"`; `ok`: `false`; `response`: `string`; \} \| \{ `code`: `"userop_failed"`; `errorMessage`: `string`; `ok`: `false`; `response`: `string`; `retryable`: `boolean`; \}

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:81](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L81)

***

### UserOpSubmissionResult

> **UserOpSubmissionResult** = [`UserOpSubmissionSuccess`](#useropsubmissionsuccess) \| [`UserOpRefusal`](#useroprefusal)

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:111](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L111)

***

### UserOpSubmissionSuccess

> **UserOpSubmissionSuccess** = `object`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:72](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L72)

#### Properties

##### ok

> **ok**: `true`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:73](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L73)

##### ownerAddress

> **ownerAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:77](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L77)

##### ownerIndex

> **ownerIndex**: `number`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:78](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L78)

##### smartWallet

> **smartWallet**: `` `0x${string}` ``

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:76](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L76)

##### txHash

> **txHash**: `` `0x${string}` ``

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:75](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L75)

##### userOpHash

> **userOpHash**: `` `0x${string}` ``

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:74](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L74)

## Functions

### isArchBCoinBuyViaUserOpEnabled()

> **isArchBCoinBuyViaUserOpEnabled**(): `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:477](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L477)

True iff `ARCH_B_COIN_BUY_VIA_USEROP` is truthy in env.

#### Returns

`boolean`

***

### isArchBCoinSellViaUserOpEnabled()

> **isArchBCoinSellViaUserOpEnabled**(): `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:483](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L483)

True iff `ARCH_B_COIN_SELL_VIA_USEROP` is truthy in env.

#### Returns

`boolean`

***

### isArchBSendViaUserOpEnabled()

> **isArchBSendViaUserOpEnabled**(): `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:471](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L471)

True iff `ARCH_B_SEND_VIA_USEROP` is truthy in env.

#### Returns

`boolean`

***

### resolveBundlerUrl()

> **resolveBundlerUrl**(): `string` \| `null`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:123](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L123)

Resolve the CDP paymaster+bundler URL from env. Matches the priority used
by `xmtpQueueExecutor.ts` so Phase 2 and queue executor stay aligned.
Returns null instead of throwing so the submitter can return a structured
refusal rather than a thrown error.

#### Returns

`string` \| `null`

***

### submitUserOpOrRefuse()

> **submitUserOpOrRefuse**(`input`): `Promise`\<[`UserOpSubmissionResult`](#useropsubmissionresult)\>

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:258](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/userOperationSubmitter.ts#L258)

Submit a UserOperation on the issuer's CSW, gated by caps + preflight.
On any refusal, the caller sees a typed result and should surface the
`response` string to the user. On submission errors mapped to
insufficient-funds, the same friendly refusal is returned.

#### Parameters

##### input

[`SubmitUserOpInput`](#submituseropinput)

#### Returns

`Promise`\<[`UserOpSubmissionResult`](#useropsubmissionresult)\>
