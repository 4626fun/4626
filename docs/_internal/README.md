# Internal documentation (repo-only)

Working papers, design specs, migration logs, and operator tracking. **Not published** to [docs.4626.fun](https://docs.4626.fun).

Public site uses an explicit allowlist: `apps/docs-site/curatedPublishAllowlist.mjs` (~69 pages). CI runs `check-curated-allowlist.mjs` to keep the sidebar aligned.

| Folder | Contents |
|--------|----------|
| `operations/` | Unpublished deployment/vault/wallet/solana runbooks, dune SQL, archive |
| `concepts/` | Legacy concept stubs (redirect to contract narratives) |
| `operations-tracking/` | Railway/Keepr checklists, CI tracking |
| `guides/` | Featured-guidelines working notes |
| `indexer/` | Zora CSW indexer cron spec and runbook |
| `wallet-notes/` | CSW reconciliation, owner-mutation decisions |
| `migration/` | Schema migration runbooks |
| `design/` | UX/architecture RFCs |
| `audits-workpapers/` | In-progress audit matrices |
| `deployment-releases-legacy/` | v1.7–v1.14.0 release packets |
| `research/` · `perplexity/` | RFCs and skill packs |

To publish a doc: move to `docs/`, add path to `curatedPublishAllowlist.mjs`, add to `sidebars.ts` / `operationsSidebar.ts`. See [Publishing](/publishing).
