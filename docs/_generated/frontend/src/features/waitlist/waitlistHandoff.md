[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/waitlistHandoff

# src/features/waitlist/waitlistHandoff

## Functions

### bridgePrivySession()

> **bridgePrivySession**(`privyToken`): `Promise`\<`boolean`\>

Defined in: [src/features/waitlist/waitlistHandoff.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistHandoff.ts#L28)

Exchange a Privy access token for a 4626 session on the current origin.
The session itself lives in the HttpOnly `cv_auth_session` cookie; this
function just signals whether that cookie was successfully established
so the caller knows the next same-origin request will be authenticated.

#### Parameters

##### privyToken

`string` | `null`

#### Returns

`Promise`\<`boolean`\>

***

### createAuthHandoffCode()

> **createAuthHandoffCode**(`params`): `Promise`\<`string`\>

Defined in: [src/features/waitlist/waitlistHandoff.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistHandoff.ts#L64)

Ask the server for a one-time handoff code that the app origin can redeem
to mint an equivalent session on its own host. Authentication flows via
the `cv_auth_session` cookie (bridged by `bridgePrivySession` first);
the caller does not need to pass a session token explicitly.

`privyToken` is forwarded in the body so the redeem side can optionally
also rebuild a Privy context on the app origin.

#### Parameters

##### params

###### privyToken

`string` \| `null`

#### Returns

`Promise`\<`string`\>
