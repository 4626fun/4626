[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lens/trayActivityResolve

# server/\_lib/lens/trayActivityResolve

## Type Aliases

### TrayActivityBatchResult

> **TrayActivityBatchResult** = `object`

Defined in: [server/\_lib/lens/trayActivityResolve.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayActivityResolve.ts#L5)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [server/\_lib/lens/trayActivityResolve.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayActivityResolve.ts#L6)

##### results

> **results**: `Record`\<`string`, [`TrayOnchainActivityRow`](baseTrayActivityEtherscan.md#trayonchainactivityrow)[]\>

Defined in: [server/\_lib/lens/trayActivityResolve.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayActivityResolve.ts#L7)

## Functions

### mergeTrayActivityRows()

> **mergeTrayActivityRows**(`rows`): [`TrayOnchainActivityRow`](baseTrayActivityEtherscan.md#trayonchainactivityrow)[]

Defined in: [server/\_lib/lens/trayActivityResolve.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayActivityResolve.ts#L41)

#### Parameters

##### rows

[`TrayOnchainActivityRow`](baseTrayActivityEtherscan.md#trayonchainactivityrow)[]

#### Returns

[`TrayOnchainActivityRow`](baseTrayActivityEtherscan.md#trayonchainactivityrow)[]

***

### resolveTrayWalletActivityBatch()

> **resolveTrayWalletActivityBatch**(`addresses`, `options`): `Promise`\<[`TrayActivityBatchResult`](#trayactivitybatchresult)\>

Defined in: [server/\_lib/lens/trayActivityResolve.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lens/trayActivityResolve.ts#L23)

#### Parameters

##### addresses

`string`[]

##### options

###### limitPerWallet?

`number`

#### Returns

`Promise`\<[`TrayActivityBatchResult`](#trayactivitybatchresult)\>

## References

### TrayOnchainActivityRow

Re-exports [TrayOnchainActivityRow](baseTrayActivityEtherscan.md#trayonchainactivityrow)
