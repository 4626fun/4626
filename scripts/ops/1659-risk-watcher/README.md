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

## Deployment on Railway (Recommended)

This is the cleanest and most reliable way to run the watcher 24/7.

### Steps

1. In Railway, create a **new service**.
2. Connect your GitHub repo.
3. In the service settings, set:
   - **Root Directory**: `scripts/ops/1659-risk-watcher`
   - Builder will automatically use the `Dockerfile` (thanks to `railway.json`)
4. Add these environment variables (reuse the ones you already have for the AlfaClub Telegram relay):
   - `ALFACLUB_TELEGRAM_BOT_TOKEN` (or fallback `TELEGRAM_BOT_TOKEN`)
   - `ALFACLUB_TELEGRAM_RELAY_CHAT_ID` or `TELEGRAM_TARGET_CHAT_ID`
   - `ALFACLUB_TELEGRAM_RELAY_THREAD_ID` (optional)
   - `FUN4626_TELEGRAM_CHAT_ID` or `ALFACLUB_RADAR_TELEGRAM_CHAT_ID` (for https://t.me/fun4626)

5. Deploy.

The service runs as a long-lived background worker (no HTTP port needed).

**Important**: The script now handles `SIGTERM` properly, which Railway sends during deploys and restarts.

You can monitor logs, metrics, and restarts directly in the Railway dashboard.

## Environment Variables (reuses what you already have)

- Telegram relay (private): `ALFACLUB_TELEGRAM_BOT_TOKEN`, `ALFACLUB_TELEGRAM_RELAY_CHAT_ID`, optional thread
- Public broadcast: `FUN4626_TELEGRAM_CHAT_ID` or `ALFACLUB_RADAR_TELEGRAM_CHAT_ID`

The script loads `.env` from multiple sensible locations automatically.
