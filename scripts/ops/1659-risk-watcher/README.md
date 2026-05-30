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

**Best practice**: Use the master environment file for the full 1659 theatrical stack:

```bash
scripts/ops/1659-theatrical-stack.env.example
```

This single file covers everything needed for both the risk watcher **and** the Hermit creative agent (including the rich 1659 context with live Hyperliquid + on-chain curve + PnL).

### Minimum for the watcher alone (Telegram only)

The watcher reuses your existing AlfaClub/Hermit Telegram relay config.

Required (at minimum):
- `ALFACLUB_TELEGRAM_BOT_TOKEN` (or fallback `TELEGRAM_BOT_TOKEN`)
- At least one destination:
  - Private ops relay: `ALFACLUB_TELEGRAM_RELAY_CHAT_ID` (or `TELEGRAM_TARGET_CHAT_ID`)
  - Public channel: `ALFACLUB_RADAR_TELEGRAM_CHAT_ID` / `FUN4626_TELEGRAM_CHAT_ID`

For **rich** 1659 context in the alerts (strongly recommended), you also need from the master file:
- `DATABASE_URL`
- AlfaClub auth (`ALFACLUB_CHAT_JWT` or the Privy refresh triplet)

### Alternative variable names (also supported)

The script accepts many common names so you can reuse whatever you already have:

- Bot token: `ALFACLUB_TELEGRAM_BOT_TOKEN` or `TELEGRAM_BOT_TOKEN`
- Private chat: `ALFACLUB_TELEGRAM_RELAY_CHAT_ID` or `TELEGRAM_TARGET_CHAT_ID`
- Public channel: `ALFACLUB_RADAR_TELEGRAM_CHAT_ID`, `FUN4626_TELEGRAM_CHAT_ID`, or `TARGET_CHAT_ID`

**Tip**: After setting variables in Railway, redeploy. On startup you will see a clear block:

```
[1659-risk-watcher][early] === 1659 THEATRICAL STACK ENV DIAGNOSTICS ===
[1659-risk-watcher][early] SUMMARY: ...
```

Plus a ✅ / ⚠️ line telling you whether rich 1659 context (Hyperliquid + curve + PnL) is enabled.

## Railway Service Recommendations

- **Restart Policy**: Always
- **Healthcheck Path**: `/health`
- **Healthcheck Timeout**: 30 seconds

A `railway.toml` file is included in the folder with these settings declared.

### Healthcheck Response

The `/health` endpoint returns rich JSON (and returns HTTP 503 when unhealthy):

```json
{
  "status": "ok",
  "lastTick": "2026-05-30T...",
  "lastStatus": "success",
  "lastError": null,
  "consecutiveFailures": 0,
  "uptimeSeconds": 12345,
  "wallet": "0xEbF9..."
}
```

Railway can use this for automatic health monitoring. After 3 consecutive failures the endpoint will start returning 503.

It also includes the latest position snapshot (`currentPosition`) so you can see the live risk level directly from the healthcheck.

### Startup Notification

Every time the watcher starts (including after Railway deploys), it sends a "🟢 1659 Risk Watcher is now LIVE" message to both your private relay and the public https://t.me/fun4626 channel. This is very useful to confirm it's running after deploys.
