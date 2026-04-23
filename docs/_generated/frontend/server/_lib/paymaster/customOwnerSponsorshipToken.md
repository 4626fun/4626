[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/paymaster/customOwnerSponsorshipToken

# server/\_lib/paymaster/customOwnerSponsorshipToken

## Type Aliases

### DecodedCustomOwnerSponsorshipToken

> **DecodedCustomOwnerSponsorshipToken** = `object`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L16)

#### Properties

##### expiresAtMs

> **expiresAtMs**: `number`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L22)

##### issuedAtMs

> **issuedAtMs**: `number`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L21)

##### ownerToAdd

> **ownerToAdd**: `Address`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L19)

##### profileId

> **profileId**: `number` \| `null`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L20)

##### sessionAddress

> **sessionAddress**: `Address`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L17)

##### smartWalletAddress

> **smartWalletAddress**: `Address`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L18)

## Functions

### issueCustomOwnerSponsorshipToken()

> **issueCustomOwnerSponsorshipToken**(`params`): `string`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L60)

#### Parameters

##### params

###### nowMs?

`number`

###### ownerToAdd

`` `0x${string}` ``

###### profileId?

`number` \| `null`

###### sessionAddress

`` `0x${string}` ``

###### smartWalletAddress

`` `0x${string}` ``

###### ttlSeconds?

`number`

#### Returns

`string`

***

### readCustomOwnerSponsorshipToken()

> **readCustomOwnerSponsorshipToken**(`token`): [`DecodedCustomOwnerSponsorshipToken`](#decodedcustomownersponsorshiptoken) \| `null`

Defined in: [server/\_lib/paymaster/customOwnerSponsorshipToken.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/customOwnerSponsorshipToken.ts#L90)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

[`DecodedCustomOwnerSponsorshipToken`](#decodedcustomownersponsorshiptoken) \| `null`
