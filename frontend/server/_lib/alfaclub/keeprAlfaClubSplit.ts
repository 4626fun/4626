/**
 * Keepr (4626-keepr-agent / keepr.4626.fun) is the XMTP primary on Railway.
 * AlfaClub room chat, JWT refresh, and Hermit creative lanes run on separate
 * surfaces (Vercel cron + optional 4626-alfaclub-bridge / Hermit Railway service).
 */

function parseBool(value: string | undefined): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
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
