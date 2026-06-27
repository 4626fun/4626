# Internal documentation (repo-only)

Engineering runbooks, wallet/auth specs, audits, and operator notes. **Not published** to [docs.4626.fun](https://docs.4626.fun).

The public site is **product + contracts only** (~18 pages). Allowlist: `apps/docs-site/curatedPublishAllowlist.mjs`.

| Folder | Contents |
|--------|----------|
| `operations/` | Deploy, keepers, Solana, platform, wallet runbooks |
| `security/` · `audits/` | Threat models and audit workpapers |
| `operators/` | Operator hub (legacy) |
| `ACCOUNT_MODEL.md` · `wallet-architecture.md` | Account and signing internals |
| `developers/` · `PUBLISHING.md` | API regen and docs pipeline |
| `deployment-releases-legacy/` | Historical release packets |

To publish something: add to allowlist + `sidebars.ts`, or keep it here.
