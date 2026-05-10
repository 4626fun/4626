import { getKeeprVaultByGroupId } from '../_lib/keepr/keeprRegistry.js'
import { resolveVaultAccessRoleFromVault } from '../agent/core/resolveVaultRole.js'
import { toAgentError, toUserFacingAgentErrorMessage } from '../agent/eliza/_errors.js'
import { getCommandFamily } from './registry.js'
import { evaluateGroupAdminGate } from './telegramGroupAdminGate.js'
import type { ExecuteCommandParams, KeeprCommandResult, KeeprRole } from './types.js'
import { executeCoinCommandFamily } from './families/coin.js'
import { executeConversationalCommandFamily, looksLikeConversationalCommand } from './families/conversation.js'
import { executeHelpCommandFamily } from './families/help.js'
import { executeAlfaclubCommandFamily } from './families/alfaclub.js'
import { isHermitUserAllowed } from '../_lib/hermit/policy.js'
import { executeHermitCommand } from '../_lib/hermit/skillRouter.js'
import {
  executeKeeprCommandFamily,
  formatAssistantOnlyBlocked,
} from './families/keepr.js'
import { executeSendCommandFamily } from './families/send.js'
import { executeTwitterCommandFamily } from './families/twitter.js'
import { executeWhoisCommandFamily } from './families/whois.js'
import { postTweetFromSystem } from '../twitter/commands.js'

function resolveVaultRole(params: {
  senderWallet: ExecuteCommandParams['senderWallet']
  vault: Awaited<ReturnType<typeof getKeeprVaultByGroupId>>
}): KeeprRole {
  if (!params.vault) return 'MEMBER'
  return resolveVaultAccessRoleFromVault({
    wallet: params.senderWallet,
    vault: params.vault,
  })
}

/**
 * Extract the AlfaClub room id from a deterministic-executor `chatId`
 * (`alfaclub:<digits>`). Returns null for any other surface (Telegram,
 * direct HTTP, etc.) — those callers do not have a room-scoped
 * preference and Hermit falls back to its room-less defaults.
 */
function parseAlfaClubRoomIdFromChatId(chatId: string | undefined): string | null {
  const trimmed = String(chatId ?? '').trim()
  if (!trimmed) return null
  const match = /^alfaclub:(.+)$/i.exec(trimmed)
  if (!match) return null
  const roomId = match[1].trim()
  if (!roomId || roomId.length > 128) return null
  return roomId
}

/**
 * `/hermit`, `/meme`, `/gmeow` are open to any room user when invoked
 * through the AlfaClub bridge (`chatId = 'alfaclub:<roomId>'`). Other
 * surfaces (Telegram, direct HTTP, etc.) keep the
 * `HERMIT_ALLOWED_USERS` allowlist gate so an unrelated caller cannot
 * reach Hermit through, e.g., the deterministic Telegram executor.
 *
 * Bridge-side gates that still apply on the AlfaClub path:
 *   - strict `/`-prefix command parsing in `chatBridge.ts`
 *   - `BARE_GMEOW_TRUSTED_SENDERS` (Manito9v9 only) for bare `gmeow`
 *   - self-reply skip (`selfAddress` + canonical CSW fallback)
 *   - `seenMessageIds` dedupe ledger
 *   - `HERMIT_ALLOWED_ROOM_IDS` / owner-holdings room gate (when
 *     enforced by callers that pass `roomId`).
 */
function isAlfaClubChatId(chatId: string | undefined): boolean {
  return parseAlfaClubRoomIdFromChatId(chatId) !== null
}

function isGmeowPostToXFirstEnabled(): boolean {
  const raw = String(process.env.HERMIT_GMEOW_POST_TO_X_FIRST ?? '')
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim())
}

function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  if (maxLength <= 1) return '…'
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

function buildGmeowTweetText(params: {
  reply: string
  memeCaption?: string
  memeUrl?: string
}): string {
  const lines = params.reply
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('— Want me to remember your style?'))

  const mediaUrl = params.memeUrl || lines.find((line) => isHttpUrl(line)) || ''
  const textLine =
    lines.find((line) => !isHttpUrl(line)) || params.memeCaption || 'cat laugh from the Hermit cave.'

  if (!mediaUrl) return truncateWithEllipsis(textLine, 280)
  const combined = `${textLine}\n${mediaUrl}`
  if (combined.length <= 280) return combined

  const maxTextLength = Math.max(1, 280 - mediaUrl.length - 1)
  return `${truncateWithEllipsis(textLine, maxTextLength)}\n${mediaUrl}`
}

function extractTweetUrl(response: string): string | null {
  const match = response.match(/https:\/\/x\.com\/i\/web\/status\/\d+/i)
  return match?.[0] ?? null
}

type HermitRoomContext = {
  roomId: string | null
  userPreferences:
    | {
        spanishDialect: string | null
        tone?: string | null
        onboardedAt?: string | null
      }
    | null
  persistPreference:
    | ((params: {
        preferenceKey: 'hermit.spanish_dialect' | 'hermit.tone' | 'hermit.onboarded'
        preferenceValue: string
        updatedBy: string
      }) => Promise<void>)
    | null
  listPreferences:
    | (() => Promise<
        Array<{
          preferenceKey: string
          preferenceValue: string | null
          updatedAt: string | null
        }>
      >)
    | null
  clearPreferences: (() => Promise<boolean>) | null
}

/**
 * Resolve per-(room, sender) Hermit preferences from the AlfaClub
 * control-plane store, **best effort**. Any failure (no chat id, no
 * room id, DB outage, dynamic-import error) returns a neutral context
 * so Hermit falls back to its existing room-less behavior — the chat
 * reply must always go out.
 *
 * Imports `userPreferenceStore` dynamically so the Hermit creative
 * lane (`skillRouter`) does not pull AlfaClub control-plane code in.
 */
async function resolveHermitRoomContext(params: {
  chatId: string | undefined
  senderWallet: ExecuteCommandParams['senderWallet']
}): Promise<HermitRoomContext> {
  const roomId = parseAlfaClubRoomIdFromChatId(params.chatId)
  if (!roomId) {
    return {
      roomId: null,
      userPreferences: null,
      persistPreference: null,
      listPreferences: null,
      clearPreferences: null,
    }
  }
  let store: typeof import('../_lib/alfaclub/userPreferenceStore.js')
  try {
    store = await import('../_lib/alfaclub/userPreferenceStore.js')
  } catch {
    return {
      roomId,
      userPreferences: null,
      persistPreference: null,
      listPreferences: null,
      clearPreferences: null,
    }
  }

  // Pull every persisted Hermit preference for this (room, sender) in
  // a single round-trip. The empty-array fallback inside the store
  // means we treat a DB outage as "no preferences" and Hermit falls
  // back to its existing room-less behavior.
  let preferenceRows: Awaited<ReturnType<typeof store.listUserPreferences>> = []
  try {
    preferenceRows = await store.listUserPreferences({
      roomId,
      senderAddress: params.senderWallet,
      keyPrefix: 'hermit.',
    })
  } catch {
    preferenceRows = []
  }
  const valueOf = (key: string): string | null =>
    preferenceRows.find((row) => row.preferenceKey === key)?.preferenceValue ?? null
  const spanishDialect = valueOf('hermit.spanish_dialect')
  const tone = valueOf('hermit.tone')
  const onboardedAt = valueOf('hermit.onboarded')

  const persistPreference: HermitRoomContext['persistPreference'] = async ({
    preferenceKey,
    preferenceValue,
    updatedBy,
  }) => {
    try {
      await store.upsertUserPreference({
        roomId,
        senderAddress: params.senderWallet,
        preferenceKey,
        preferenceValue,
        updatedBy,
      })
    } catch {
      // Best-effort: chat reply must still go out.
    }
  }

  const listPreferences: HermitRoomContext['listPreferences'] = async () => {
    try {
      const rows = await store.listUserPreferences({
        roomId,
        senderAddress: params.senderWallet,
        keyPrefix: 'hermit.',
      })
      return rows.map((row) => ({
        preferenceKey: row.preferenceKey,
        preferenceValue: row.preferenceValue,
        updatedAt: row.updatedAt ?? null,
      }))
    } catch {
      return []
    }
  }

  const clearPreferences: HermitRoomContext['clearPreferences'] = async () => {
    try {
      return await store.clearUserPreferences({
        roomId,
        senderAddress: params.senderWallet,
        keyPrefix: 'hermit.',
      })
    } catch {
      return false
    }
  }

  return {
    roomId,
    userPreferences: { spanishDialect, tone, onboardedAt },
    persistPreference,
    listPreferences,
    clearPreferences,
  }
}



export async function executeCommand(params: ExecuteCommandParams): Promise<KeeprCommandResult> {
  const raw = (params.text ?? '').trim()

  try {
    const gate = await evaluateGroupAdminGate({
      text: raw,
      chatId: params.chatId,
      userId: params.userId,
    })
    if (!gate.allowed) return { ok: false, response: gate.response }

    const family = getCommandFamily(raw)
    let vaultPromise: Promise<Awaited<ReturnType<typeof getKeeprVaultByGroupId>>> | null = null
    const getVault = () => {
      if (!vaultPromise) {
        vaultPromise = getKeeprVaultByGroupId(params.groupId)
      }
      return vaultPromise
    }
    const getRole = async (override?: KeeprRole) => {
      if (override) return override
      const vault = await getVault()
      return resolveVaultRole({ senderWallet: params.senderWallet, vault })
    }

    const helpResult = executeHelpCommandFamily(raw)
    if (helpResult) {
      return helpResult
    }

    if (family === 'whois') {
      return executeWhoisCommandFamily({ text: raw })
    }

    if (looksLikeConversationalCommand(raw)) {
      return executeConversationalCommandFamily({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        text: raw,
        vault: await getVault(),
      })
    }

    switch (family) {
      case 'twitter':
        return executeTwitterCommandFamily({
          groupId: params.groupId,
          senderWallet: params.senderWallet,
          text: raw,
          role: await getRole(params.roleOverrides?.twitter),
        })
      case 'send': {
        const vault = await getVault()
        if (!vault) return { ok: false, response: formatAssistantOnlyBlocked('/send') }
        return executeSendCommandFamily({
          groupId: params.groupId,
          senderWallet: params.senderWallet,
          text: raw,
          role: await getRole(params.roleOverrides?.send),
          vault,
        })
      }
      case 'coin': {
        const vault = await getVault()
        if (!vault) return { ok: false, response: formatAssistantOnlyBlocked('/coin') }
        return executeCoinCommandFamily({
          groupId: params.groupId,
          senderWallet: params.senderWallet,
          text: raw,
          role: await getRole(params.roleOverrides?.coin),
          vault,
        })
      }
      case 'alfaclub':
        return executeAlfaclubCommandFamily({
          text: raw,
          senderWallet: params.senderWallet,
        })
      case 'hermit': {
        if (!isAlfaClubChatId(params.chatId) && !isHermitUserAllowed(params.senderWallet)) {
          return { ok: false, response: 'Hermit access denied.' }
        }
        const hermitRoomContext = await resolveHermitRoomContext({
          chatId: params.chatId,
          senderWallet: params.senderWallet,
        })
        const result = await executeHermitCommand({
          commandText: raw,
          senderAddress: params.senderWallet,
          ...(hermitRoomContext.roomId ? { roomId: hermitRoomContext.roomId } : {}),
          ...(hermitRoomContext.userPreferences
            ? { userPreferences: hermitRoomContext.userPreferences }
            : {}),
          ...(hermitRoomContext.persistPreference
            ? { persistPreference: hermitRoomContext.persistPreference }
            : {}),
          ...(hermitRoomContext.listPreferences
            ? { listPreferences: hermitRoomContext.listPreferences }
            : {}),
          ...(hermitRoomContext.clearPreferences
            ? { clearPreferences: hermitRoomContext.clearPreferences }
            : {}),
        })
        let response = result.reply
        let suppressMediaAttachments = false
        if (result.kind === 'gmeow' && isGmeowPostToXFirstEnabled()) {
          const tweet = await postTweetFromSystem({
            text: buildGmeowTweetText({
              reply: result.reply,
              memeCaption: result.meme?.caption,
              memeUrl: result.meme?.url,
            }),
            groupId: params.groupId,
            senderWallet: params.senderWallet,
          })
          if (tweet.ok) {
            const tweetUrl =
              typeof tweet.action?.tweetUrl === 'string'
                ? tweet.action.tweetUrl
                : extractTweetUrl(tweet.response)
            if (tweetUrl) {
              response = `Posted on X:\n${tweetUrl}`
              suppressMediaAttachments = true
            }
          }
        }
        const mediaAttachments = suppressMediaAttachments
          ? []
          : (result.mediaAttachments ?? [])
        return {
          ok: true,
          response,
          ...(mediaAttachments.length
            ? {
                action: {
                  action: 'hermit.command',
                  kind: result.kind,
                  attachments: mediaAttachments,
                },
              }
            : {}),
        }
      }
    }

    const vault = await getVault()
    return executeKeeprCommandFamily({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      vault,
      role: await getRole(),
    })
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'Keepr command failed')
    return {
      ok: false,
      response: toUserFacingAgentErrorMessage(agentError),
    }
  }
}
