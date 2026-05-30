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

## Environment Variables for Railway

The watcher is designed to reuse the exact same Telegram configuration you already use for AlfaClub / Hermit.

### Required variables (copy these into Railway)

```env
# Bot that can post messages
ALFACLUB_TELEGRAM_BOT_TOKEN=8741120609:AAHsEkPOKN2eb9mJtNa4aneaYoxQ-oKZoPU

# Private ops relay (detailed alerts)
ALFACLUB_TELEGRAM_RELAY_CHAT_ID=-1003709479662
ALFACLUB_TELEGRAM_RELAY_THREAD_ID=2

# Public channel (theatrical alerts visible to everyone)
ALFACLUB_RADAR_TELEGRAM_CHAT_ID=@fun4626
```

### Alternative variable names (also supported)

The script tries multiple common names so you can reuse whatever you already have set:

- Bot token: `ALFACLUB_TELEGRAM_BOT_TOKEN` or `TELEGRAM_BOT_TOKEN`
- Private chat: `ALFACLUB_TELEGRAM_RELAY_CHAT_ID` or `TELEGRAM_TARGET_CHAT_ID`
- Public channel: `ALFACLUB_RADAR_TELEGRAM_CHAT_ID`, `FUN4626_TELEGRAM_CHAT_ID`, or `TARGET_CHAT_ID`

A ready-to-use `.env.example` file exists in this folder.

**Tip**: After setting the variables in Railway, redeploy the service. The startup logs will clearly show the status of the private relay and public channel.

## Railway Service Recommendations

- **Restart Policy**: Always
- **Healthcheck Path**: `/health` (the script automatically starts a tiny server on the assigned `PORT`)
- **Healthcheck Timeout**: 30 seconds

### Healthcheck Response

The `/health` endpoint now returns useful JSON:

```json
{
  "status": "ok",
  "lastTick": "2026-05-30T...",
  "lastStatus": "success",
  "uptimeSeconds": 12345,
  "wallet": "0xEbF9..."
}
```

This lets you monitor in Railway when the last successful risk check happened.
