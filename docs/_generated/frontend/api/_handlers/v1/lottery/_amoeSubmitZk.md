[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/v1/lottery/\_amoeSubmitZk

# api/\_handlers/v1/lottery/\_amoeSubmitZk

## Interfaces

### AmoeSubmitZkHandlerHooks

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:214](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L214)

Test seam — handler accepts an injectable orchestration + relay so
vitest can run the full pipeline without real snarkjs / RPC.

Production callers leave this empty; the handler resolves the
defaults. Exported for use by the integration test harness.

#### Properties

##### ledgerSnapshotReader?

> `optional` **ledgerSnapshotReader**: [`AmoeLedgerSnapshotReader`](../../../../server/_lib/lottery/amoeLedgerSnapshotReader.md#amoeledgersnapshotreader)

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:226](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L226)

Test seam for the burn-then-submit reader pre-flight (PR 6b).
When `AMOE_BURN_THEN_SUBMIT_REQUIRED=1`, the handler calls
`reader.readSnapshotForBurn` BEFORE `insertPending`. Tests
inject a stub here so they don't need a live `db.sql` shape.

When omitted in production, the handler builds a real
`AmoeLedgerSnapshotPgReader` against the configured Postgres pool.

##### orchestrate()?

> `optional` **orchestrate**: (`inputs`, `proveOpts`) => `Promise`\<[`AmoeSubmitZkOrchestrationResult`](../../../../server/_lib/lottery/amoeSubmitZk.md#amoesubmitzkorchestrationresult)\>

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:215](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L215)

###### Parameters

###### inputs

[`AmoeSubmitZkOrchestrationInputs`](../../../../server/_lib/lottery/amoeSubmitZk.md#amoesubmitzkorchestrationinputs)

###### proveOpts

[`AmoeSubmitZkProveOptions`](../../../../server/_lib/lottery/amoeSubmitZk.md#amoesubmitzkproveoptions)

###### Returns

`Promise`\<[`AmoeSubmitZkOrchestrationResult`](../../../../server/_lib/lottery/amoeSubmitZk.md#amoesubmitzkorchestrationresult)\>

##### relay?

> `optional` **relay**: [`AmoeRelayFn`](../../../../server/_lib/lottery/amoeRelay.md#amoerelayfn)

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:216](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L216)

## Functions

### \_\_resetAmoeSubmitZkHandlerHooksForTest()

> **\_\_resetAmoeSubmitZkHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:273](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L273)

#### Returns

`void`

***

### \_\_setAmoeSubmitZkHandlerHooksForTest()

> **\_\_setAmoeSubmitZkHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:269](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L269)

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

Defined in: [api/\_handlers/v1/lottery/\_amoeSubmitZk.ts:277](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeSubmitZk.ts#L277)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
