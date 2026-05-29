[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lens/funderTrace

# server/\_lib/lens/funderTrace

## Type Aliases

### FunderHop

> **FunderHop** = `object`

Defined in: [server/\_lib/lens/funderTrace.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L33)

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/lens/funderTrace.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L35)

The address being traced at this hop.

##### blockNumber

> **blockNumber**: `number`

Defined in: [server/\_lib/lens/funderTrace.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L41)

Block number of the funding tx.

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/lens/funderTrace.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L45)

Chain ID where this funding occurred.

##### funderAddress

> **funderAddress**: `string`

Defined in: [server/\_lib/lens/funderTrace.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L37)

The address that funded it.

##### funderTxHash

> **funderTxHash**: `string`

Defined in: [server/\_lib/lens/funderTrace.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L39)

Transaction hash of the funding tx.

##### hop

> **hop**: `number`

Defined in: [server/\_lib/lens/funderTrace.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L47)

Depth of this hop (1 = direct funder of the target).

##### timestamp

> **timestamp**: `number`

Defined in: [server/\_lib/lens/funderTrace.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L43)

Unix timestamp of the funding tx.

***

### FunderTraceResult

> **FunderTraceResult** = `object`

Defined in: [server/\_lib/lens/funderTrace.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L50)

#### Properties

##### chain

> **chain**: [`FunderHop`](#funderhop)[]

Defined in: [server/\_lib/lens/funderTrace.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L54)

Ordered chain of funders (hop 1 = direct funder, hop N = deepest ancestor).

##### complete

> **complete**: `boolean`

Defined in: [server/\_lib/lens/funderTrace.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L56)

Whether the trace completed all requested hops (false if a hop failed or had no funder).

##### requestedHops

> **requestedHops**: `number`

Defined in: [server/\_lib/lens/funderTrace.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L58)

Number of hops requested.

##### stopReason?

> `optional` **stopReason**: `"no_funder"` \| `"api_error"` \| `"contract_address"` \| `"self_funded"` \| `"max_hops"`

Defined in: [server/\_lib/lens/funderTrace.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L60)

If the trace stopped early, the reason.

##### target

> **target**: `string`

Defined in: [server/\_lib/lens/funderTrace.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L52)

The original target address.

## Functions

### traceFunders()

> **traceFunders**(`address`, `options`): `Promise`\<[`FunderTraceResult`](#fundertraceresult)\>

Defined in: [server/\_lib/lens/funderTrace.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L131)

Trace the funding chain for a wallet address.

#### Parameters

##### address

`string`

Target wallet address.

##### options

###### chainId?

`number`

Chain to trace on (default 8453 = Base).

###### hops?

`number`

Number of hops to trace (default 3, max 5).

#### Returns

`Promise`\<[`FunderTraceResult`](#fundertraceresult)\>

***

### traceFundersMultiChain()

> **traceFundersMultiChain**(`address`, `options`): `Promise`\<[`FunderTraceResult`](#fundertraceresult) & `object`\>

Defined in: [server/\_lib/lens/funderTrace.ts:184](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/funderTrace.ts#L184)

Trace funders across multiple chains and merge results.
Returns the longest chain found across all requested chains.

#### Parameters

##### address

`string`

##### options

###### chainIds?

`number`[]

###### hops?

`number`

#### Returns

`Promise`\<[`FunderTraceResult`](#fundertraceresult) & `object`\>
