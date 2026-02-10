# Deprecated

This directory has been superseded by the unified ElizaOS runtime at:

```
frontend/server/agent/eliza/
```

The unified version:
- Lives inside the frontend package so it can import server modules directly
- Delegates to the production `handleKeeprCommand()` instead of reimplementing vault commands
- Calls wallet intelligence and reputation modules directly (no HTTP bridge)
- Runs the multi-agent orchestrator (loads agents from DB, supports EOA + CSW signers)

To start the unified agent:

```bash
cd frontend
pnpm agent:eliza
```

This directory is kept as a reference only. Do not add new code here.
