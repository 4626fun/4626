/**
 * Keepr (4626-keepr-agent / keepr.4626.fun) is the XMTP primary on Railway.
 * AlfaClub room chat, JWT refresh, and Hermit creative lanes run on separate
 * surfaces (Vercel cron backup + optional Hermit Railway service).
 */

export function parseAlfaClubBoolEnv(value: string | undefined): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function parseBool(value: string | undefined): boolean {
  return parseAlfaClubBoolEnv(value)
}

export function isRailwayRuntimeEnv(): boolean {
  return Boolean(
    String(process.env.RAILWAY_SERVICE_ID ?? '').trim() ||
      String(process.env.RAILWAY_PROJECT_ID ?? '').trim() ||
      String(process.env.RAILWAY_ENVIRONMENT_ID ?? '').trim(),
  )
}

export function isAlfaClubRailwayBridgeOverrideEnabled(): boolean {
  return parseBool(process.env.ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY)
}

/** Railway Keepr should not mount in-process AlfaClub bots unless explicitly overridden. */
export function isKeeprRailwayAlfaClubSplit(): boolean {
  return isRailwayRuntimeEnv() && !isAlfaClubRailwayBridgeOverrideEnabled()
}

/**
 * True when the dedicated Hermit Railway service owns the live AlfaClub bridge
 * (long-lived polling + optional in-process Privy refresh).
 */
export function isAlfaClubRailwayHermitPrimaryConfigured(): boolean {
  return parseBool(process.env.ALFACLUB_RAILWAY_HERMIT_PRIMARY)
}

/**
 * Vercel's minute bridge cron should no-op when Hermit Railway is the primary
 * poller. Set `ALFACLUB_RAILWAY_HERMIT_PRIMARY=1` on Vercel after Hermit owns
 * the bridge to avoid duplicate room polling.
 */
export function shouldSuppressVercelBridgeCron(): boolean {
  return (
    isAlfaClubRailwayHermitPrimaryConfigured() ||
    parseBool(process.env.ALFACLUB_VERCEL_BRIDGE_CRON_DISABLED)
  )
}

/**
 * Vercel's token-refresh cron can be retired when Hermit runs the in-process
 * refresher (`ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED=1`). Keep an hourly Vercel
 * backup unless explicitly disabled.
 */
export function shouldSuppressVercelTokenRefreshCron(): boolean {
  return parseBool(process.env.ALFACLUB_VERCEL_TOKEN_REFRESH_CRON_DISABLED)
}
