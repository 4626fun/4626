[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/cswOwnerLinkStatus

# server/\_lib/wallet/cswOwnerLinkStatus

## Type Aliases

### CswOwnerLinkStatus

> **CswOwnerLinkStatus** = *typeof* [`CSW_OWNER_LINK_STATUSES`](#csw_owner_link_statuses)\[`number`\]

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L15)

***

### CswOwnerLinkStatusUpsert

> **CswOwnerLinkStatusUpsert** = `object`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L17)

#### Properties

##### canonicalSmartWallet

> **canonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:21](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L21)

##### checkedAtIso?

> `optional` **checkedAtIso**: `string` \| `null`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:27](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L27)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:20](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L20)

##### metadata

> **metadata**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:26](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L26)

##### ownerLinked

> **ownerLinked**: `boolean`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:22](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L22)

##### privyUserId

> **privyUserId**: `string` \| `null`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L19)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L18)

##### reason

> **reason**: `string` \| `null`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:24](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L24)

##### status

> **status**: [`CswOwnerLinkStatus`](#cswownerlinkstatus)

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:23](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L23)

##### suggestedCanonicalSmartWallet

> **suggestedCanonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L25)

## Variables

### CSW\_OWNER\_LINK\_STATUSES

> `const` **CSW\_OWNER\_LINK\_STATUSES**: readonly \[`"linked_ok"`, `"linked_mapping_mismatch"`, `"owner_link_missing"`, `"canonical_wallet_mismatch"`, `"canonical_wallet_missing"`, `"embedded_eoa_missing"`, `"rpc_error"`\]

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:5](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L5)

## Functions

### ensureCswOwnerLinkStatusSchema()

> **ensureCswOwnerLinkStatusSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:46](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L46)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### upsertCswOwnerLinkStatus()

> **upsertCswOwnerLinkStatus**(`db`, `input`): `Promise`\<`void`\>

Defined in: [server/\_lib/wallet/cswOwnerLinkStatus.ts:139](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwnerLinkStatus.ts#L139)

#### Parameters

##### db

`Db`

##### input

[`CswOwnerLinkStatusUpsert`](#cswownerlinkstatusupsert)

#### Returns

`Promise`\<`void`\>
