[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onboarding/waitlistAirtableSync

# server/\_lib/onboarding/waitlistAirtableSync

## Type Aliases

### WaitlistAirtableSyncConfig

> **WaitlistAirtableSyncConfig** = `object`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L15)

#### Properties

##### baseId

> **baseId**: `string`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L17)

##### limit

> **limit**: `number`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L18)

##### tables

> **tables**: `Record`\<`AirtableTableKey`, `AirtableTableConfig`\>

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L19)

##### token

> **token**: `string`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L16)

***

### WaitlistAirtableSyncResult

> **WaitlistAirtableSyncResult** = `object`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L41)

#### Properties

##### baseId

> **baseId**: `string`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L43)

##### dryRun

> **dryRun**: `boolean`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L42)

##### tables

> **tables**: [`WaitlistAirtableTableResult`](#waitlistairtabletableresult)[]

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L44)

***

### WaitlistAirtableTableResult

> **WaitlistAirtableTableResult** = `object`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L31)

#### Properties

##### attempted

> **attempted**: `number`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L36)

##### errors

> **errors**: `string`[]

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L38)

##### key

> **key**: `AirtableTableKey`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L32)

##### label

> **label**: `string`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L33)

##### mergeField

> **mergeField**: `string`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L35)

##### table

> **table**: `string`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L34)

##### upserted

> **upserted**: `number`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L37)

## Functions

### readApplicantRecords()

> **readApplicantRecords**(`db`, `limit`): `Promise`\<`AirtableRecord`[]\>

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:386](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L386)

#### Parameters

##### db

`Db`

##### limit

`number`

#### Returns

`Promise`\<`AirtableRecord`[]\>

***

### readOnboardingRecords()

> **readOnboardingRecords**(`db`, `limit`): `Promise`\<`AirtableRecord`[]\>

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:502](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L502)

#### Parameters

##### db

`Db`

##### limit

`number`

#### Returns

`Promise`\<`AirtableRecord`[]\>

***

### readReferralRecords()

> **readReferralRecords**(`db`, `limit`): `Promise`\<`AirtableRecord`[]\>

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:449](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L449)

#### Parameters

##### db

`Db`

##### limit

`number`

#### Returns

`Promise`\<`AirtableRecord`[]\>

***

### readTaskRecords()

> **readTaskRecords**(`db`, `limit`): `Promise`\<`AirtableRecord`[]\>

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:478](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L478)

#### Parameters

##### db

`Db`

##### limit

`number`

#### Returns

`Promise`\<`AirtableRecord`[]\>

***

### readWaitlistAirtableSyncConfig()

> **readWaitlistAirtableSyncConfig**(`env`): `object`

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L75)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\>

#### Returns

`object`

##### config

> **config**: [`WaitlistAirtableSyncConfig`](#waitlistairtablesyncconfig) \| `null`

##### missing

> **missing**: `string`[]

***

### syncWaitlistSupabaseToAirtable()

> **syncWaitlistSupabaseToAirtable**(`params`): `Promise`\<[`WaitlistAirtableSyncResult`](#waitlistairtablesyncresult)\>

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:754](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L754)

#### Parameters

##### params

###### client

`SupabaseLike`

###### config

[`WaitlistAirtableSyncConfig`](#waitlistairtablesyncconfig)

###### dryRun?

`boolean`

###### fetchImpl?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### Returns

`Promise`\<[`WaitlistAirtableSyncResult`](#waitlistairtablesyncresult)\>

***

### syncWaitlistToAirtable()

> **syncWaitlistToAirtable**(`params`): `Promise`\<[`WaitlistAirtableSyncResult`](#waitlistairtablesyncresult)\>

Defined in: [server/\_lib/onboarding/waitlistAirtableSync.ts:731](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/waitlistAirtableSync.ts#L731)

#### Parameters

##### params

###### config

[`WaitlistAirtableSyncConfig`](#waitlistairtablesyncconfig)

###### db

`Db`

###### dryRun?

`boolean`

###### fetchImpl?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### Returns

`Promise`\<[`WaitlistAirtableSyncResult`](#waitlistairtablesyncresult)\>
