# frontend

Vite/React app and Vercel API for 4626.fun. Full app source migrates here in stages.

## Virtuals ACP adapter (landed)

Public review slice for the Virtuals EconomyOS showcase:

| Path | Role |
| --- | --- |
| `server/agents/eliza/plugins/virtuals/` | ACP plugin: payment gate, quotas, observe-only config, intel/backtest/counter-trade signal jobs, tests |
| `scripts/agent/virtuals-acp-doctor.ts` | Readiness doctor (redacts secrets in output) |
| `scripts/agent/virtuals-acp-doctor-redaction.ts` | Redaction helpers |

```bash
# from monorepo root once frontend deps exist
pnpm -C frontend exec vitest run server/agents/eliza/plugins/virtuals
```

Do not commit `.env` files or live wallet/API credentials into this tree.
