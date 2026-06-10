[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/identity/ethosCanonicalScores

# server/\_lib/identity/ethosCanonicalScores

## Variables

### \_\_testOnly

> `const` **\_\_testOnly**: `object`

Defined in: [server/\_lib/identity/ethosCanonicalScores.ts:939](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/ethosCanonicalScores.ts#L939)

#### Type Declaration

##### deriveIdentitySeedsForProfile()

> **deriveIdentitySeedsForProfile**: (`input`) => `IdentitySeedRow`[]

###### Parameters

###### input

###### canonicalUserId

`number`

###### linkedMethodRows

`object`[]

###### profileCanonicalCsw

`string` \| `null`

###### profileEmbeddedEoa

`string` \| `null`

###### profilePrimaryWallet

`string` \| `null`

###### walletRows

`object`[]

###### Returns

`IdentitySeedRow`[]

##### extractUpdateCursor()

> **extractUpdateCursor**: (`item`) => `string` \| `null`

###### Parameters

###### item

`Record`\<`string`, `unknown`\>

###### Returns

`string` \| `null`

##### extractUpdateUserkey()

> **extractUpdateUserkey**: (`item`) => `string` \| `null`

###### Parameters

###### item

`Record`\<`string`, `unknown`\>

###### Returns

`string` \| `null`

##### parseTwitterUserkey()

> **parseTwitterUserkey**: (`value`) => \{ `identityType`: `"x_id"` \| `"x_username"`; `userkey`: `string`; \} \| `null`

###### Parameters

###### value

`unknown`

###### Returns

\{ `identityType`: `"x_id"` \| `"x_username"`; `userkey`: `string`; \} \| `null`

##### parseUpdateItems()

> **parseUpdateItems**: (`payload`) => `Record`\<`string`, `unknown`\>[]

###### Parameters

###### payload

`unknown`

###### Returns

`Record`\<`string`, `unknown`\>[]

##### toIdentityPriority()

> **toIdentityPriority**: (`identityType`) => `number`

###### Parameters

###### identityType

`string`

###### Returns

`number`

## Functions

### ensureEthosCanonicalSchema()

> **ensureEthosCanonicalSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/ethosCanonicalScores.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/ethosCanonicalScores.ts#L119)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### ethosCanonicalReadEnabled()

> **ethosCanonicalReadEnabled**(): `boolean`

Defined in: [server/\_lib/identity/ethosCanonicalScores.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/ethosCanonicalScores.ts#L115)

#### Returns

`boolean`

***

### getCanonicalEthosScoresByUserkeys()

> **getCanonicalEthosScoresByUserkeys**(`params`): `Promise`\<`Map`\<`string`, \{ `level`: `string` \| `null`; `score`: `number` \| `null`; \}\>\>

Defined in: [server/\_lib/identity/ethosCanonicalScores.ts:905](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/ethosCanonicalScores.ts#L905)

#### Parameters

##### params

###### db

`Db`

###### userkeys

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, \{ `level`: `string` \| `null`; `score`: `number` \| `null`; \}\>\>

***

### materializeCanonicalEthosScores()

> **materializeCanonicalEthosScores**(`params`): `Promise`\<\{ `processed`: `number`; `updated`: `number`; \}\>

Defined in: [server/\_lib/identity/ethosCanonicalScores.ts:570](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/ethosCanonicalScores.ts#L570)

#### Parameters

##### params

###### canonicalUserIds?

`number`[]

###### db

`Db`

###### limit?

`number`

###### userkeys?

`string`[]

#### Returns

`Promise`\<\{ `processed`: `number`; `updated`: `number`; \}\>

***

### seedEthosIdentityKeys()

> **seedEthosIdentityKeys**(`params`): `Promise`\<\{ `keysDerived`: `number`; `keysUpserted`: `number`; `profilesProcessed`: `number`; \}\>

Defined in: [server/\_lib/identity/ethosCanonicalScores.ts:240](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/ethosCanonicalScores.ts#L240)

#### Parameters

##### params

###### canonicalUserIds?

`number`[]

###### db

`Db`

###### limit?

`number`

###### offset?

`number`

#### Returns

`Promise`\<\{ `keysDerived`: `number`; `keysUpserted`: `number`; `profilesProcessed`: `number`; \}\>

***

### syncEthosScoreUpdates()

> **syncEthosScoreUpdates**(`params`): `Promise`\<\{ `cursorAfter`: `string` \| `null`; `pages`: `number`; `refreshedUserkeys`: `number`; `updatesSeen`: `number`; \}\>

Defined in: [server/\_lib/identity/ethosCanonicalScores.ts:827](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/ethosCanonicalScores.ts#L827)

#### Parameters

##### params

###### db

`Db`

###### maxPages?

`number`

###### pageLimit?

`number`

###### startAfter?

`string` \| `null`

###### syncKey?

`string`

#### Returns

`Promise`\<\{ `cursorAfter`: `string` \| `null`; `pages`: `number`; `refreshedUserkeys`: `number`; `updatesSeen`: `number`; \}\>

***

### syncEthosUserkeyScores()

> **syncEthosUserkeyScores**(`params`): `Promise`\<\{ `attempted`: `number`; `failed`: `number`; `processedUserkeys`: `string`[]; `updated`: `number`; \}\>

Defined in: [server/\_lib/identity/ethosCanonicalScores.ts:459](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/ethosCanonicalScores.ts#L459)

#### Parameters

##### params

###### chunkSize?

`number`

###### db

`Db`

###### forceUserkeys?

`string`[]

###### limit?

`number`

#### Returns

`Promise`\<\{ `attempted`: `number`; `failed`: `number`; `processedUserkeys`: `string`[]; `updated`: `number`; \}\>
