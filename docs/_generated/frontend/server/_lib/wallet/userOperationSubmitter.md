[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/userOperationSubmitter

# server/\_lib/wallet/userOperationSubmitter

## Type Aliases

### SubmitUserOpInput

> **SubmitUserOpInput** = `object`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:254](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L254)

#### Properties

##### bundlerUrl?

> `optional` **bundlerUrl**: `string` \| `null`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:271](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L271)

Optional bundler URL override (for tests). If omitted, env is read.

##### calls

> **calls**: [`CoinbaseSmartWalletCall`](privyCoinbaseSmartWallet.md#coinbasesmartwalletcall)[]

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:256](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L256)

##### correlationId?

> `optional` **correlationId**: `string`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:273](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L273)

Optional log correlation id.

##### issuer

> **issuer**: [`CommandIssuerContext`](commandIssuerContext.md#commandissuercontext)

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:255](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L255)

##### publicClient?

> `optional` **publicClient**: `PublicClient` \| `null`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:267](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L267)

Optional pre-constructed viem PublicClient (for tests). If omitted, a
shared Base client is used.

##### simulate?

> `optional` **simulate**: `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:275](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L275)

Passed through to the viem account-abstraction simulator.

##### valueWei

> **valueWei**: `bigint`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:262](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L262)

Total native ETH value that leaves the CSW as a consequence of `calls`.
For native ETH transfers this equals the ETH value of the transfer; for
ERC-20 transfers this is 0. Used for caps + preflight math only.

***

### UserOpRefusal

> **UserOpRefusal** = \{ `alreadySpentWei?`: `bigint`; `code`: `"cap_exceeded"`; `limitWei`: `bigint`; `ok`: `false`; `requestedWei`: `bigint`; `response`: `string`; `scope`: `"per_tx"` \| `"daily"`; \} \| \{ `balanceWei`: `bigint`; `code`: `"insufficient_funds"`; `ok`: `false`; `requiredWei`: `bigint`; `response`: `string`; \} \| \{ `code`: `"bundler_unavailable"`; `ok`: `false`; `response`: `string`; \} \| \{ `code`: `"userop_failed"`; `errorMessage`: `string`; `ok`: `false`; `response`: `string`; `retryable`: `boolean`; \} \| \{ `code`: `"sub_account_feature_disabled"`; `ok`: `false`; `response`: `string`; \} \| \{ `code`: `"sub_account_spend_permission_revoked"`; `ok`: `false`; `response`: `string`; \} \| \{ `code`: `"sub_account_spend_permission_expired"`; `ok`: `false`; `response`: `string`; \} \| \{ `balanceWei`: `bigint`; `code`: `"sub_account_parent_insufficient_funds"`; `ok`: `false`; `requiredWei`: `bigint`; `response`: `string`; \}

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L85)

***

### UserOpSubmissionResult

> **UserOpSubmissionResult** = [`UserOpSubmissionSuccess`](#useropsubmissionsuccess) \| [`UserOpRefusal`](#useroprefusal)

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L137)

***

### UserOpSubmissionSuccess

> **UserOpSubmissionSuccess** = `object`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L76)

#### Properties

##### ok

> **ok**: `true`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L77)

##### ownerAddress

> **ownerAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L81)

##### ownerIndex

> **ownerIndex**: `number`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L82)

##### smartWallet

> **smartWallet**: `` `0x${string}` ``

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L80)

##### txHash

> **txHash**: `` `0x${string}` ``

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L79)

##### userOpHash

> **userOpHash**: `` `0x${string}` ``

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L78)

## Functions

### isArchBCoinBuyViaUserOpEnabled()

> **isArchBCoinBuyViaUserOpEnabled**(): `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:610](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L610)

True iff `ARCH_B_COIN_BUY_VIA_USEROP` is truthy in env.

#### Returns

`boolean`

***

### isArchBCoinSellViaUserOpEnabled()

> **isArchBCoinSellViaUserOpEnabled**(): `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:616](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L616)

True iff `ARCH_B_COIN_SELL_VIA_USEROP` is truthy in env.

#### Returns

`boolean`

***

### isArchBSendViaUserOpEnabled()

> **isArchBSendViaUserOpEnabled**(): `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:591](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L591)

True iff `ARCH_B_SEND_VIA_USEROP` is truthy in env.

#### Returns

`boolean`

***

### isArchBSubAccountsEnabled()

> **isArchBSubAccountsEnabled**(): `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:604](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L604)

True iff `ARCH_B_SUB_ACCOUNTS_ENABLED` is truthy in env.

When off (default), sub-account issuer rows are refused with
`sub_account_feature_disabled` — preserving the invariant that a
mis-provisioned row never silently falls back to the legacy direct-CSW path.
Legacy rows (subAccount === null) are unaffected by this flag.

#### Returns

`boolean`

***

### isArchBTrendReserveViaUserOpEnabled()

> **isArchBTrendReserveViaUserOpEnabled**(): `boolean`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:627](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L627)

True iff `ARCH_B_TREND_RESERVE_VIA_USEROP` is truthy in env.

When on, `/coin trend reserve` routes the TrendCoin deploy through the
command issuer's CSW via `submitUserOpOrRefuse` (Arch B Phase 4) instead
of the legacy Privy-managed agent EOA path.

#### Returns

`boolean`

***

### resolveBundlerUrl()

> **resolveBundlerUrl**(): `string` \| `null`

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:149](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L149)

Resolve the CDP paymaster+bundler URL from env. Matches the priority used
by `xmtpQueueExecutor.ts` so Phase 2 and queue executor stay aligned.
Returns null instead of throwing so the submitter can return a structured
refusal rather than a thrown error.

#### Returns

`string` \| `null`

***

### submitUserOpOrRefuse()

> **submitUserOpOrRefuse**(`input`): `Promise`\<[`UserOpSubmissionResult`](#useropsubmissionresult)\>

Defined in: [server/\_lib/wallet/userOperationSubmitter.ts:284](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/userOperationSubmitter.ts#L284)

Submit a UserOperation on the issuer's CSW, gated by caps + preflight.
On any refusal, the caller sees a typed result and should surface the
`response` string to the user. On submission errors mapped to
insufficient-funds, the same friendly refusal is returned.

#### Parameters

##### input

[`SubmitUserOpInput`](#submituseropinput)

#### Returns

`Promise`\<[`UserOpSubmissionResult`](#useropsubmissionresult)\>
