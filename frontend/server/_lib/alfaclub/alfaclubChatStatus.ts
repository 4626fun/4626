import type { AlfaClubAuthHealthSnapshot } from './authHealthStore.js'
import { readAuthHealthSnapshot } from './authHealthStore.js'
import { readAlfaClubChatToken } from './chatTokenStore.js'
import type { VigilanteFlags } from './vigilante.js'

function formatRelativeMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return 'n/a'
  if (minutes < 0) return `expired ${Math.abs(minutes)}m ago`
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function formatIsoShort(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

export function formatBridgeAuthHealthLines(snapshot: AlfaClubAuthHealthSnapshot): string[] {
  const lines: string[] = ['**Bridge auth**']
  const live = snapshot.liveChatJwt
  if (live) {
    const writerFlag = live.writerAnomaly.isAnomalous ? ' ⚠️' : ''
    lines.push(
      `JWT: ${formatRelativeMinutes(live.minutesUntilExpiry)} until expiry · writer \`${live.writer ?? 'unknown'}\`${writerFlag}`,
    )
  } else {
    lines.push('JWT: no live chat_jwt row')
  }

  const lastOk = snapshot.lastSuccess
  const lastFail = snapshot.lastFailure
  lines.push(
    `Refresh: last ok ${formatIsoShort(lastOk?.at ?? null)} · last fail ${formatIsoShort(lastFail?.at ?? null)}`,
  )
  if ((lastFail as any)?.code) {
    lines.push(`Last fail code: \`${(lastFail as any).code}\``)
  }

  const b = snapshot.bridge
  lines.push(
    `Bridge loop: authFails=${b.consecutiveAuthFailures} · cfChallenges=${b.consecutiveCfChallenges}${b.cfChallengeSustained ? ' (sustained)' : ''} · socketBackoff=${b.socketBackoffMs}ms`,
  )
  return lines
}

export async function readAlfaClubChatStatusSnapshot(): Promise<AlfaClubAuthHealthSnapshot | null> {
  try {
    const liveTokenRecord = await readAlfaClubChatToken().catch(() => null)
    const liveChatJwt = liveTokenRecord
      ? {
          jwt: null,
          updatedAt: liveTokenRecord.updatedAt,
          updatedBy: liveTokenRecord.updatedBy,
          expiresAtIso: liveTokenRecord.expiresAt,
        }
      : null
    return await readAuthHealthSnapshot({ liveChatJwt })
  } catch {
    return null
  }
}

export async function formatAlfaClubStatusForChat(flags: VigilanteFlags): Promise<string> {
  const lines: string[] = [
    '**AlfaClub status**',
    '',
    `Pipeline: KILL_SWITCH=${flags.killSwitch ? 'ON' : 'off'} · READ=${flags.readEnabled ? 'on' : 'off'} · POST=${flags.postEnabled ? 'on' : 'off'}`,
    `TOP_N=${flags.topN} · COOLDOWN=${flags.cooldownHours}h`,
  ]

  const snapshot = await readAlfaClubChatStatusSnapshot()
  if (snapshot) {
    lines.push('')
    lines.push(...formatBridgeAuthHealthLines(snapshot))
  } else {
    lines.push('')
    lines.push('Bridge auth: unavailable (DB or health store read failed).')
  }

  return lines.join('\n')
}
