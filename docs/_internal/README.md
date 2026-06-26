# Internal documentation (repo-only)

Working papers, design specs, migration logs, and operator tracking. **Not published** to [docs.4626.fun](https://docs.4626.fun) — excluded by `apps/docs-site/scripts/sync-docs.mjs` (`docs/_internal/**`).

| Folder | Contents |
|--------|----------|
| `indexer/` | Zora CSW indexer cron spec and runbook |
| `wallet-notes/` | CSW reconciliation, EOA lane verification, owner-mutation decisions |
| `migration/` | Schema migration runbooks and smoke checklists |
| `design/` | UX/architecture RFCs (sub-accounts, typography, Zora payout, etc.) |
| `audits-workpapers/` | In-progress audit matrices and deep-risk logs |
| `deployment-releases-legacy/` | v1.7–v1.14.0 release packets (superseded by [current release](/operations/deployment/releases/current)) |
| `deployment-v1.10.1/` | Historical v1.10.1 broadcast playbooks |
| `operations-tracking/` | Railway/Keepr checklists, CI tracking, SQL snippets |
| `alfaclub-experimental/` | Niche operator docs |
| `research/` · `perplexity/` | RFCs and exported skill packs |

When a doc is ready for operators or the public:

1. Move it under `docs/operations/` or the appropriate published lane
2. Add it to `apps/docs-site/src/lib/operationsSidebar.ts` or `sidebars.ts`
3. Add a redirect in `apps/docs-site/redirects.ts` if the old URL was bookmarked

Contributors: [Publishing guide](/publishing) (published at `/publishing`).
