[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/agents/\_agents

# api/\_handlers/agents/\_agents

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/agents/\_agents.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agents/_agents.ts#L98)

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
