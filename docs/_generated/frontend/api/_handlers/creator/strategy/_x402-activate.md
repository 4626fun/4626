[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/creator/strategy/\_x402-activate

# api/\_handlers/creator/strategy/\_x402-activate

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/creator/strategy/\_x402-activate.ts:81](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/creator/strategy/_x402-activate.ts#L81)

x402-style activation for creator strategy features.

Flow:
  1. Client POSTs `{ creatorToken, featureKey }` WITHOUT a payment tx.
  2. If no `X-PAYMENT` header is present, server responds 402 with
     `accepts` describing the USDC amount + destination + network.
  3. Client signs an EIP-3009 `transferWithAuthorization` in-wallet,
     base64-encodes `{ scheme, network, x402_version, payload }` into
     `X-PAYMENT`, and re-POSTs the same body.
  4. Server validates the authorization statically, then broadcasts
     the settled `transferWithAuthorization` via the server's relayer
     key (`X402_RELAYER_PRIVATE_KEY` or fallback `PRIVATE_KEY`). The
     relayer pays Base gas so the creator doesn't need ETH.
  5. On success the activation row is created with
     `payment_source = 'x402_base'` and the settled tx hash is stored
     in `payment_tx_hash`, enabling all downstream flows (paywall gate,
     verifier, dedupe) to work uniformly.

The original `/api/creator/strategy/activate` endpoint keeps working
unchanged for wallets that can't do EIP-3009 and prefer the legacy
"send a tx, paste the hash" flow.

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
