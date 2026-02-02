# Keepr Threat Model (MVP)

This document enumerates key threats, mitigations, and safe defaults for **Keepr**, a vault-bound operator agent embedded in **Base Chat (XMTP)**.

Keepr’s mission is deterministic enforcement of **explicit rules** using **onchain truth**, while minimizing authority, secrets, and discretionary behavior.

---

## 0) Security Goals

### Primary goals
- **Prevent unauthorized chat access** to token-gated groups.
- **Prevent unauthorized admin actions** (lock/unlock, sync, rule changes).
- **Avoid identity confusion** (canonical owner vs execution wallet vs social identity).
- **Remain walkaway-safe** (no secrets, exportable state).

### Non-goals (MVP)
- Perfect prevention of social engineering (users can still be tricked).
- Preventing all spam in chat (XMTP is a comms layer).
- Fully decentralized enforcement (agent is offchain infra in MVP).

---

## 1) Assets and Trust Boundaries

### Protected assets
- XMTP group membership list (who has access)
- Admin privileges (who can run privileged commands)
- Vault bindings / config (addresses, thresholds, groupId)
- Onchain gating policy (thresholds and mode)

### Trust boundaries
- **Onchain state (Base)**: highest-trust source for balances and ownership
- **XMTP identity mapping (inbox → wallet)**: medium trust, depends on implementation
- **Farcaster context (FID, verified addresses)**: UX-only unless explicitly verified
- **Indexers**: optional; must not override direct chain reads
- **Pinned config messages / server storage**: must be integrity-checked

---

## 2) Adversary Model

Assume adversaries may be:

- **Unauthorized users** attempting to join gated chat without holding shares
- **Members** attempting to retain access after selling shares
- **Malicious members** attempting to trigger admin actions or spam commands
- **Compromised admin wallet** or compromised device
- **Sybil / multi-wallet users** cycling wallets to evade enforcement
- **Infrastructure attacker** (RPC manipulation, config tampering)

---

## 3) Threats and Mitigations

### T1 — XMTP wallet mapping spoofing
**Attack:** User convinces the integration layer to map their inbox to someone else’s wallet, or presents a false address association.

**Impact:** Unauthorized access.

**Mitigations (MVP):**
- Require **cryptographic proof** of wallet control for inbox ↔ wallet association (sign-in flow / XMTP identity proof, depending on stack).
- Treat mappings as **immutable per session** unless re-verified.
- Store mapping evidence (timestamp, method, signature reference) for audit.

**Safe default:** If mapping cannot be verified → **deny access** (fail closed).

---

### T2 — Indexer / cache inconsistency
**Attack:** Indexer returns stale or incorrect balances (or attacker targets indexer).

**Impact:** Incorrect eligibility decisions.

**Mitigations (MVP):**
- Prefer **direct RPC reads** for balances.
- Include `blockNumber` in evidence and in responses.
- If indexer is used, treat it as **advisory only**.

**Safe default:** If reads disagree → trust **direct chain read**; if read fails → deny.

---

### T3 — RPC provider manipulation / outage
**Attack:** RPC provider is compromised or returns incorrect state, or fails.

**Impact:** Unauthorized joins or incorrect removals.

**Mitigations (MVP):**
- Use **multiple RPC providers** and compare results (N-of-M) for critical decisions.
- If providers disagree significantly, halt access decisions and alert OWNER/ADMIN.
- Rate-limit retries and avoid spam.

**Safe default:** If onchain truth cannot be established → **deny joins**, avoid bulk removals until stable.

---

### T4 — Replay / timing attacks on eligibility
**Attack:** User joins while eligible, then immediately sells shares; or races membership checks.

**Impact:** Temporary unauthorized presence.

**Mitigations (MVP):**
- Define an explicit **enforcement window** (e.g., periodic checks every N minutes).
- Provide `/keepr sync` for admins to force recheck.
- Optionally check eligibility again at join-time and within short grace period.

**Safe default:** Accept that short-lived access is possible; remove within defined window.

---

### T5 — Command spoofing / parsing ambiguity
**Attack:** User crafts messages that cause unintended command execution.

**Impact:** Unauthorized actions.

**Mitigations (MVP):**
- Commands must start with strict prefix: `/keepr`
- Deterministic grammar; reject anything ambiguous.
- Never infer admin intent from normal chat messages.

**Safe default:** Unknown/malformed command → respond with `/keepr help` only.

---

### T6 — Unauthorized admin commands (role escalation)
**Attack:** Non-admin runs `/keepr lock` or `/keepr sync`.

**Impact:** Denial of service, incorrect removals, rule tampering.

**Mitigations (MVP):**
- Enforce roles via **wallet address** (OWNER/ADMIN lists), not usernames.
- Require requester wallet to be verified (same mapping proof as eligibility).
- Log all privileged actions with evidence.

**Safe default:** If requester role cannot be verified → deny.

---

### T7 — Config tampering (vault bindings / thresholds)
**Attack:** Attacker modifies config storage (pinned message or server) to point to different vault/group or lower threshold.

**Impact:** Full compromise of gating.

**Mitigations (MVP):**
- Treat config as immutable unless changed by OWNER via authorized command.
- Store a **config hash** and include it in pinned message + server record.
- Require updates to include:
  - old config hash
  - new config hash
  - signer identity (OWNER)
- Optionally maintain a minimal append-only audit log.

**Safe default:** If config integrity check fails → freeze privileged operations and deny joins.

---

### T8 — Group permission takeover (XMTP permissions)
**Attack:** Malicious admin/member tries to change group roles or remove Takopi.

**Impact:** Loss of enforcement.

**Mitigations (MVP):**
- Ensure Takopi is assigned **admin** and OWNER is **super admin**.
- Minimize who is granted admin permissions at group level.
- If XMTP supports it, restrict who can add/remove admins.

**Safe default:** If Takopi loses admin power → stop claiming enforcement guarantees; alert OWNER.

---

### T9 — Spam / resource exhaustion
**Attack:** User spams `/keepr check` or triggers repeated rechecks.

**Impact:** Denial of service, RPC cost blowup, chat noise.

**Mitigations (MVP):**
- Rate-limit per user and globally (`commandCooldownMs`).
- Batch sync operations; cap batch size.
- Prefer DM for denials.

**Safe default:** Exceed rate limit → short denial message, no RPC calls.

---

### T10 — Sybil / multi-wallet bypass
**Attack:** User uses multiple wallets to remain in group.

**Impact:** Increased enforcement complexity.

**Mitigations (MVP):**
- Scope enforcement to the verified wallet(s) per inbox.
- Track last-verified wallet per inbox.
- Optionally require re-verification when wallet changes.

**Safe default:** Treat new wallet as new identity; re-verify before granting access.

---

### T11 — Social engineering against users
**Attack:** Scammer impersonates Takopi or admins, tricks users into sending funds/keys.

**Impact:** User loss.

**Mitigations (MVP):**
- Takopi must never ask for secrets.
- Standardize warning messages:
  - “Takopi will never ask for seed phrases or private keys.”
- Use a consistent, verifiable agent identity in chat (name + pinned message).

**Safe default:** If asked for sensitive info → refuse and display security warning.

---

### T12 — False removals (eligibility misread)
**Attack:** Bugs or temporary RPC issues cause removals of eligible members.

**Impact:** Community trust damage.

**Mitigations (MVP):**
- Prefer fail-closed for joins, but **fail-safe for removals**:
  - require two consecutive failed checks before removing, or
  - require N-of-M RPC confirmation for removals
- DM removals with rejoin instructions and evidence.

**Safe default:** If uncertain, do not remove; retry later.

---

## 4) Safe Defaults Summary

- **Joins:** fail closed (deny if cannot prove eligibility)
- **Removals:** fail safe (avoid removing on uncertain data)
- **Config:** immutable unless OWNER-authorized, integrity-checked
- **Authority:** minimal; no signing/custody; command-only admin
- **Data sources:** direct chain reads > indexers
- **Messaging:** DM denials/removals; rate-limit everything

---

## 5) Logging and Evidence (MVP)

Every sensitive action should capture:

- action type (add/remove/lock/unlock/sync)
- requester identity (wallet + inboxId if available)
- role used (OWNER/ADMIN)
- gating inputs (balance, threshold)
- `blockNumber`
- config hash/version

Evidence must be sufficient for postmortems without storing secrets.

---

## 6) Operational Runbooks (MVP)

### Incident: Unauthorized member in group
- Run `/keepr sync`
- Verify onchain threshold and balances
- Confirm mapping proof method
- Rotate group invite / join settings if needed

### Incident: Keepr removed or loses admin privileges
- OWNER re-add Keepr as admin
- Re-pin config summary
- Re-run `/keepr status` and `/keepr sync`

### Incident: RPC instability
- Temporarily lock joins (`/keepr lock`)
- Switch or add RPC providers
- Resume when direct reads are stable

---

## 7) Open Questions / Future Hardening

- Multi-RPC quorum strategy (N-of-M) thresholds
- Onchain config registry with OWNER signature proofs
- Better sybil resistance (optional Farcaster verification, reputation)
- Member privacy constraints (minimize holder listings)
- Formal verification of command parser

---

## 8) Acceptance Criteria (Security)

MVP is acceptable when:

- Unauthorized users cannot join without meeting onchain gating rule.
- Non-admins cannot execute privileged commands.
- Config changes require OWNER authorization and are integrity-checked.
- Failures default to denying joins and avoiding noisy removals.
- Takopi never requests secrets and warns against impersonation.
