---
name: zora-cli
version: 1.0.0
description: Zora CLI integration for coin discovery, profile lookups, and optional trade execution with JSON output.
homepage: https://cli.zora.com/skill
metadata: {"zora":{"category":"protocol","cli":"npx @zoralabs/cli"}}
---

# Zora CLI

Use the Zora CLI (`npx @zoralabs/cli`) to interact with Zora on Base.

Always use `--json` for machine-readable output.

## Install

```bash
npm install -g @zoralabs/cli
```

Or run directly:

```bash
npx @zoralabs/cli explore --json --sort trending --limit 5
```

## Environment Variables

- `ZORA_PRIVATE_KEY` - wallet private key for write commands (buy/sell/send)
- `ZORA_API_KEY` - optional API key for higher read limits

## Read Commands (no wallet required)

### Explore

```bash
npx @zoralabs/cli explore --json --sort <mcap|volume|new|trending|featured> --type <all|creator-coin|post|trend> --limit <n>
```

### Get coin

```bash
npx @zoralabs/cli get [creator-coin|trend] <address-or-name> --json
```

### Price history

```bash
npx @zoralabs/cli price-history [creator-coin|trend] <address-or-name> --json --interval <1h|24h|1w|1m|ALL>
```

### Profile

```bash
npx @zoralabs/cli profile <handle-or-address> --json
```

### Auth status

```bash
npx @zoralabs/cli auth status --json
```

## Write Commands (wallet required)

All write commands should include `--yes` for non-interactive execution and `--json` for parseable output.

### Buy

```bash
npx @zoralabs/cli buy <address-or-name> --eth <amount> --json --yes
```

Use `--quote` to preview:

```bash
npx @zoralabs/cli buy <address-or-name> --eth <amount> --quote --json
```

### Sell

```bash
npx @zoralabs/cli sell <address-or-name> --all --json --yes
```

### Send

```bash
npx @zoralabs/cli send eth --to <address> --amount <n> --json --yes
```

### Balance

```bash
npx @zoralabs/cli balance --json
```

### Wallet info

```bash
npx @zoralabs/cli wallet info --json
```

## Error Handling

In JSON mode, check for:

```json
{ "error": "message", "suggestion": "hint" }
```

Do not continue parsing as success when `error` is present.

## 4626 Repository Guardrails

- Production user-facing trading uses the 4626 sub-account execution path: CSW users trade through their app-scoped sub-account signed by the Privy embedded EOA (per `docs/4626-connection-methods.md` Section 2). External EOA users sign directly. Do not route production user trading through this CLI.
- Do not introduce direct `ZORA_PRIVATE_KEY` trading into production app/account paths.
- Treat CLI trading as local tooling unless product requirements explicitly change signer policy.
- Server-side automation (agent / deploy-session) continues to use direct owner delegation on the parent CSW per `.cursor/rules/csw-agent-lifecycle.mdc` — that is orthogonal to both user-facing sub-account trading and this CLI.
