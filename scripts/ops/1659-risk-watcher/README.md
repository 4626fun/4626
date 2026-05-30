# 1659 Risk Watcher (End-to-End)

Continuous monitor for the room 1659 HYPE short on Hyperliquid + the live on-chain FriendKey quadratic curve (tokenId 1659, Club tier).

Sends rich alerts to:
- Your private ops Telegram relay
- Public community channel https://t.me/fun4626 (theatrical tone)

## Easy Local Commands (from repo root)

```bash
pnpm ops:1659-watch              # start continuous monitoring
pnpm ops:1659-watch:test         # send test to private + public
pnpm ops:1659-enqueue-recurring  # enqueue a keeper job for this monitor
```

## Deployment Options

### Option A: Railway (recommended for persistent process)
- Point a Railway service at `scripts/ops/1659-risk-watcher/`
- Use the `Dockerfile` in this folder
- Set your existing Telegram env vars (`ALFACLUB_TELEGRAM_*` etc.)

### Option B: As a Keeper Job (managed like all other keepers)
- Use `pnpm ops:1659-enqueue-recurring` (run on a schedule via Vercel cron or another keeper)
- This enqueues jobs of kind `1659_hype_risk_monitor`
- The standard `keeper:jobs:worker` will pick them up and call `/api/keeper/jobs/1659-risk-monitor`
- Full visibility, retries, deduping, and control via the existing keeper system

See `enqueue-recurring.ts` and the API handler `_1659-risk-monitor.ts`.

## Environment Variables (reuses what you already have)

- Telegram relay (private): `ALFACLUB_TELEGRAM_BOT_TOKEN`, `ALFACLUB_TELEGRAM_RELAY_CHAT_ID`, optional thread
- Public broadcast: `FUN4626_TELEGRAM_CHAT_ID` or `ALFACLUB_RADAR_TELEGRAM_CHAT_ID`

The script loads `.env` from multiple sensible locations automatically.
