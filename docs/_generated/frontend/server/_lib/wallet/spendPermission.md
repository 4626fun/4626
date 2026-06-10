[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/spendPermission

# server/\_lib/wallet/spendPermission

## Variables

### NATIVE\_TOKEN\_SENTINEL

> `const` **NATIVE\_TOKEN\_SENTINEL**: `Address` = `'0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'`

Defined in: [server/\_lib/wallet/spendPermission.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L31)

Sentinel address for native ETH in the SpendPermissionManager spec.
Matches Coinbase's canonical constant.

***

### SPEND\_PERMISSION\_MANAGER\_BASE

> `const` **SPEND\_PERMISSION\_MANAGER\_BASE**: `Address` = `'0xf85210B21cC50302F477BA56686d2019dC9b67Ad'`

Defined in: [server/\_lib/wallet/spendPermission.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L24)

SpendPermissionManager singleton, deployed on Base mainnet.

***

### SPEND\_PERMISSION\_MANAGER\_NAME

> `const` **SPEND\_PERMISSION\_MANAGER\_NAME**: `"Spend Permission Manager"` = `'Spend Permission Manager'`

Defined in: [server/\_lib/wallet/spendPermission.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L34)

***

### SPEND\_PERMISSION\_MANAGER\_VERSION

> `const` **SPEND\_PERMISSION\_MANAGER\_VERSION**: `"1"` = `'1'`

Defined in: [server/\_lib/wallet/spendPermission.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L35)

***

### SPEND\_PERMISSION\_TYPES

> `const` **SPEND\_PERMISSION\_TYPES**: `object`

Defined in: [server/\_lib/wallet/spendPermission.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L37)

#### Type Declaration

##### SpendPermission

> `readonly` **SpendPermission**: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}, \{ `name`: `"spender"`; `type`: `"address"`; \}, \{ `name`: `"token"`; `type`: `"address"`; \}, \{ `name`: `"allowance"`; `type`: `"uint160"`; \}, \{ `name`: `"period"`; `type`: `"uint48"`; \}, \{ `name`: `"start"`; `type`: `"uint48"`; \}, \{ `name`: `"end"`; `type`: `"uint48"`; \}, \{ `name`: `"salt"`; `type`: `"uint256"`; \}, \{ `name`: `"extraData"`; `type`: `"bytes"`; \}\]

***

### spendPermissionManagerAbi

> `const` **spendPermissionManagerAbi**: readonly \[\{ `inputs`: readonly \[\{ `components`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}, \{ `name`: `"spender"`; `type`: `"address"`; \}, \{ `name`: `"token"`; `type`: `"address"`; \}, \{ `name`: `"allowance"`; `type`: `"uint160"`; \}, \{ `name`: `"period"`; `type`: `"uint48"`; \}, \{ `name`: `"start"`; `type`: `"uint48"`; \}, \{ `name`: `"end"`; `type`: `"uint48"`; \}, \{ `name`: `"salt"`; `type`: `"uint256"`; \}, \{ `name`: `"extraData"`; `type`: `"bytes"`; \}\]; `name`: `"permission"`; `type`: `"tuple"`; \}, \{ `name`: `"signature"`; `type`: `"bytes"`; \}\]; `name`: `"approveWithSignature"`; `outputs`: readonly \[\{ `type`: `"bool"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `components`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}, \{ `name`: `"spender"`; `type`: `"address"`; \}, \{ `name`: `"token"`; `type`: `"address"`; \}, \{ `name`: `"allowance"`; `type`: `"uint160"`; \}, \{ `name`: `"period"`; `type`: `"uint48"`; \}, \{ `name`: `"start"`; `type`: `"uint48"`; \}, \{ `name`: `"end"`; `type`: `"uint48"`; \}, \{ `name`: `"salt"`; `type`: `"uint256"`; \}, \{ `name`: `"extraData"`; `type`: `"bytes"`; \}\]; `name`: `"permission"`; `type`: `"tuple"`; \}, \{ `name`: `"value"`; `type`: `"uint160"`; \}\]; `name`: `"spend"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `components`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}, \{ `name`: `"spender"`; `type`: `"address"`; \}, \{ `name`: `"token"`; `type`: `"address"`; \}, \{ `name`: `"allowance"`; `type`: `"uint160"`; \}, \{ `name`: `"period"`; `type`: `"uint48"`; \}, \{ `name`: `"start"`; `type`: `"uint48"`; \}, \{ `name`: `"end"`; `type`: `"uint48"`; \}, \{ `name`: `"salt"`; `type`: `"uint256"`; \}, \{ `name`: `"extraData"`; `type`: `"bytes"`; \}\]; `name`: `"permission"`; `type`: `"tuple"`; \}\]; `name`: `"isApproved"`; `outputs`: readonly \[\{ `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `components`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}, \{ `name`: `"spender"`; `type`: `"address"`; \}, \{ `name`: `"token"`; `type`: `"address"`; \}, \{ `name`: `"allowance"`; `type`: `"uint160"`; \}, \{ `name`: `"period"`; `type`: `"uint48"`; \}, \{ `name`: `"start"`; `type`: `"uint48"`; \}, \{ `name`: `"end"`; `type`: `"uint48"`; \}, \{ `name`: `"salt"`; `type`: `"uint256"`; \}, \{ `name`: `"extraData"`; `type`: `"bytes"`; \}\]; `name`: `"permission"`; `type`: `"tuple"`; \}\]; `name`: `"getCurrentPeriodSpend"`; `outputs`: readonly \[\{ `components`: readonly \[\{ `name`: `"start"`; `type`: `"uint48"`; \}, \{ `name`: `"end"`; `type`: `"uint48"`; \}, \{ `name`: `"spend"`; `type`: `"uint160"`; \}\]; `type`: `"tuple"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [server/\_lib/wallet/spendPermission.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L84)

## Functions

### buildSpendPermissionCalls()

> **buildSpendPermissionCalls**(`args`): [`CoinbaseSmartWalletCall`](privyCoinbaseSmartWallet.md#coinbasesmartwalletcall)[]

Defined in: [server/\_lib/wallet/spendPermission.ts:189](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L189)

Build the SpendPermissionManager calls to prepend to a sub-account UserOp.
When the permission has not yet been approved on-chain, we first call
`approveWithSignature(permission, signature)`, then `spend(permission,
amount)`. The manager short-circuits `approveWithSignature` when the
permission is already approved, so including it is harmless — we rely on
this property when `isSpendPermissionApproved` fails-open (returns false).

The `spend(...)` call is skipped when `amountWei === 0n` because
`SpendPermissionManager.spend` reverts with `ZeroValue` on a zero amount.
ERC-20 sends, sells, trend-reserve ops — any userop with no native ETH
value — must not prepend a `spend(0)` call. `approveWithSignature` is still
emitted when not approved so first-time sub-accounts can register the
permission even when the triggering op carries zero value.

#### Parameters

##### args

###### amountWei

`bigint`

###### isApprovedOnChain

`boolean`

###### permission

[`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

###### signature

`` `0x${string}` ``

#### Returns

[`CoinbaseSmartWalletCall`](privyCoinbaseSmartWallet.md#coinbasesmartwalletcall)[]

***

### encodeSpendPermissionSpendCall()

> **encodeSpendPermissionSpendCall**(`args`): [`CoinbaseSmartWalletCall`](privyCoinbaseSmartWallet.md#coinbasesmartwalletcall)

Defined in: [server/\_lib/wallet/spendPermission.ts:227](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L227)

Back-compat single-call encoder used by earlier Phase 5 drafts. Prefer
`buildSpendPermissionCalls` for new callers — it handles the
approve-first-then-spend transition atomically.

#### Parameters

##### args

###### amountWei

`bigint`

###### manager

`string`

###### permission

[`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

###### signature

`` `0x${string}` ``

#### Returns

[`CoinbaseSmartWalletCall`](privyCoinbaseSmartWallet.md#coinbasesmartwalletcall)

***

### hashSpendPermission()

> **hashSpendPermission**(`permission`, `chainId`): `` `0x${string}` ``

Defined in: [server/\_lib/wallet/spendPermission.ts:161](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L161)

EIP-712 hash for dedupe / on-chain identity.

#### Parameters

##### permission

[`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

##### chainId

`number`

#### Returns

`` `0x${string}` ``

***

### isSpendPermissionApproved()

> **isSpendPermissionApproved**(`args`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/wallet/spendPermission.ts:251](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L251)

Read-only check: has the manager recorded approval for this permission?
Callers should fail-open: on RPC error, assume not approved and include the
`approveWithSignature` call. The manager short-circuits if it's already
approved, so this is safe.

#### Parameters

##### args

###### permission

[`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

###### publicClient

\{ \}

#### Returns

`Promise`\<`boolean`\>

***

### SPEND\_PERMISSION\_EIP712\_DOMAIN()

> **SPEND\_PERMISSION\_EIP712\_DOMAIN**(`chainId`): `object`

Defined in: [server/\_lib/wallet/spendPermission.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/spendPermission.ts#L51)

#### Parameters

##### chainId

`number`

#### Returns

`object`

##### chainId

> **chainId**: `number`

##### name

> **name**: `string`

##### verifyingContract

> **verifyingContract**: `string`

##### version

> **version**: `string`
