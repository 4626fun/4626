[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/aa/coinbaseErc4337

# src/lib/aa/coinbaseErc4337

## Type Aliases

### PollUserOperationStatusOptions

> **PollUserOperationStatusOptions** = `object`

Defined in: [src/lib/aa/coinbaseErc4337.ts:687](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L687)

#### Properties

##### maxDurationMs?

> `optional` **maxDurationMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:689](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L689)

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:692](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L692)

###### Parameters

###### error

`Error`

###### Returns

`void`

##### onStatusChange()?

> `optional` **onStatusChange**: (`status`, `txHash?`) => `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:691](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L691)

###### Parameters

###### status

[`UserOpStatus`](#useropstatus)

###### txHash?

`Hex`

###### Returns

`void`

##### perCheckTimeoutMs?

> `optional` **perCheckTimeoutMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:690](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L690)

##### pollIntervalMs?

> `optional` **pollIntervalMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337.ts:688](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L688)

##### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [src/lib/aa/coinbaseErc4337.ts:693](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L693)

***

### PublicClientLike

> **PublicClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:224](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L224)

#### Type Declaration

##### chain

> **chain**: `object`

###### chain.id

> **id**: `number`

##### readContract()

> **readContract**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

***

### UserOpStatus

> **UserOpStatus** = `"pending"` \| `"confirmed"` \| `"failed"` \| `"timeout"`

Defined in: [src/lib/aa/coinbaseErc4337.ts:685](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L685)

***

### WalletClientLike

> **WalletClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:229](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L229)

#### Type Declaration

##### request()

> **request**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### signMessage()?

> `optional` **signMessage**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### signTransaction()?

> `optional` **signTransaction**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### signTypedData()?

> `optional` **signTypedData**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

## Variables

### ERC4337\_ENTRYPOINT\_V06

> `const` **ERC4337\_ENTRYPOINT\_V06**: `string` = `ENTRYPOINT_V06`

Defined in: [src/lib/aa/coinbaseErc4337.ts:724](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L724)

The canonical EntryPoint v0.6 address used by this module.
This is the ONLY EntryPoint version supported.

## Functions

### assertEntryPointV06()

> **assertEntryPointV06**(`address`): `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:730](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L730)

Assert that a given address matches EntryPoint v0.6.
Use this to verify configuration matches expectations.

#### Parameters

##### address

`string`

#### Returns

`void`

***

### clearAllPendingUserOpHashesForWallet()

> **clearAllPendingUserOpHashesForWallet**(`smartWallet`): `void`

Defined in: [src/lib/aa/coinbaseErc4337.ts:546](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L546)

#### Parameters

##### smartWallet

`string`

#### Returns

`void`

***

### deriveEphemeralNonceKey()

> **deriveEphemeralNonceKey**(`ownerIndex`): `bigint`

Defined in: [src/lib/aa/coinbaseErc4337.ts:465](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L465)

Fresh EntryPoint nonce key when the owner-index lane is blocked by AA25.

#### Parameters

##### ownerIndex

`number`

#### Returns

`bigint`

***

### pollCanonicalUserOpTransactionHash()

> **pollCanonicalUserOpTransactionHash**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:2920](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L2920)

#### Parameters

##### params

###### bundlerUrl

`string`

###### maxDurationMs?

`number`

###### onStatusChange?

(`status`, `txHash?`) => `void`

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### signal?

`AbortSignal`

###### userOpHash

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### pollUserOperationStatus()

> **pollUserOperationStatus**(`params`): `Promise`\<\{ `status`: [`UserOpStatus`](#useropstatus); `txHash?`: `` `0x${string}` ``; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:2842](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L2842)

#### Parameters

##### params

###### bundlerClient

`any`

###### options?

[`PollUserOperationStatusOptions`](#polluseroperationstatusoptions)

###### publicClient?

[`PublicClientLike`](#publicclientlike)

###### userOpHash

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `status`: [`UserOpStatus`](#useropstatus); `txHash?`: `` `0x${string}` ``; \}\>

***

### readAnyPendingUserOpHashForWallet()

> **readAnyPendingUserOpHashForWallet**(`smartWallet`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337.ts:530](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L530)

Any in-session pending UserOp for this smart wallet (owner-index lane storage).

#### Parameters

##### smartWallet

`string`

#### Returns

`` `0x${string}` `` \| `null`

***

### readPendingUserOpHash()

> **readPendingUserOpHash**(`smartWallet`, `ownerIndex`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337.ts:503](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L503)

Last submitted UserOp hash for wallet + owner-index nonce lane (browser session).

#### Parameters

##### smartWallet

`string`

##### ownerIndex

`number`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolvePriorPendingUserOpForSubmit()

> **resolvePriorPendingUserOpForSubmit**(`params`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337.ts:518](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L518)

Prior UserOp to wait on before a new canonical swap (Permit2 nonce / on-chain state).
Prefers session storage; falls back to a confirming swap still polling for txHash.

#### Parameters

##### params

###### confirmingUserOpHash?

`string` \| `null`

###### smartWallet

`string`

#### Returns

`` `0x${string}` `` \| `null`

***

### sendCoinbaseSmartWalletUserOperation()

> **sendCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `transactionHash`: `` `0x${string}` `` \| `null`; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:1344](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L1344)

#### Parameters

##### params

###### allowContractSignMessageFallback?

`boolean`

###### allowEoaSignMessageFallback?

`boolean`

###### bundlerUrl

`string`

###### bypassOwnerIndexCache?

`boolean`

###### calls

`object`[]

###### onSubmissionStatus?

(`message`) => `void`

###### ownerAddress

`string`

###### ownerApprovalContext?

\{ `approvalRunId?`: `string` \| `null`; `attempt?`: `number` \| `null`; `customOwnerPolicyToken?`: `string` \| `null`; `executionMode?`: `string` \| `null`; `stage?`: `string` \| `null`; \}

###### ownerApprovalContext.approvalRunId?

`string` \| `null`

###### ownerApprovalContext.attempt?

`number` \| `null`

###### ownerApprovalContext.customOwnerPolicyToken?

`string` \| `null`

###### ownerApprovalContext.executionMode?

`string` \| `null`

###### ownerApprovalContext.stage?

`string` \| `null`

###### ownerIndexLookupAddress?

`string`

###### ownerIndexOverride?

`number`

###### ownerIsContract?

`boolean`

###### paymasterUrl?

`string`

###### preferEphemeralNonceLane?

`boolean`

Use a fresh EntryPoint nonce key instead of ownerIndex (avoids AA25 when a prior
swap UserOp is still in the bundler mempool on the owner-index lane).

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### retryOnInvalidSignature?

`boolean`

###### retryOnPrefund?

`boolean`

###### retryWithLowGasContractSigner?

`boolean`

###### retryWithTypedDataSigning?

`boolean`

###### skipPasskeyOwnerSlotsInProbe?

`boolean`

When true, skip owner index 0 during self-auth CSW probe (WebAuthn passkey slot).

###### skipPaymaster?

`boolean`

###### skipPreflightSimulation?

`boolean`

###### smartWallet

`string`

###### userOpSignMode?

`UserOpSignMode`

###### useTypedDataSigning?

`boolean`

###### verificationGasLimits?

`bigint`[]

###### version?

`"1"` \| `"1.1"`

###### waitForOnChainReceipt?

`boolean`

When false, return after bundler accepts the UserOp; receipt can be polled separately.

###### walletClient

[`WalletClientLike`](#walletclientlike)

#### Returns

`Promise`\<\{ `transactionHash`: `` `0x${string}` `` \| `null`; `userOpHash`: `` `0x${string}` ``; \}\>

***

### simulateSmartWalletCalls()

> **simulateSmartWalletCalls**(`params`): `Promise`\<\{ `directCallResult?`: \{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}; `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:1021](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L1021)

Pre-flight simulation: test if the calls would succeed when executed from the smart wallet.
This helps diagnose whether a UserOp failure is due to:
1. ERC-4337 / signature issues (simulation passes but UserOp fails)
2. Underlying call issues (simulation fails, meaning the contract call itself would revert)

Returns both the smart wallet execute simulation result AND a direct target call simulation.
The direct simulation helps identify if the target contract would revert even with correct msg.sender.

#### Parameters

##### params

###### calls

`object`[]

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### smartWallet

`string`

#### Returns

`Promise`\<\{ `directCallResult?`: \{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}; `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; `success`: `boolean`; \}\>

***

### verifyBundlerSupportsV06()

> **verifyBundlerSupportsV06**(`bundlerUrl`, `options?`): `Promise`\<`void`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:131](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L131)

Verify the bundler supports EntryPoint v0.6.
Throws if the bundler doesn't support v0.6.

#### Parameters

##### bundlerUrl

`string`

##### options?

###### includeCredentials?

`boolean`

###### timeoutMs?

`number`

#### Returns

`Promise`\<`void`\>

***

### waitForEntryPointNonceAdvance()

> **waitForEntryPointNonceAdvance**(`params`): `Promise`\<\{ `advanced`: `boolean`; `nonce`: `bigint`; \}\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:603](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L603)

Poll EntryPoint nonce until it advances past a stuck in-flight UserOp.

#### Parameters

##### params

###### maxWaitMs?

`number`

###### pollIntervalMs?

`number`

###### readNonce

() => `Promise`\<`bigint`\>

###### startingNonce

`bigint`

#### Returns

`Promise`\<\{ `advanced`: `boolean`; `nonce`: `bigint`; \}\>

***

### waitForPriorPendingUserOp()

> **waitForPriorPendingUserOp**(`params`): `Promise`\<`"timeout"` \| `"failed"` \| `"confirmed"`\>

Defined in: [src/lib/aa/coinbaseErc4337.ts:560](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337.ts#L560)

Wait for a prior swap UserOp before signing a new Permit2 payload (nonce must advance on-chain).

#### Parameters

##### params

###### bundlerUrl

`string`

###### maxWaitMs?

`number`

###### onStatus?

(`message`) => `void`

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### userOpHash

`` `0x${string}` ``

#### Returns

`Promise`\<`"timeout"` \| `"failed"` \| `"confirmed"`\>

## References

### fetchCoinbaseSmartWalletOwners

Re-exports [fetchCoinbaseSmartWalletOwners](coinbaseErc4337Owners.md#fetchcoinbasesmartwalletowners)

***

### findCoinbaseSmartWalletOwnerIndex

Re-exports [findCoinbaseSmartWalletOwnerIndex](coinbaseErc4337Owners.md#findcoinbasesmartwalletownerindex)

***

### resetOwnerIndexCacheForTests

Re-exports [resetOwnerIndexCacheForTests](coinbaseErc4337Owners.md#resetownerindexcachefortests)
