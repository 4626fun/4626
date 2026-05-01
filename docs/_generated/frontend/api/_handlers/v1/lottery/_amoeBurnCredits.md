[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/v1/lottery/\_amoeBurnCredits

# api/\_handlers/v1/lottery/\_amoeBurnCredits

## Functions

### computeEligibleSubmitAfterUnixSec()

> **computeEligibleSubmitAfterUnixSec**(`burnEpoch`): `bigint`

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnCredits.ts:149](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnCredits.ts#L149)

Compute the unix timestamp at which a burn that landed in `epoch`
becomes eligible for phase B submission. Equals the start of
`epoch + 1`, which is when the publisher cron can confirm the
snapshot containing this burn.

Mirrors the inverse of `computeAmoeEpoch`:
  epoch = (now - genesis) / length
  eligible = genesis + (epoch + 1) * length

Caller adds an additional ~15 min buffer for the publisher tick;
we do NOT bake that buffer into this function so the contract
stays mathematically pure.

#### Parameters

##### burnEpoch

`bigint`

#### Returns

`bigint`

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnCredits.ts:153](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnCredits.ts#L153)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
