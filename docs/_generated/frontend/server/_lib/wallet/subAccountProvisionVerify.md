[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/subAccountProvisionVerify

# server/\_lib/wallet/subAccountProvisionVerify

## Type Aliases

### SubAccountVerifyErr

> **SubAccountVerifyErr** = `object`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L76)

#### Properties

##### code

> **code**: [`SubAccountVerifyErrCode`](#subaccountverifyerrcode-1)

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L78)

##### message?

> `optional` **message**: `string`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L79)

##### ok

> **ok**: `false`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L77)

***

### SubAccountVerifyErrCode

> **SubAccountVerifyErrCode** = `"invalid_hash"` \| `"invalid_signature"` \| `"signer_not_owner"` \| `"invalid_parent_account"` \| `"invalid_spender"` \| `"invalid_caps"` \| `"invalid_token"` \| `"invalid_window"` \| `"permission_not_yet_active"` \| `"permission_expired"` \| `"signature_verification_failed"`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L63)

***

### SubAccountVerifyInput

> **SubAccountVerifyInput** = `object`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L47)

#### Properties

##### dailyCapWei

> **dailyCapWei**: `bigint`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L54)

##### ownerEoa

> **ownerEoa**: `Address`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L49)

##### parentCsw

> **parentCsw**: `Address`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L50)

##### permission

> **permission**: [`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L51)

##### perTxCapWei

> **perTxCapWei**: `bigint`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L53)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L48)

##### signature

> **signature**: `Hex`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L52)

***

### SubAccountVerifyOk

> **SubAccountVerifyOk** = `object`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L57)

#### Properties

##### ok

> **ok**: `true`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L58)

##### permissionHash

> **permissionHash**: `Hex`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L60)

##### subAccountAddress

> **subAccountAddress**: `Address`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L59)

## Variables

### CHAIN\_ID\_BASE

> `const` **CHAIN\_ID\_BASE**: `8453` = `8453`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L28)

***

### MAX\_DAILY\_CAP\_WEI

> `const` **MAX\_DAILY\_CAP\_WEI**: `10000000000000000000n` = `10_000_000_000_000_000_000n`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L31)

***

### MAX\_PER\_TX\_CAP\_WEI

> `const` **MAX\_PER\_TX\_CAP\_WEI**: `1000000000000000000n` = `1_000_000_000_000_000_000n`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L30)

## Functions

### checkPrivyDelegation()

> **checkPrivyDelegation**(`args`): `Promise`\<\{ `present`: `true`; \} \| \{ `actualSigners`: `string`[]; `present`: `false`; \}\>

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:301](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L301)

Verify Privy delegation: the owner EOA's Privy wallet must include the
Architecture B signer quorum in its `additional_signers`. Returns `missing`
when delegation is not present so callers can either reject (user endpoint)
or warn-and-continue (admin endpoint).

#### Parameters

##### args

###### privyOwnerWalletId

`string`

###### quorumId

`string`

#### Returns

`Promise`\<\{ `present`: `true`; \} \| \{ `actualSigners`: `string`[]; `present`: `false`; \}\>

***

### getBasePublicClient()

> **getBasePublicClient**(): `object`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L82)

#### Returns

`object`

***

### hasContractBytecode()

> **hasContractBytecode**(`bytecode`): `boolean`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L87)

#### Parameters

##### bytecode

`` `0x${string}` `` | `null` | `undefined`

#### Returns

`boolean`

***

### isContractAddressByBytecode()

> **isContractAddressByBytecode**(`args`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L91)

#### Parameters

##### args

###### address

`string`

###### publicClient

\{ \}

#### Returns

`Promise`\<`boolean`\>

***

### verifyParentCswSignature()

> **verifyParentCswSignature**(`args`): `Promise`\<\{ `ok`: `true`; \} \| \{ `code`: `"invalid_signature"` \| `"signer_not_owner"` \| `"invalid_parent_account"` \| `"signature_verification_failed"`; `message?`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:110](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L110)

Confirm the supplied signature was produced by an authorized signer of the
parent CSW over the given EIP-712 permission payload.

 1. EOA path: recover address via `recoverTypedDataAddress` and check it is
    currently an owner of `permission.account` via the CSW's owner scan.
 2. ERC-1271 path: fall back to calling `isValidSignature(hash, signature)`
    on the parent CSW. Accept the standard magic value `0x1626ba7e`.

Either path is sufficient; we try EOA first because it is cheap.

#### Parameters

##### args

###### parentCsw

`string`

###### permission

[`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

###### permissionHash

`` `0x${string}` ``

###### publicClient

\{ \}

###### signature

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `code`: `"invalid_signature"` \| `"signer_not_owner"` \| `"invalid_parent_account"` \| `"signature_verification_failed"`; `message?`: `string`; `ok`: `false`; \}\>

***

### verifySubAccountProvision()

> **verifySubAccountProvision**(`args`): `Promise`\<[`SubAccountVerifyOk`](#subaccountverifyok) \| [`SubAccountVerifyErr`](#subaccountverifyerr)\>

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:233](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L233)

Full verification pipeline (hash match, signature, spender correctness, caps,
expiry). Returns a typed ok/err result; callers handle HTTP mapping.
Does NOT enforce Privy delegation — callers decide.

#### Parameters

##### args

[`SubAccountVerifyInput`](#subaccountverifyinput) & `object`

#### Returns

`Promise`\<[`SubAccountVerifyOk`](#subaccountverifyok) \| [`SubAccountVerifyErr`](#subaccountverifyerr)\>
