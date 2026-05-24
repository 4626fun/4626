---
title: Owner-Install Reference Methods
---

# Owner-install reference methods

4626 supports several **observed** CSW owner-mutation lanes. Only one is the **product success criterion** for waitlist “Enable 4626 signing”; the others are **reference methods** — golden txs, signing shapes, and runbooks we cite when debugging Base App / Relay behavior.

**Success criterion (all methods):** on-chain `isOwnerAddress(privyEmbeddedEoa)` on the canonical parent CSW (`profiles.csw_address`). A landed Relay Part 2 UserOp alone is **not** sufficient if the new owner slot is not the Privy embedded EOA.

---

## Method index

| ID | Name | Context | Primary doc | Golden txs |
| --- | --- | --- | --- | --- |
| **A** | **Relay embedded-EOA owner-install** | Primary waitlist / `/waitlist?setup=owner-install` path; Part 1 deposit + Part 2 `addOwnerAddress(embeddedEoa)` | [Relay Kit — Owner Mutation Guide](/operations/relay-owner-mutation-kit-guide) | May 2026 block 45600637 (see guide) |
| **B** | **Passkey-first Base App session-key Relay Part 1** | Base App WebView CSW with WebAuthn at `owner[0]` and session key at `owner[2]`; Part 1 signed by session key, Part 2 validated by passkey | [Base App session-key Part 1 recipe](/operations/base-app-session-key-relay-part1-recipe) | Part 2 reference below; Part 1 shares Method A deposit shape |
| **C** | **Direct prepared-calls passkey (external browser)** | Recovery / legacy when CSW already has passkey owner and user opens `/add-owner` in a normal browser | [CSW Recovery Playbook](/operations/csw-recovery-playbook) | March 2026 userOpHash on probe CSW |

Implementation entry points:

| Method | Client | Server preview |
| --- | --- | --- |
| A, B | `useAddOwnerFlow` → `executeOwnerMutationViaRelay` → `submitSelfAuthRelayPart1SelfFunded` | `POST /api/onboarding/preview-add-owner` |
| C | `onboardingWallet.sendPreparedOwnerTx` | `POST /api/onboarding/preview-add-owner` (same preview; different client lane) |

---

## Method A — Relay embedded-EOA owner-install (primary)

**When to use:** Default owner-install for canonical CSW + Privy embedded EOA. Product gates on this completing.

**Part 1:** CSW self-auth UserOp → `RelayDepository.depositNative` (`0x49290c1c`), paymaster = 0.

**Part 2:** Relay solver → `EntryPoint.handleOps` → `executeWithoutChainIdValidation` → **`addOwnerAddress(privyEmbeddedEoa)`**.

Golden reference (Base mainnet, block **45600637**, May 5 2026):

| Part | Hash |
| --- | --- |
| Part 1 UserOp | [0xa6b5435718a8969905a08093a7208dadefdf702602c63e3fd322d84db5f4b4c3](https://basescan.org/tx/0xa6b5435718a8969905a08093a7208dadefdf702602c63e3fd322d84db5f4b4c3) |
| Part 1 bundle | [0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf](https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf) |
| Part 2 solver | [0xa9a06340a7725063f1dd9b0a29af6c72f4fbfe3a408b28dd28e2fd2db7649a36](https://basescan.org/tx/0xa9a06340a7725063f1dd9b0a29af6c72f4fbfe3a408b28dd28e2fd2db7649a36) |

Probe CSW for on-chain checks: `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef` (`4626.base.eth`).

---

## Method B — Passkey-first Base App session-key Relay (reference)

**When to use:** Reference only — Base App passkey-first CSWs where Part 1 must be signed by the **session key** at owner slot 2, not the passkey at slot 0. Still targets **`addOwnerAddress(embeddedEoa)`** in preview calldata; do not treat a Part 2 that only adds the session-key address as waitlist success.

**Owner layout (observed on probe CSW):**

| Slot | Role |
| --- | --- |
| `owner[0]` | WebAuthn passkey (`org.toshi` / Base App) — validates **Part 2** |
| `owner[2]` | Session-key EOA — signs **Part 1** prepared-calls / bundler UserOp |

Session-key signer observed: `0xCf8D17Ce01B73637ef936fe7c47bA7100b820142` (verify via `ownerAtIndex(2)` on-chain).

**Part 1 signing:** `wallet_prepareCalls` → strip paymaster → session-key hash + `inner_secp256k1` → `wallet_sendPreparedCalls` (never `wallet_sendCalls` for self-auth).

**Part 2 signing:** Passkey `owner[0]` via `getUserOpHashWithoutChainId` (not chain-bound EntryPoint hash).

### Golden Part 2 reference (historical, passkey-first CSW)

Historical Relay Part 2 on the same probe CSW (~Feb 2026). Inner mutation added the **session-key address at index 2**, not an embedded-EOA install — cite this for **Part 2 validation shape**, not for waitlist completion.

| Field | Value |
| --- | --- |
| Part 2 tx | [0x801b9d4b8f7470226c2f02d5252583f00d77da5cbb0b7dc8b73421ed8b491503](https://basescan.org/tx/0x801b9d4b8f7470226c2f02d5252583f00d77da5cbb0b7dc8b73421ed8b491503) |
| Tenderly trace | [dashboard](https://dashboard.tenderly.co/tx/0x801b9d4b8f7470226c2f02d5252583f00d77da5cbb0b7dc8b73421ed8b491503) |
| CSW | `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef` |
| Validation hash | `getUserOpHashWithoutChainId` |
| Signer | WebAuthn passkey `owner[0]`, origin `android:apk-key-hash:…`, package `org.toshi` |
| Paymaster | `0x0` |
| Inner call | `executeWithoutChainIdValidation` → `addOwnerAddress(0xCf8D17…0142)` at owner index **2** |

Full recipe and failure surfaces: [Base App session-key Relay Part 1 recipe](/operations/base-app-session-key-relay-part1-recipe).

Code (when merged): `cswSelfAuthOwnerDiscovery.ts`, `submitRelayPart1SelfFunded.ts` preflight telemetry `relay_part1:preflight_passkey_first_csw`.

---

## Method C — Direct prepared-calls passkey (reference / recovery)

**When to use:** External browser recovery when passkey owner can sign prepared calls directly (not Base App WebView session-key lane).

Confirmed reference: [CSW Recovery Playbook](/operations/csw-recovery-playbook) — probe CSW, userOpHash `0x70255628…`, WebAuthn `org.toshi`.

---

## How to cite in code and AGENTS.md

- **Primary path / success gates:** Method **A**
- **Base App session-key Part 1 / Part 2 split:** Method **B** + [recipe](/operations/base-app-session-key-relay-part1-recipe)
- **Passkey Part 2 golden shape (historical):** Method **B** Part 2 tx `0x801b9d4b…`
- **External-browser passkey recovery:** Method **C**

Related decisions: [Owner mutation decision (2026-05)](/owner-mutation-decision-2026-05) (sub-account long-term alternative; parent-CSW Relay remains active product path per AGENTS.md).
