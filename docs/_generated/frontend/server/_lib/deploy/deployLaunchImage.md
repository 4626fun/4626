[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/deploy/deployLaunchImage

# server/\_lib/deploy/deployLaunchImage

## Variables

### LAUNCH\_IMAGE\_PROJECT\_ID\_KEY

> `const` **LAUNCH\_IMAGE\_PROJECT\_ID\_KEY**: `"launchImageProjectId"` = `'launchImageProjectId'`

Defined in: [server/\_lib/deploy/deployLaunchImage.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/deploy/deployLaunchImage.ts#L16)

***

### LAUNCH\_IMAGE\_READY\_AT\_KEY

> `const` **LAUNCH\_IMAGE\_READY\_AT\_KEY**: `"launchImageReadyAt"` = `'launchImageReadyAt'`

Defined in: [server/\_lib/deploy/deployLaunchImage.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/deploy/deployLaunchImage.ts#L17)

***

### LAUNCH\_IMAGE\_SHARE\_OFT\_KEY

> `const` **LAUNCH\_IMAGE\_SHARE\_OFT\_KEY**: `"launchImageShareOft"` = `'launchImageShareOft'`

Defined in: [server/\_lib/deploy/deployLaunchImage.ts:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/deploy/deployLaunchImage.ts#L19)

***

### LAUNCH\_IMAGE\_VAULT\_KEY

> `const` **LAUNCH\_IMAGE\_VAULT\_KEY**: `"launchImageVaultAddress"` = `'launchImageVaultAddress'`

Defined in: [server/\_lib/deploy/deployLaunchImage.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/deploy/deployLaunchImage.ts#L18)

***

### LAUNCH\_IMAGE\_VERIFIED\_AT\_KEY

> `const` **LAUNCH\_IMAGE\_VERIFIED\_AT\_KEY**: `"launchImageVerifiedAt"` = `'launchImageVerifiedAt'`

Defined in: [server/\_lib/deploy/deployLaunchImage.ts:20](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/deploy/deployLaunchImage.ts#L20)

***

### LAUNCH\_IMAGE\_VERIFIED\_BYTES\_KEY

> `const` **LAUNCH\_IMAGE\_VERIFIED\_BYTES\_KEY**: `"launchImageVerifiedBytes"` = `'launchImageVerifiedBytes'`

Defined in: [server/\_lib/deploy/deployLaunchImage.ts:21](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/deploy/deployLaunchImage.ts#L21)

## Functions

### ensureLaunchImageReady()

> **ensureLaunchImageReady**(`params`): `Promise`\<\{ `outputBlobUrl`: `string`; `projectId`: `string`; `shareOFT`: `` `0x${string}` ``; `vaultAddress`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/deploy/deployLaunchImage.ts:298](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/deploy/deployLaunchImage.ts#L298)

#### Parameters

##### params

###### deployToken?

`string`

###### deployTokenSignature?

`string`

###### payload

`Record`\<`string`, `any`\>

###### persistPayloadPatch

(`patch`) => `Promise`\<`void`\>

###### phase2FinalizeCalls

`object`[]

###### phase4Calls

`object`[]

###### req

`VercelRequest`

###### sessionAddress

`` `0x${string}` ``

###### sessionId

`string`

#### Returns

`Promise`\<\{ `outputBlobUrl`: `string`; `projectId`: `string`; `shareOFT`: `` `0x${string}` ``; `vaultAddress`: `` `0x${string}` ``; \}\>
