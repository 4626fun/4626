[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/waitlistSubaccountFlowEnv

# server/\_lib/wallet/waitlistSubaccountFlowEnv

## Functions

### isWaitlistSubaccountFlowEnabled()

> **isWaitlistSubaccountFlowEnabled**(`env`): `boolean`

Defined in: [server/\_lib/wallet/waitlistSubaccountFlowEnv.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/waitlistSubaccountFlowEnv.ts#L8)

Server gate for Track C2 Base App sub-account waitlist/onboarding.
Must stay in sync with `waitlistSubAccountFlowFlag` (client) and
`WAITLIST_SUBACCOUNT_FLOW_ENABLED` in `.env.example`.

Strict: only the literal `"1"` enables the path (not `"true"`).

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`boolean`
