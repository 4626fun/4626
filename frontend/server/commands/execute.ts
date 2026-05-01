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

type HermitRoomContext = {
  roomId: string | null
  userPreferences: { spanishDialect: string | null } | null
  persistPreference:
    | ((params: {
        preferenceKey: 'hermit.spanish_dialect'
        preferenceValue: string
        updatedBy: string
      }) => Promise<void>)
    | null
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
    return { roomId: null, userPreferences: null, persistPreference: null }
  }
  let store: typeof import('../_lib/alfaclub/userPreferenceStore.js')
  try {
    store = await import('../_lib/alfaclub/userPreferenceStore.js')
  } catch {
    return { roomId, userPreferences: null, persistPreference: null }
  }

  let spanishDialect: string | null = null
  try {
    const record = await store.readUserPreference({
      roomId,
      senderAddress: params.senderWallet,
      preferenceKey: 'hermit.spanish_dialect',
    })
    spanishDialect = record?.preferenceValue ?? null
  } catch {
    // Read is already best-effort inside the store, but guard again.
    spanishDialect = null
  }

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

  return {
    roomId,
    userPreferences: { spanishDialect },
    persistPreference,
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
        })
        return {
          ok: true,
          response: result.reply,
          ...(result.mediaAttachments?.length
            ? {
                action: {
                  action: 'hermit.command',
                  kind: result.kind,
                  attachments: result.mediaAttachments,
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
