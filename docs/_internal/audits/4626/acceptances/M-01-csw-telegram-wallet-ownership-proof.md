# M-01 Acceptance Criteria — CSW Telegram verification lacks wallet ownership proof

**Finding:** 4626-407
**Severity:** Medium
**Files:**
- `frontend/api/_handlers/zora/_cswEntry.ts`
- `frontend/api/_handlers/zora/_cswEntryChallenge.ts` (new)
- `frontend/server/_lib/zora/cswGateVerification.ts`
**Base SHA:** `43746e1ced400e60e00c10c527939f250db23896`

## Summary

The `/api/zora/csw-entry` endpoint previously accepted any CSW address present in the imported registry and a Telegram username, then issued a Telegram verification token with no proof that the caller controlled the CSW. An attacker could enumerate registered CSWs (the registry is public), submit any of them along with their own Telegram handle, and complete verification — binding someone else's CSW to the attacker's Telegram account.

The fix introduces a challenge-response protocol:

1. New endpoint `POST /api/zora/csw-entry/challenge` issues a single-use, CSW-scoped nonce (10-minute default TTL) and returns a canonical signable message.
2. The client must sign the message with the CSW (EOA via `personal_sign`, or ERC-4337 smart wallet via EIP-1271 `isValidSignature`).
3. `POST /api/zora/csw-entry` now requires `challengeNonce` + `signature`. The handler atomically consumes the challenge (`DELETE RETURNING`), verifies the signature against the CSW address (direct viem path, then EIP-1271 fallback against multiple Base RPCs), and only then proceeds to registry lookup and Telegram-token issuance.
4. The existing Telegram-verify endpoint is unchanged — token consumption atomicity was already correct.

## Acceptance checklist

- [ ] **Unsigned submission rejected** — POSTing to `/api/zora/csw-entry` without `challengeNonce` + `signature` returns 400 `"challengeNonce and signature are required"`.
- [ ] **Malformed signature rejected** — signature not matching `/^0x[0-9a-fA-F]+$/` returns 400 `"Invalid signature encoding"`.
- [ ] **Unknown nonce rejected** — consuming a nonce that was never issued (or wrong CSW) returns 409 `"Invalid or already-used challenge nonce."`.
- [ ] **Expired nonce rejected** — after TTL, consume returns 409 `"Challenge expired. Request a fresh challenge."`.
- [ ] **Invalid signature rejected** — wrong signer or wrong message returns 401 `"Signature does not validate against the CSW address (EOA + EIP-1271 both failed)."`.
- [ ] **Nonce is single-use** — after a successful submission, re-POSTing with the same nonce returns 409.
- [ ] **Re-issue supersedes prior** — calling `/challenge` a second time for the same CSW invalidates the first nonce.
- [ ] **EOA happy path** — personal_sign from a matching EOA yields 200 with a Telegram verification token.
- [ ] **Smart-wallet happy path** — ERC-1271 `isValidSignature` returning `0x1626ba7e` yields 200.
- [ ] **Telemetry recorded** — `meta.cswOwnershipProof` is populated on the entry row with `verified: true`, `contractValidated`, `recoveredSigner`, and `challengeExpiresAt`.
- [ ] **Schema applied** — `zora_csw_gate_entry_challenges` table is created on first handler invocation with RLS enabled and a deny-all policy.
- [ ] **Tests pass** — `frontend/api/__tests__/cswEntryOwnershipProof.test.ts` all cases green (13 cases).
- [ ] **No regressions** — existing `_cswEntryTelegramVerify.ts` flow unchanged; existing `zora_csw_gate_telegram_tokens` table untouched.

## Out of scope

- Cross-chain CSW proofs. This handler assumes Base (chain 8453) where Zora CSWs are deployed.
- Replacing the existing Telegram-token flow. Only the pre-issuance ownership gate is new.
- Client-side (frontend) UX for surfacing the challenge-sign flow. That is tracked separately in the frontend repo.
