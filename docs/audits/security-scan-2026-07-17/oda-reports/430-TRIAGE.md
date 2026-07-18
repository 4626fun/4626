# ODA job 430 — Registry4626 triage (2026-07-18)

**Scope:** `contracts/shared/core/Registry4626.sol`  
**Track:** https://onedollaraudit.com/audit/430  
**Overlaps:** ODA 422 F1/F3/F4 (same root causes, higher confidence here)

| ID | Sev | One-liner | Disposition |
|----|-----|-----------|-------------|
| **F1** | High | Reverse-map conflict missing on vault/wrapper/oracle/gauge | **Fixed** — same guard as `setShareOFTForToken` |
| **F2** | Medium | `removeRemoteOFTPeer*` wipes shared reverse map | **Fixed** — delete reverse only when no remaining EID references peer |
| **F3** | High | Unvalidated `creator` front-run / permanent hijack | **Fixed** — reject zero creator; owner `setCreator` recovery path |
| **F4** | Medium | Auth is global across factories | **Accepted** — trust model; keep factory set minimal (doc) |
| **F5** | Medium | `setAgentIntegrationMeta` no registration check | **Fixed** — `TokenNotRegistered`; batcher registers before meta |
| **F6** | Medium | Factory codehash pin one-time / proxy-weak | Open / ops — authorize only non-upgradeable factories |
| **F7** | Medium | Global `liveRebindEnabled` | Open — per-token rebind follow-up |
| **F8** | Medium | Remote OFT peers no one-shot | **Fixed** — `_requireBindingWritable` / liveRebind on replace |
| **F9** | Medium | chainId↔eid repoint orphans | **Fixed** — clear stale reverse; reject EID conflicts |
| **F10** | Medium | Unbounded remote-OFT chain arrays | **Fixed** — `MAX_REMOTE_OFT_CHAINS_PER_TOKEN = 64` |
| **F11** | Low | `setLzConfig` can zero endpoint | **Fixed** — zero endpoint + eid==0 rejected |
| **F12** | Low | Dual address/bytes32 peer namespaces | Open / backlog |
| **F13** | Low | `getEffectiveLzConfig` over-reports configured | **Fixed** — eid==0 ⇒ `isConfigured=false` |
| **F14** | Low | `renounceOwnership` bricks admin | **Fixed** — override reverts |

## Sibling notes

- **422** F1/F3/F4 closed by this patch set.
- **432** (gauge v2) largely overlaps **424** already patched (lottery-manager timelock, fail-closed fallback, `sqrtPriceLimitX96=0`).
