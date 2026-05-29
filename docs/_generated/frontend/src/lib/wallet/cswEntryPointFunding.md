[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/cswEntryPointFunding

# src/lib/wallet/cswEntryPointFunding

## Type Aliases

### CswFundingAssessment

> **CswFundingAssessment** = \{ `ok`: `true`; `snapshot`: [`CswFundingSnapshot`](#cswfundingsnapshot); \} \| \{ `ok`: `false`; `reason`: `"zero"` \| `"low"`; `snapshot`: [`CswFundingSnapshot`](#cswfundingsnapshot); \}

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L22)

***

### CswFundingSnapshot

> **CswFundingSnapshot** = `object`

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L16)

#### Properties

##### cswNativeWei

> **cswNativeWei**: `bigint`

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L17)

##### entryPointDepositWei

> **entryPointDepositWei**: `bigint`

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L18)

##### totalAvailableWei

> **totalAvailableWei**: `bigint`

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L19)

## Variables

### ENTRY\_POINT\_BALANCE\_ABI

> `const` **ENTRY\_POINT\_BALANCE\_ABI**: readonly \[\{ \}\]

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L6)

EntryPoint v0.6 per-account deposit bucket (StakeManager.balanceOf).

***

### MIN\_CSW\_USEROP\_FUNDING\_WEI

> `const` **MIN\_CSW\_USEROP\_FUNDING\_WEI**: `50000000000000n` = `50_000_000_000_000n`

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L11)

Soft floor — below this, Base App often fails UserOp generation.

***

### RECOMMENDED\_CSW\_USEROP\_FUNDING\_WEI

> `const` **RECOMMENDED\_CSW\_USEROP\_FUNDING\_WEI**: `500000000000000n` = `500_000_000_000_000n`

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L14)

Comfortable buffer for addOwner UserOp gas on Base.

## Functions

### assessCswUserOpFunding()

> **assessCswUserOpFunding**(`snapshot`): [`CswFundingAssessment`](#cswfundingassessment)

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L26)

#### Parameters

##### snapshot

[`CswFundingSnapshot`](#cswfundingsnapshot)

#### Returns

[`CswFundingAssessment`](#cswfundingassessment)

***

### formatEthCompact()

> **formatEthCompact**(`wei`): `string`

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L52)

#### Parameters

##### wei

`bigint`

#### Returns

`string`

***

### mapAddOwnerFundingErrorMessage()

> **mapAddOwnerFundingErrorMessage**(`error`): `string` \| `null`

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L61)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### readCswUserOpFundingSnapshot()

> **readCswUserOpFundingSnapshot**(`params`): `Promise`\<[`CswFundingSnapshot`](#cswfundingsnapshot)\>

Defined in: [src/lib/wallet/cswEntryPointFunding.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswEntryPointFunding.ts#L34)

#### Parameters

##### params

###### cswAddress

`string`

###### publicClient

`Pick`\<`PublicClient`, `"getBalance"` \| `"readContract"`\>

#### Returns

`Promise`\<[`CswFundingSnapshot`](#cswfundingsnapshot)\>
