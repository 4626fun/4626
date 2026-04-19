[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/walletBalancePreflight

# server/\_lib/wallet/walletBalancePreflight

## Type Aliases

### PreflightOutcome

> **PreflightOutcome** = \{ `balanceWei`: `bigint`; `requiredWei`: `bigint`; `sufficient`: `true`; \} \| \{ `balanceWei`: `bigint`; `message`: `string`; `reason`: `"insufficient_funds"`; `requiredWei`: `bigint`; `sufficient`: `false`; \}

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L49)

***

### PreflightResult

> **PreflightResult** = [`PreflightOutcome`](#preflightoutcome) \| [`PreflightSkipped`](#preflightskipped)

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:69](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L69)

***

### PreflightSkipped

> **PreflightSkipped** = `object`

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L63)

#### Properties

##### error

> **error**: `unknown`

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L66)

##### reason

> **reason**: `"balance_lookup_failed"`

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L65)

##### sufficient

> **sufficient**: `null`

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L64)

***

### PublicClientLike

> **PublicClientLike** = `object`

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L71)

#### Properties

##### getBalance()

> **getBalance**: (`args`) => `Promise`\<`bigint`\>

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L72)

###### Parameters

###### args

###### address

`Address`

###### blockTag?

`"latest"` \| `"pending"`

###### Returns

`Promise`\<`bigint`\>

## Variables

### DEFAULT\_GAS\_BUFFER\_WEI

> `const` **DEFAULT\_GAS\_BUFFER\_WEI**: `bigint`

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L47)

Hard floor. If `wallet.balance < requiredValue + GAS_BUFFER_WEI`, refuse.

Calibrated to ~300k gas at 10 gwei. 1 gwei = 1e9 wei, so 10 gwei = 1e10 wei,
giving a buffer of 3e15 wei (~0.003 ETH). Previously this constant used 1e7
(0.01 gwei), which under-reserved the buffer by 1000x and let wallets with
only a few micro-ETH pass preflight and still fail inside Privy.

## Functions

### buildInsufficientFundsRefusal()

> **buildInsufficientFundsRefusal**(`params`): `string`

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L127)

Friendly user-facing refusal string. Avoids raw Privy/wei jargon.
Wei values are included for logs but the message itself is user-safe.

#### Parameters

##### params

###### balanceWei

`bigint`

###### requiredWei

`bigint`

#### Returns

`string`

***

### checkWalletBalancePreflight()

> **checkWalletBalancePreflight**(`params`): `Promise`\<[`PreflightResult`](#preflightresult)\>

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L90)

Check whether `wallet` has enough native ETH to cover `valueWei` plus a
conservative gas buffer. Returns a structured outcome. On RPC failure,
returns `balance_lookup_failed` — callers should log and proceed (fail-open).

#### Parameters

##### params

###### gasBufferWei?

`bigint`

###### publicClient

[`PublicClientLike`](#publicclientlike)

###### valueWei

`bigint`

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<[`PreflightResult`](#preflightresult)\>

***

### getBasePreflightPublicClient()

> **getBasePreflightPublicClient**(): [`PublicClientLike`](#publicclientlike)

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L80)

Shared Base public client for balance preflight reads. Callers may pass
their own client to `checkWalletBalancePreflight`; this factory is a
convenience for paths that don't already have one.

#### Returns

[`PublicClientLike`](#publicclientlike)

***

### isInsufficientFundsError()

> **isInsufficientFundsError**(`error`): `boolean`

Defined in: [server/\_lib/wallet/walletBalancePreflight.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletBalancePreflight.ts#L147)

Detect whether an error thrown from `walletRpc` (or any downstream
submission path) looks like an insufficient-funds failure, so we can map
it to the same friendly refusal even if preflight missed it (e.g. when
preflight was skipped due to RPC failure, or when gas estimation inside
Privy produced a higher requirement than our buffer).

Substrings are lowercased-compared against the error message to stay
tolerant of Privy's exact phrasing across versions.

#### Parameters

##### error

`unknown`

#### Returns

`boolean`
