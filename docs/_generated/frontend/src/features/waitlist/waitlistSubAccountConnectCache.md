[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistSubAccountConnectCache

# src/features/waitlist/waitlistSubAccountConnectCache

## Functions

### clearPersistedSubAccountConnectOverlay()

> **clearPersistedSubAccountConnectOverlay**(`accountKey`): `void`

Defined in: [src/features/waitlist/waitlistSubAccountConnectCache.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistSubAccountConnectCache.ts#L61)

#### Parameters

##### accountKey

`string` | `null`

#### Returns

`void`

***

### readPersistedSubAccountConnectOverlay()

> **readPersistedSubAccountConnectOverlay**(`accountKey`): [`WaitlistSubAccountConnectOverlay`](waitlistFlowState.md#waitlistsubaccountconnectoverlay) \| `null`

Defined in: [src/features/waitlist/waitlistSubAccountConnectCache.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistSubAccountConnectCache.ts#L40)

#### Parameters

##### accountKey

`string` | `null`

#### Returns

[`WaitlistSubAccountConnectOverlay`](waitlistFlowState.md#waitlistsubaccountconnectoverlay) \| `null`

***

### writePersistedSubAccountConnectOverlay()

> **writePersistedSubAccountConnectOverlay**(`accountKey`, `overlay`): `void`

Defined in: [src/features/waitlist/waitlistSubAccountConnectCache.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistSubAccountConnectCache.ts#L52)

#### Parameters

##### accountKey

`string`

##### overlay

[`WaitlistSubAccountConnectOverlay`](waitlistFlowState.md#waitlistsubaccountconnectoverlay)

#### Returns

`void`
