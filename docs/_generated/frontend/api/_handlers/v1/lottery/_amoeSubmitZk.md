[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/v1/lottery/\_amoeSubmitZk

# api/\_handlers/v1/lottery/\_amoeSubmitZk

## Interfaces

### AmoeSubmitZkHandlerHooks

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:367](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L367)

Test seam — handler accepts an injectable orchestration + relay so
vitest can run the full pipeline without real snarkjs / RPC.

Production callers leave this empty; the handler resolves the
defaults. Exported for use by the integration test harness.

#### Properties

##### ledgerSnapshotReader?

> `optional` **ledgerSnapshotReader**: [`AmoeLedgerSnapshotReader`](../../../../server/_lib/lottery/amoeLedgerSnapshotReader.md#amoeledgersnapshotreader)

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:379](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L379)

Test seam for the burn-then-submit reader pre-flight (PR 6b).
When `AMOE_BURN_THEN_SUBMIT_REQUIRED=1`, the handler calls
`reader.readSnapshotForBurn` BEFORE `insertPending`. Tests
inject a stub here so they don't need a live `db.sql` shape.

When omitted in production, the handler builds a real
`AmoeLedgerSnapshotPgReader` against the configured Postgres pool.

##### orchestrate()?

> `optional` **orchestrate**: (`inputs`, `proveOpts`) => `Promise`\<[`AmoeSubmitZkOrchestrationResult`](../../../../server/_lib/lottery/amoeSubmitZk.md#amoesubmitzkorchestrationresult)\>

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:368](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L368)

###### Parameters

###### inputs

[`AmoeSubmitZkOrchestrationInputs`](../../../../server/_lib/lottery/amoeSubmitZk.md#amoesubmitzkorchestrationinputs)

###### proveOpts

[`AmoeSubmitZkProveOptions`](../../../../server/_lib/lottery/amoeSubmitZk.md#amoesubmitzkproveoptions)

###### Returns

`Promise`\<[`AmoeSubmitZkOrchestrationResult`](../../../../server/_lib/lottery/amoeSubmitZk.md#amoesubmitzkorchestrationresult)\>

##### relay()?

> `optional` **relay**: (`params`) => `Promise`\<`` `0x${string}` ``\>

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:369](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L369)

Send the relayer transaction to `LotteryAmoeRouter.submitAmoeEntryZK`.

Same dual-mode design as the legacy handler: prefer ERC-4337 user-op
via Coinbase Smart Wallet when configured; otherwise fall back to a
raw EOA signed tx. Lifted in-place rather than extracted to a shared
helper because (a) it's identical code-shape but different `to` and
(b) the legacy module is on its own deprecation timeline; sharing
would couple them.

###### Parameters

###### params

###### callData

`` `0x${string}` ``

###### to

`` `0x${string}` ``

###### Returns

`Promise`\<`` `0x${string}` ``\>

## Functions

### \_\_resetAmoeSubmitZkHandlerHooksForTest()

> **\_\_resetAmoeSubmitZkHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:426](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L426)

#### Returns

`void`

***

### \_\_setAmoeSubmitZkHandlerHooksForTest()

> **\_\_setAmoeSubmitZkHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:422](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L422)

Override the handler's orchestrate / relay impls. Vitest only — call
`__resetAmoeSubmitZkHandlerHooks()` between tests.

#### Parameters

##### hooks

[`AmoeSubmitZkHandlerHooks`](#amoesubmitzkhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:430](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L430)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
