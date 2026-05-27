[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useVault

# src/hooks/useVault

## Functions

### useVault()

> **useVault**(`vaultAddress`): `object`

Defined in: [src/hooks/useVault.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useVault.ts#L18)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`object`

##### approveTxHash

> **approveTxHash**: `` `0x${string}` `` \| `undefined`

##### asset

> **asset**: `string` \| `undefined`

##### depositTxHash

> **depositTxHash**: `` `0x${string}` `` \| `undefined`

##### formatAmount()

> **formatAmount**: (`value`, `decimals`) => `string`

###### Parameters

###### value

`bigint` | `undefined`

###### decimals

`number` = `18`

###### Returns

`string`

##### handleApprove()

> **handleApprove**: (`amount`, `decimals`) => `void`

###### Parameters

###### amount

`string`

###### decimals

`number` = `18`

###### Returns

`void`

##### handleDeposit()

> **handleDeposit**: (`amount`, `decimals`) => `void`

###### Parameters

###### amount

`string`

###### decimals

`number` = `18`

###### Returns

`void`

##### handleWithdraw()

> **handleWithdraw**: (`amount`, `decimals`) => `void`

###### Parameters

###### amount

`string`

###### decimals

`number` = `18`

###### Returns

`void`

##### isApproveConfirming

> **isApproveConfirming**: `boolean`

##### isApproveSuccess

> **isApproveSuccess**: `boolean`

##### isApproving

> **isApproving**: `boolean`

##### isDepositConfirming

> **isDepositConfirming**: `boolean`

##### isDepositing

> **isDepositing**: `boolean`

##### isDepositSuccess

> **isDepositSuccess**: `boolean`

##### isWithdrawConfirming

> **isWithdrawConfirming**: `boolean`

##### isWithdrawing

> **isWithdrawing**: `boolean`

##### isWithdrawSuccess

> **isWithdrawSuccess**: `boolean`

##### name

> **name**: `string` \| `undefined`

##### needsApproval()

> **needsApproval**: (`amount`, `decimals`) => `boolean`

###### Parameters

###### amount

`string`

###### decimals

`number` = `18`

###### Returns

`boolean`

##### refetchAll()

> **refetchAll**: () => `void`

###### Returns

`void`

##### resetApprove()

> **resetApprove**: () => `void`

###### Returns

`void`

##### resetDeposit()

> **resetDeposit**: () => `void`

###### Returns

`void`

##### resetWithdraw()

> **resetWithdraw**: () => `void`

###### Returns

`void`

##### symbol

> **symbol**: `string` \| `undefined`

##### tokenAllowance

> **tokenAllowance**: `bigint` \| `undefined`

##### tokenBalance

> **tokenBalance**: `bigint` \| `undefined`

##### totalAssets

> **totalAssets**: `bigint` \| `undefined`

##### totalSupply

> **totalSupply**: `bigint` \| `undefined`

##### userAssets

> **userAssets**: `bigint` \| `undefined`

##### userShares

> **userShares**: `bigint` \| `undefined`

##### withdrawTxHash

> **withdrawTxHash**: `` `0x${string}` `` \| `undefined`
