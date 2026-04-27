# AMOE relay key scope

**Scope:** `frontend/api/_handlers/v1/lottery/_amoeSubmit.ts`
**Related:** `docs/operations/red-ci-tracking.md`, `cre/README.md`

## Summary

The AMOE submit handler relays a user's signed AMOE entry on-chain to
`LotteryAmoeRouter.submitAmoeEntry`. To do so it needs a signing key. The
handler supports three sender modes, in priority order:

1. **Privy-signed Coinbase Smart Wallet UserOp** — driven by
   `LOTTERY_AMOE_RELAY_PRIVY_WALLET_ID` + `LOTTERY_AMOE_RELAY_OWNER`
2. **EOA-signed Coinbase Smart Wallet UserOp** — driven by
   `LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY` + `LOTTERY_AMOE_RELAY_SMART_WALLET`
   + `LOTTERY_AMOE_RELAY_BUNDLER_URL`
3. **Plain EOA tx** — driven by `LOTTERY_AMOE_RELAY_PRIVATE_KEY` (or, for
   parity with smart-wallet mode, `LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY`)

Every one of these env vars is **AMOE-scoped** and **must be provisioned
explicitly** for the AMOE relayer to function. There is no fallback to
broader-scope keys.

## Why this matters

Earlier versions of `_amoeSubmit.ts` fell through to:

```
LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY
  -> CRE_ERC4337_OWNER_PRIVATE_KEY
  -> KEEPR_PRIVATE_KEY
  -> PRIVATE_KEY
```

The last two are problematic:

- `KEEPR_PRIVATE_KEY` is the keeper EOA, with broad authority across CRE
  workflows (see `cre/README.md`). Lending its signing capability to AMOE
  expands the blast radius of an AMOE-handler bug.
- `PRIVATE_KEY` is the *generic* env var template flagged in
  `docs/operations/red-ci-tracking.md` as a known leak risk in CI artifacts.
  Allowing it to back AMOE means any leak of a generic deploy key implicitly
  grants AMOE-relay authority.

`CRE_ERC4337_OWNER_PRIVATE_KEY` is less dangerous (still scoped to CRE) but
mixing it into the AMOE path makes it harder to rotate either key
independently, and harder to attribute on-chain activity in incident review.

## Behaviour today

- All three modes fail closed with `amoe_relay_unavailable` if their
  required env vars are missing.
- The fail-closed branch returns a `500` to the user; the API handler will
  surface that. Operators should monitor for `amoe_relay_unavailable` in
  logs as a "config drift" signal rather than a user-facing failure
  (in production it should never trip).
- Client-relay mode (`relay=false` in the request body) is unaffected:
  the user signs and broadcasts on their own. Server-relay only kicks in
  when `relay=true`.

## Operational checklist when provisioning AMOE

1. Generate or designate a dedicated AMOE relay key/wallet.
2. Provision **only** the `LOTTERY_AMOE_RELAY_*` env vars for the chosen
   mode. Do **not** rely on `KEEPR_PRIVATE_KEY` or `PRIVATE_KEY` to silently
   cover for a missing AMOE-relay value.
3. On rotation: rotate AMOE-relay keys independently of keeper / CRE keys.
4. In CI / staging: prefer Privy-signed mode so the private key never
   leaves the Privy enclave.

## Verification

`frontend/api/__tests__/lotteryAmoeRelayKeyScope.test.ts` asserts that
`readAmoeRelayPrivateKey()` and `readAmoeRelayOwnerPrivateKey()` return
`null` when only `KEEPR_PRIVATE_KEY` / `PRIVATE_KEY` are set, and the
submit handler emits `amoe_relay_unavailable` rather than promoting a
broader-scope key.
