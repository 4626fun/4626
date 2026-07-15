# Wallet Identity — Protocol vs Operator CSW

On-demand Tier 2 context. Read when tasks touch agent identity, XMTP inbox routing, ERC-8004, AMOE publishers, or operator custody.

Authoritative code: `frontend/src/wallet/canonicalWalletPolicy.ts`, `frontend/server/_lib/wallet/canonicalCswEnv.ts`, `docs/_internal/ACCOUNT_MODEL.md` §5.3.

## Two CSW pins (July 2026 cutover)

| Pin | Address | Role |
|-----|---------|------|
| `PROTOCOL_CSW_ADDRESS` | `0x793ca28123cba3ca3c20b9c6c67f37510c89c145` | **4626 protocol agent** — XMTP Agent 4626 inbox, Railway Keepr/Hermit ERC-4337 sender, ERC-8004 agent #2205 owner, AMOE `allowlistPublisher` / `pointsLedgerPublisher`, `/.well-known/agent-registration.json` |
| `CANONICAL_CSW_ADDRESS` | `0xAb6d5C10b03300326CD7fAb7267Ae192842967b5` | **Operator personal account** — custody, sponsored swaps, AKITA vault owner, owner-install — same architectural role as any creator's `profiles.csw_address` |

Do not conflate protocol agent identity with operator custody. Env: `PROTOCOL_CSW_*` + `CANONICAL_CSW_*` (`canonicalCswEnv.ts`).

## Execution tracks

- **User-initiated frontend (`executionMode === 'canonical'`)**: sender = user's `profiles.csw_address`; signer = Privy embedded EOA owner.
- **Server-side Railway XMTP / Keepr / ERC-8004**: sender = `PROTOCOL_CSW_ADDRESS`; signer = Privy server wallet at owner slot 2 (`0x858c…`).
- **Deploy-session automation**: sender = creator's `profiles.csw_address`; temporary delegated server owner.

## Third identities (do not merge)

- **Hermit4626 AlfaClub bot CSW** (`0x8719fa7Be10533fd69885b124a8c84f9C51071AF`) — room chat only; XMTP "agent" alerts borrow protocol CSW identity via owner-index-2 delegation.
- **Retired legacy CSW** (`0x4beabd…704EF`) — historical co-owner on protocol CSW only; cannot be reactivated as live signer.
- **`4626.base.eth` Basename** — operator display (`0xB05Cf…`), not custody or agent inbox truth.

## Verification

```bash
pnpm -C frontend exec tsx --env-file=.env scripts/ops/verify-protocol-csw-cutover.ts
pnpm -C frontend guard:canonical-csw
```

## Chat / UI rules

- `getAgentIdentity()` resolves **protocol** CSW for Agent 4626 rail rows — not operator CSW.
- User XMTP sender = parent `profiles.csw_address` (user's own inbox).
- Primary account chrome: external EOA identity; CSW shown separately. Never show Privy embedded EOA as primary identity.
- Curated external agents (Zora agent, `.base.eth` agents) must not run through operator CSW remapping.

## Migrated notes (pre-reconciliation)

The bullets below were migrated from the monolithic `agent-learned-facts.md`. Prefer the table above when they conflict.

## Learned User Preferences

- Agent-install / delegate-signing surfaces must avoid alarming verbs ("install", "connect", "drain"); prefer "delegate signing authority", "add co-signer", "authorize".

- In account chrome: primary identity = connected external EOA (ENS/Basename); canonical CSW separate; never Privy embedded EOA as primary.

## Learned Workspace Facts

- After `addOwnerAddress` on either CSW, update allowlists per `.cursor/rules/csw-agent-lifecycle.mdc` § Canonical CSW owner allowlist.

- AKITA vault **owner** = operator `CANONICAL_CSW_ADDRESS` (grandfathered vault, not in Registry4626).

- Portfolio holdings: dedupe when external EOA equals canonical CSW.

- XMTP agent "not replying" is usually delivery/install drift — check Railway logs and install count before assuming runtime crash.
