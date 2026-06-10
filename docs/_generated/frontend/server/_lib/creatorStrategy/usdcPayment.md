[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/usdcPayment

# server/\_lib/creatorStrategy/usdcPayment

## Type Aliases

### VerifyUsdcPaymentResult

> **VerifyUsdcPaymentResult** = \{ `blockNumber`: `bigint`; `from`: `Address`; `ok`: `true`; `to`: `Address`; `txHash`: `Hex`; `usdcAddress`: `Address`; `value`: `bigint`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"tx_not_found"` \| `"tx_reverted"` \| `"transfer_not_found"` \| `"rpc_error"`; \}

Defined in: [server/\_lib/creatorStrategy/usdcPayment.ts:69](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/usdcPayment.ts#L69)

## Variables

### BASE\_USDC\_ADDRESS

> `const` **BASE\_USDC\_ADDRESS**: `"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"`

Defined in: [server/\_lib/creatorStrategy/usdcPayment.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/usdcPayment.ts#L31)

Canonical Base USDC (6 decimals).

***

### USDC\_DECIMALS

> `const` **USDC\_DECIMALS**: `6` = `6`

Defined in: [server/\_lib/creatorStrategy/usdcPayment.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/usdcPayment.ts#L34)

Minimum USDC decimals we assume (ERC-20 standard read).

***

### USDC\_TRANSFER\_EVENT\_ABI

> `const` **USDC\_TRANSFER\_EVENT\_ABI**: readonly \[\{ \}\]

Defined in: [server/\_lib/creatorStrategy/usdcPayment.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/usdcPayment.ts#L36)

## Functions

### resolveProtocolTreasuryForUsdcPayments()

> **resolveProtocolTreasuryForUsdcPayments**(): `string`

Defined in: [server/\_lib/creatorStrategy/usdcPayment.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/usdcPayment.ts#L176)

Read the protocol treasury address for USDC deposits from env, falling
back to the canonical `protocolTreasury` Safe when unset. Keeping this
in one place so the API handler, docs, and tests all resolve the same
destination.

#### Returns

`string`

***

### verifyUsdcPayment()

> **verifyUsdcPayment**(`input`): `Promise`\<[`VerifyUsdcPaymentResult`](#verifyusdcpaymentresult)\>

Defined in: [server/\_lib/creatorStrategy/usdcPayment.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/usdcPayment.ts#L105)

Verify a USDC payment transaction by reading its receipt on Base
mainnet and matching logs against the expected Transfer.

Matching is intentionally on-chain-authoritative: we do NOT trust the
tx sender (msg.sender != Transfer.from in the multicall case); we
only trust the decoded Transfer event from the USDC contract.

#### Parameters

##### input

`VerifyInput`

#### Returns

`Promise`\<[`VerifyUsdcPaymentResult`](#verifyusdcpaymentresult)\>
