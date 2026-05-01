[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lottery/lotteryAmoeErrors

# server/\_lib/lottery/lotteryAmoeErrors

## Classes

### AmoeAuthorityError

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L55)

Authority-mismatch class. Maps to HTTP 403.
Used when the authenticated session does not have authority over the
wallet it's trying to act on (e.g. submitting on behalf of a different
wallet than the auth identity controls).

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new AmoeAuthorityError**(`message`): [`AmoeAuthorityError`](#amoeauthorityerror)

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L57)

###### Parameters

###### message

`string` = `'wallet_authority_mismatch'`

###### Returns

[`AmoeAuthorityError`](#amoeauthorityerror)

###### Overrides

`Error.constructor`

#### Properties

##### kind

> `readonly` **kind**: `"amoe_authority"`

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L56)

***

### AmoeBadRequestError

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L29)

Bad-request class. Maps to HTTP 400.
Used for: malformed input, mismatched fields, expired challenges,
          invalid signatures, replay attempts.

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new AmoeBadRequestError**(`message`): [`AmoeBadRequestError`](#amoebadrequesterror)

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L31)

###### Parameters

###### message

`string`

###### Returns

[`AmoeBadRequestError`](#amoebadrequesterror)

###### Overrides

`Error.constructor`

#### Properties

##### kind

> `readonly` **kind**: `"amoe_bad_request"`

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L30)

***

### AmoeInsufficientCreditsError

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L41)

Insufficient-credits class. Maps to HTTP 402 (Payment Required).
Used when the wallet doesn't have enough credits to spend an entry.

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new AmoeInsufficientCreditsError**(`message`): [`AmoeInsufficientCreditsError`](#amoeinsufficientcreditserror)

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L43)

###### Parameters

###### message

`string` = `'insufficient_amoe_credits'`

###### Returns

[`AmoeInsufficientCreditsError`](#amoeinsufficientcreditserror)

###### Overrides

`Error.constructor`

#### Properties

##### kind

> `readonly` **kind**: `"amoe_insufficient_credits"`

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L42)

***

### AmoeServerError

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L67)

Server-side / config / upstream class. Maps to HTTP 500 or 503.
Used for missing relay key, RPC failures, downstream contract reads.

#### Extends

- `Error`

#### Extended by

- [`AmoeBurnRowMissingError`](amoeLedgerSnapshotReader.md#amoeburnrowmissingerror)
- [`AmoeSnapshotNotYetConfirmedError`](amoeLedgerSnapshotReader.md#amoesnapshotnotyetconfirmederror)

#### Constructors

##### Constructor

> **new AmoeServerError**(`message`): [`AmoeServerError`](#amoeservererror)

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:69](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L69)

###### Parameters

###### message

`string`

###### Returns

[`AmoeServerError`](#amoeservererror)

###### Overrides

`Error.constructor`

#### Properties

##### kind

> `readonly` **kind**: `"amoe_server"`

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L68)

## Functions

### classifyAmoeError()

> **classifyAmoeError**(`err`): `object`

Defined in: [server/\_lib/lottery/lotteryAmoeErrors.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/lotteryAmoeErrors.ts#L80)

HTTP status mapping for typed AMOE errors. Falls back to substring
matching for legacy `Error.message` values so callers can switch
incrementally.

#### Parameters

##### err

`unknown`

#### Returns

`object`

##### message

> **message**: `string`

##### status

> **status**: `number`
