[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_handlers/\_agents

# api/\_handlers/\_agents

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/\_agents.ts:98](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_agents.ts#L98)

GET /api/agents

Directory-compatible agent listing endpoint (XMTP Agent Directory shape).
If XMTP_AGENT_ADDRESS is configured, returns a single 4626 agent entry.

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
