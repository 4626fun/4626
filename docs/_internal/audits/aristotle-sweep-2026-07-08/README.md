# Aristotle segmented sweep (2026-07-08) — raw artifact archive

Provenance: 28 `*-aristotle.tar.gz` drops previously tracked at the repo root. They were raw
artifacts of the 2026-07-08 segmented Aristotle sweep. Findings were triaged and remediated in
[docs/audits/aristotle/OPEN_VS_FIXED_2026-07-08.md](../../../audits/aristotle/OPEN_VS_FIXED_2026-07-08.md);
deep audits already filed under `docs/audits/CreatorOVault_aristotle/`, `docs/audits/aristotle/oracle/`,
and `docs/audits/aristotle/lottery/`.

Only the unique markdown (summaries + audit reports) is filed here, under `<segment>/<uuid-prefix>/`.
Scaffold-only tarballs (boilerplate README `6dbc900e`, Lean scaffolding, Solidity snapshots of repo
code) kept nothing unique. Full raw tarballs remain retrievable from git history (pre-removal commit
`ab8d8c7fa696c133e0dc7b817d384db310cfd20f`), e.g.:

```bash
git show ab8d8c7fa696c133e0dc7b817d384db310cfd20f:277afb5f-163a-4804-9d81-3ec5e758660e-aristotle.tar.gz > /tmp/x.tar.gz
```

## Mapping (UUID prefix → segment → disposition)

| UUID | Segment | Unique markdown | Disposition |
|------|---------|-----------------|-------------|
| 07f6a977 | recovery | none (scaffold only) | removed from root |
| 0b8ab38f | interfaces | SUMMARY + AUDIT | filed `interfaces/0b8ab38f/` |
| 17944f19 | revenue (creator) | SUMMARY + SECURITY_AUDIT | filed `revenue/17944f19/` |
| 203884f2 | shareoft-mesh | none (scaffold only) | removed from root |
| 20cfec21 | vault (creator) | SUMMARY + SECURITY_AUDIT | filed `vault/20cfec21/` |
| 277afb5f | contracts (creator interfaces) | SUMMARY + README + SECURITY_AUDIT_2026-07 | filed `contracts/277afb5f/` |
| 330e70e3 | interfaces (agent) | SUMMARY + AUDIT | filed `interfaces/330e70e3/` |
| 4e059a5b | recovery | SUMMARY + SECURITY_AUDIT | filed `recovery/4e059a5b/` |
| 5353697a | vault (agent) | none (scaffold only) | removed from root |
| 5b90b216 | oracles (creator) | none (scaffold only) | removed from root |
| 69ac39d0 | recovery | SUMMARY (re-run) | filed `recovery/69ac39d0/` |
| 950f79fe | oracles (agent) | SUMMARY + REAUDIT_RemoteOracleLiveness | filed `oracles/950f79fe/` |
| 9a4e6dcf | oracles (agent) | none (scaffold only) | removed from root |
| 9bff10d2 | deploy | SUMMARY + AUDIT_SWEEP_2026-07-08 | filed `deploy/9bff10d2/` |
| 9db825de | agent | SUMMARY + AUDIT_AgentTokenV4_lane_dependencies | filed `agent/9db825de/` |
| 9fc14eba | revenue (agent) | none (scaffold only) | removed from root |
| a25dace9 | vault (agent) | none (scaffold only) | removed from root |
| a8749dda | vault (agent) | none (scaffold only) | removed from root |
| a9b8c09c | bridge | SUMMARY + AUDIT_FINDINGS | filed `bridge/a9b8c09c/` |
| ac9b78e3 | revenue (agent) | SUMMARY + SECURITY_REAUDIT_2026-07-08 | filed `revenue/ac9b78e3/` |
| acba9e39 | libraries | none (scaffold only) | removed from root |
| ad1810dc | oracles (agent) | SUMMARY + SECURITY_AUDIT_AgentOracle | filed `oracles/ad1810dc/` |
| cdcb1298 | revenue (agent) | SUMMARY + SECURITY_AUDIT | filed `revenue/cdcb1298/` |
| ce0ec798 | lottery | SUMMARY + SECURITY_AUDIT | filed `lottery/ce0ec798/` (differs from public `docs/audits/aristotle/lottery/`) |
| d92a49c3 | vault (hub composer) | none (scaffold only) | removed from root |
| dabe623c | strategies | none (scaffold only) | removed from root |
| e4abb614 | oracles (agent) | SUMMARY + AUDIT_lzReceive_reaudit | filed `oracles/e4abb614/` |
| ee1843bb | other (alfaclub) | none (scaffold only) | removed from root |

28 tarballs total: 16 filed, 12 scaffold-only.
