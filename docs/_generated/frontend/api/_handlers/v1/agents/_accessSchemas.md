[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/v1/agents/\_accessSchemas

# api/\_handlers/v1/agents/\_accessSchemas

## Type Aliases

### AgentAccessProofRequest

> **AgentAccessProofRequest** = `z.infer`\<*typeof* [`agentAccessProofRequestSchema`](#agentaccessproofrequestschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:81](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L81)

***

### AgentAccessProofSubmit

> **AgentAccessProofSubmit** = `z.infer`\<*typeof* [`agentAccessProofSubmitSchema`](#agentaccessproofsubmitschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:97](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L97)

***

### AgentCapabilityResponse

> **AgentCapabilityResponse** = `z.infer`\<*typeof* [`agentCapabilityResponseSchema`](#agentcapabilityresponseschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:62](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L62)

***

### AgentImageHint

> **AgentImageHint** = `z.infer`\<*typeof* [`agentImageHintSchema`](#agentimagehintschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:134](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L134)

***

### AgentMembership

> **AgentMembership** = `z.infer`\<*typeof* [`agentMembershipSchema`](#agentmembershipschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:47](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L47)

***

### AgentRoomAccessToken

> **AgentRoomAccessToken** = `z.infer`\<*typeof* [`agentRoomAccessTokenSchema`](#agentroomaccesstokenschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:121](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L121)

***

### MembershipStatusReason

> **MembershipStatusReason** = `z.infer`\<*typeof* [`membershipStatusReasonSchema`](#membershipstatusreasonschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L25)

***

### MembershipType

> **MembershipType** = `z.infer`\<*typeof* [`membershipTypeSchema`](#membershiptypeschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L15)

***

### RoomCapability

> **RoomCapability** = `z.infer`\<*typeof* [`roomCapabilitySchema`](#roomcapabilityschema)\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:100](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L100)

## Variables

### ADDRESS\_REGEX

> `const` **ADDRESS\_REGEX**: `RegExp`

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L3)

***

### agentAccessProofRequestSchema

> `const` **agentAccessProofRequestSchema**: `ZodObject`\<\{ `chainId`: `ZodNumber`; `expiresAt`: `ZodString`; `issuedAt`: `ZodString`; `message`: `ZodString`; `nonce`: `ZodString`; `roomKey`: `ZodString`; `schema`: `ZodLiteral`\<`"4626-agent-access-proof-request-v1"`\>; `shareToken`: `ZodString`; `wallet`: `ZodString`; \}, `$strict`\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L64)

***

### agentAccessProofSubmitSchema

> `const` **agentAccessProofSubmitSchema**: `ZodObject`\<\{ `proofRequest`: `ZodObject`\<\{ `chainId`: `ZodNumber`; `expiresAt`: `ZodString`; `issuedAt`: `ZodString`; `message`: `ZodString`; `nonce`: `ZodString`; `roomKey`: `ZodString`; `schema`: `ZodLiteral`\<`"4626-agent-access-proof-request-v1"`\>; `shareToken`: `ZodString`; `wallet`: `ZodString`; \}, `$strict`\>; `schema`: `ZodLiteral`\<`"4626-agent-access-proof-submit-v1"`\>; `signature`: `ZodString`; `signer`: `ZodString`; \}, `$strict`\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:83](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L83)

***

### agentCapabilityResponseSchema

> `const` **agentCapabilityResponseSchema**: `ZodObject`\<\{ `chainId`: `ZodNumber`; `issuedAt`: `ZodString`; `memberships`: `ZodArray`\<`ZodObject`\<\{ `accessTokenRequired`: `ZodOptional`\<`ZodBoolean`\>; `actualBalance`: `ZodString`; `gracePeriodSeconds`: `ZodOptional`\<`ZodNumber`\>; `minBalance`: `ZodString`; `minHoldSeconds`: `ZodOptional`\<`ZodNumber`\>; `qualified`: `ZodBoolean`; `qualifiedSince`: `ZodOptional`\<`ZodNumber`\>; `roomKey`: `ZodString`; `shareToken`: `ZodString`; `statusReason`: `ZodOptional`\<`ZodEnum`\<\{ `insufficient_balance`: `"insufficient_balance"`; `insufficient_hold_time`: `"insufficient_hold_time"`; `not_found`: `"not_found"`; `qualified`: `"qualified"`; `revoked`: `"revoked"`; `unsupported_chain`: `"unsupported_chain"`; \}\>\>; `type`: `ZodEnum`\<\{ `governance`: `"governance"`; `telegram`: `"telegram"`; `vault-ui`: `"vault-ui"`; `xmtp`: `"xmtp"`; \}\>; `vault`: `ZodOptional`\<`ZodString`\>; \}, `$strict`\>\>; `resolverVersion`: `ZodNumber`; `schema`: `ZodLiteral`\<`"4626-agent-capability-response-v1"`\>; `wallet`: `ZodString`; \}, `$strict`\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:49](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L49)

***

### agentImageHintSchema

> `const` **agentImageHintSchema**: `ZodObject`\<\{ `chainId`: `ZodNumber`; `checksum`: `ZodOptional`\<`ZodString`\>; `resolver`: `ZodString`; `schema`: `ZodLiteral`\<`"4626-agent-image-hint-v1"`\>; `shareToken`: `ZodString`; `vault`: `ZodOptional`\<`ZodString`\>; `version`: `ZodOptional`\<`ZodNumber`\>; \}, `$strict`\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:123](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L123)

***

### agentMembershipSchema

> `const` **agentMembershipSchema**: `ZodObject`\<\{ `accessTokenRequired`: `ZodOptional`\<`ZodBoolean`\>; `actualBalance`: `ZodString`; `gracePeriodSeconds`: `ZodOptional`\<`ZodNumber`\>; `minBalance`: `ZodString`; `minHoldSeconds`: `ZodOptional`\<`ZodNumber`\>; `qualified`: `ZodBoolean`; `qualifiedSince`: `ZodOptional`\<`ZodNumber`\>; `roomKey`: `ZodString`; `shareToken`: `ZodString`; `statusReason`: `ZodOptional`\<`ZodEnum`\<\{ `insufficient_balance`: `"insufficient_balance"`; `insufficient_hold_time`: `"insufficient_hold_time"`; `not_found`: `"not_found"`; `qualified`: `"qualified"`; `revoked`: `"revoked"`; `unsupported_chain`: `"unsupported_chain"`; \}\>\>; `type`: `ZodEnum`\<\{ `governance`: `"governance"`; `telegram`: `"telegram"`; `vault-ui`: `"vault-ui"`; `xmtp`: `"xmtp"`; \}\>; `vault`: `ZodOptional`\<`ZodString`\>; \}, `$strict`\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L27)

***

### agentRoomAccessTokenSchema

> `const` **agentRoomAccessTokenSchema**: `ZodObject`\<\{ `accessToken`: `ZodString`; `capabilities`: `ZodOptional`\<`ZodArray`\<`ZodEnum`\<\{ `join`: `"join"`; `react`: `"react"`; `read`: `"read"`; `view-members`: `"view-members"`; `write`: `"write"`; \}\>\>\>; `chainId`: `ZodNumber`; `expiresAt`: `ZodString`; `issuedAt`: `ZodString`; `jti`: `ZodOptional`\<`ZodString`\>; `roomKey`: `ZodString`; `schema`: `ZodLiteral`\<`"4626-agent-room-access-token-v1"`\>; `shareToken`: `ZodString`; `sub`: `ZodString`; `tokenType`: `ZodDefault`\<`ZodOptional`\<`ZodLiteral`\<`"bearer"`\>\>\>; \}, `$strict`\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:102](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L102)

***

### DECIMAL\_STRING\_REGEX

> `const` **DECIMAL\_STRING\_REGEX**: `RegExp`

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:5](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L5)

***

### membershipStatusReasonSchema

> `const` **membershipStatusReasonSchema**: `ZodEnum`\<\{ `insufficient_balance`: `"insufficient_balance"`; `insufficient_hold_time`: `"insufficient_hold_time"`; `not_found`: `"not_found"`; `qualified`: `"qualified"`; `revoked`: `"revoked"`; `unsupported_chain`: `"unsupported_chain"`; \}\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L17)

***

### membershipTypeSchema

> `const` **membershipTypeSchema**: `ZodEnum`\<\{ `governance`: `"governance"`; `telegram`: `"telegram"`; `vault-ui`: `"vault-ui"`; `xmtp`: `"xmtp"`; \}\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L14)

***

### roomCapabilitySchema

> `const` **roomCapabilitySchema**: `ZodEnum`\<\{ `join`: `"join"`; `react`: `"react"`; `read`: `"read"`; `view-members`: `"view-members"`; `write`: `"write"`; \}\>

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:99](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L99)

***

### SIGNATURE\_REGEX

> `const` **SIGNATURE\_REGEX**: `RegExp`

Defined in: [api/\_handlers/v1/agents/\_accessSchemas.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/v1/agents/_accessSchemas.ts#L4)
