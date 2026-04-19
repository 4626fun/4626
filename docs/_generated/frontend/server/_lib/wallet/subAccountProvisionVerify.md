[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/subAccountProvisionVerify

# server/\_lib/wallet/subAccountProvisionVerify

## Type Aliases

### SubAccountVerifyErr

> **SubAccountVerifyErr** = `object`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L75)

#### Properties

##### code

> **code**: [`SubAccountVerifyErrCode`](#subaccountverifyerrcode-1)

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L77)

##### message?

> `optional` **message**: `string`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L78)

##### ok

> **ok**: `false`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L76)

***

### SubAccountVerifyErrCode

> **SubAccountVerifyErrCode** = `"invalid_hash"` \| `"invalid_signature"` \| `"signer_not_owner"` \| `"invalid_spender"` \| `"invalid_caps"` \| `"invalid_token"` \| `"invalid_window"` \| `"permission_not_yet_active"` \| `"permission_expired"` \| `"signature_verification_failed"`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L63)

***

### SubAccountVerifyInput

> **SubAccountVerifyInput** = `object`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L47)

#### Properties

##### dailyCapWei

> **dailyCapWei**: `bigint`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L54)

##### ownerEoa

> **ownerEoa**: `Address`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L49)

##### parentCsw

> **parentCsw**: `Address`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L50)

##### permission

> **permission**: [`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L51)

##### perTxCapWei

> **perTxCapWei**: `bigint`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L53)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L48)

##### signature

> **signature**: `Hex`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L52)

***

### SubAccountVerifyOk

> **SubAccountVerifyOk** = `object`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L57)

#### Properties

##### ok

> **ok**: `true`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L58)

##### permissionHash

> **permissionHash**: `Hex`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L60)

##### subAccountAddress

> **subAccountAddress**: `Address`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L59)

## Variables

### CHAIN\_ID\_BASE

> `const` **CHAIN\_ID\_BASE**: `8453` = `8453`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L28)

***

### MAX\_DAILY\_CAP\_WEI

> `const` **MAX\_DAILY\_CAP\_WEI**: `10000000000000000000n` = `10_000_000_000_000_000_000n`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L31)

***

### MAX\_PER\_TX\_CAP\_WEI

> `const` **MAX\_PER\_TX\_CAP\_WEI**: `1000000000000000000n` = `1_000_000_000_000_000_000n`

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L30)

## Functions

### checkPrivyDelegation()

> **checkPrivyDelegation**(`args`): `Promise`\<\{ `present`: `true`; \} \| \{ `actualSigners`: `string`[]; `present`: `false`; \}\>

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:226](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L226)

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

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L81)

#### Returns

`object`

***

### verifyParentCswSignature()

> **verifyParentCswSignature**(`args`): `Promise`\<\{ `ok`: `true`; \} \| \{ `code`: `"invalid_signature"` \| `"signer_not_owner"` \| `"signature_verification_failed"`; `message?`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L97)

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

`` `0x${string}` ``

###### permission

[`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

###### permissionHash

`` `0x${string}` ``

###### publicClient

\{ \}

###### signature

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `code`: `"invalid_signature"` \| `"signer_not_owner"` \| `"signature_verification_failed"`; `message?`: `string`; `ok`: `false`; \}\>

***

### verifySubAccountProvision()

> **verifySubAccountProvision**(`args`): `Promise`\<[`SubAccountVerifyOk`](#subaccountverifyok) \| [`SubAccountVerifyErr`](#subaccountverifyerr)\>

Defined in: [server/\_lib/wallet/subAccountProvisionVerify.ts:158](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/subAccountProvisionVerify.ts#L158)

Full verification pipeline (hash match, signature, spender correctness, caps,
expiry). Returns a typed ok/err result; callers handle HTTP mapping.
Does NOT enforce Privy delegation — callers decide.

#### Parameters

##### args

[`SubAccountVerifyInput`](#subaccountverifyinput) & `object`

#### Returns

`Promise`\<[`SubAccountVerifyOk`](#subaccountverifyok) \| [`SubAccountVerifyErr`](#subaccountverifyerr)\>
