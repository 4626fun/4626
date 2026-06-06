import { getKeeprVaultByGroupId } from '../_lib/keepr/keeprRegistry.js'
import { resolveVaultAccessRoleFromVault } from '../agents/core/resolveVaultRole.js'
import { toAgentError, toUserFacingAgentErrorMessage } from '../agents/eliza/_errors.js'
import { getCommandFamily } from './registry.js'
import { evaluateGroupAdminGate } from './telegramGroupAdminGate.js'
import type { ExecuteCommandParams, KeeprCommandResult, KeeprRole } from './types.js'
import { executeCoinCommandFamily } from './families/coin.js'
import { executeConversationalCommandFamily, looksLikeConversationalCommand } from './families/conversation.js'
import { executeHelpCommandFamily } from './families/help.js'
import { executeAlfaclubCommandFamily } from './families/alfaclub.js'
import { isHermitUserAllowed, isHermitOwner } from '../_lib/hermit/policy.js'
import {
  checkHermitCommandCooldown,
  recordHermitCommandCooldown,
  resolveHermitCooldownCommand,
} from '../_lib/alfaclub/hermitCommandCooldown.js'
import { executeHermitCommand } from '../_lib/hermit/skillRouter.js'
import { pickHermitReactionEmoji } from '../_lib/hermit/reactionEmoji.js'
import {
  isHermitOperatorOnlyCommand,
  isTrustedHermitOperator,
} from '../_lib/hermit/operatorPolicy.js'
import {
  executeKeeprCommandFamily,
  formatAssistantOnlyBlocked,
} from './families/keepr.js'
import { executeSendCommandFamily } from './families/send.js'
import { executeTwitterCommandFamily } from './families/twitter.js'
import { executeWhoisCommandFamily } from './families/whois.js'
import { postTweetFromSystem } from '../twitter/commands.js'
import { formatHermitXCrossPostSkipMessage, truncateWithEllipsis } from './hermitXPostHelpers.js'

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

function isHermitNonAlfaClubPostXFirstEnabled(): boolean {
  const raw = String(process.env.HERMIT_NON_ALFACLUB_POST_X_FIRST ?? '')
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function isHermitAlfaClubPostXFirstEnabled(): boolean {
  const raw = String(process.env.HERMIT_ALFACLUB_POST_X_FIRST ?? '1')
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function stripImageUrlsFromHermitReply(reply: string, mediaUrl: string | null): string {
  const lines = reply
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (!isHttpUrl(line)) return true
      if (mediaUrl && line === mediaUrl) return false
      return !isLikelyImageUrl(line)
    })
  return lines.join('\n').trim()
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim())
}

function isLikelyImageUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!isHttpUrl(trimmed)) return false
  try {
    const parsed = new URL(trimmed)
    const path = parsed.pathname.toLowerCase()
    if (/\.(gif|jpe?g|png|webp)$/.test(path)) return true
    const filename = String(parsed.searchParams.get('filename') ?? '').toLowerCase()
    if (/\.(gif|jpe?g|png|webp)$/.test(filename)) return true
    return false
  } catch {
    return false
  }
}

function parseLeadingCommandToken(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const firstSpace = trimmed.indexOf(' ')
  return (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase()
}

type HermitXPostPayload = {
  text: string
  media: { url: string } | null
}

/** Native X media upload when possible; otherwise fall back to URL-in-text. */
function buildHermitXPostPayload(params: {
  reply: string
  fallbackCaption?: string
  mediaUrl?: string | null
  memeId?: string | null
}): HermitXPostPayload {
  const mediaUrl =
    typeof params.mediaUrl === 'string' && isLikelyImageUrl(params.mediaUrl.trim())
      ? params.mediaUrl.trim()
      : null
  if (mediaUrl) {
    const caption =
      stripImageUrlsFromHermitReply(params.reply, mediaUrl) ||
      params.fallbackCaption?.trim() ||
      'Hermit meme drop'
    return {
      text: truncateWithEllipsis(caption, 280),
      media: { url: mediaUrl },
    }
  }
  return {
    text: buildHermitTweetText({
      reply: params.reply,
      fallbackCaption: params.fallbackCaption,
      mediaUrl: undefined,
    }),
    media: null,
  }
}

function buildHermitTweetText(params: {
  reply: string
  fallbackCaption?: string
  mediaUrl?: string
}): string {
  const lines = params.reply
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('— Want me to remember your style?'))

  const mediaUrl = params.mediaUrl || lines.find((line) => isHttpUrl(line)) || ''
  const textLine =
    lines.find((line) => !isHttpUrl(line)) || params.fallbackCaption || 'Hermit meme drop'

  if (!mediaUrl) return truncateWithEllipsis(textLine, 280)
  const combined = `${textLine}\n${mediaUrl}`
  if (combined.length <= 280) return combined

  const maxTextLength = Math.max(1, 280 - mediaUrl.length - 1)
  return `${truncateWithEllipsis(textLine, maxTextLength)}\n${mediaUrl}`
}

function pickFirstHermitMediaUrl(
  attachments: Array<{ url?: string }> | undefined,
): string | null {
  if (!attachments || attachments.length === 0) return null
  for (const attachment of attachments) {
    const url = typeof attachment.url === 'string' ? attachment.url.trim() : ''
    if (isLikelyImageUrl(url)) return url
  }
  return null
}

function pickFirstImageUrlFromReplyText(reply: string): string | null {
  const lines = reply
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  for (const line of lines) {
    if (isLikelyImageUrl(line)) return line
  }
  return null
}

function extractTweetUrl(response: string): string | null {
  const match = response.match(/https:\/\/x\.com\/i\/web\/status\/\d+/i)
  return match?.[0] ?? null
}

export type HermitRoomContext = {
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

  // === Room 1659 Market Awareness (only populated for room 1659) ===
  room1659Market?: import('../_lib/alfaclub/room1659Market.js').Room1659MarketSnapshot | null
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

  const context: HermitRoomContext = {
    roomId,
    userPreferences: { spanishDialect, tone, onboardedAt },
    persistPreference,
    listPreferences,
    clearPreferences,
  }

  // Room 1659 specific: attach live market context (hype, liquidation, user position)
  if (roomId === '1659') {
    try {
      const { resolveRoom1659MarketContext } = await import('../_lib/alfaclub/room1659Market.js')
      context.room1659Market = await resolveRoom1659MarketContext(params.senderWallet)
    } catch (e) {
      // Fail open — Hermit still works, just without market data
      context.room1659Market = {
        hyperliquidUser: '',
        hype: null,
        liquidation: null,
        userPosition: null,
        fetchedAt: new Date().toISOString(),
        ok: false,
        errorReason: 'load_failed',
      }
    }
  }

  return context
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

    const helpResult = await executeHelpCommandFamily(raw, {
      chatId: params.chatId,
      senderWallet: params.senderWallet,
    })
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
        const hermitCommand = parseLeadingCommandToken(raw)
        const senderIsAllowlisted = isHermitUserAllowed(params.senderWallet)
        const alfaClubChat = isAlfaClubChatId(params.chatId)
        if (!alfaClubChat && !senderIsAllowlisted) {
          return { ok: false, response: 'Hermit access denied.' }
        }
        const hermitRole = await getRole(undefined)
        const isRoomOwner = isHermitOwner(params.senderWallet)
        const isTrustedOperator = isTrustedHermitOperator({
          senderIsAllowlisted,
          role: hermitRole,
          isRoomOwner,
        })
        const operatorOnlyCommand = isHermitOperatorOnlyCommand(raw)
        if (
          alfaClubChat &&
          operatorOnlyCommand &&
          !isTrustedOperator
        ) {
          const restrictedCommand = hermitCommand === '/arena'
            ? '/arena'
            : hermitCommand === '/strategy'
              ? '/strategy bias'
              : '/signal'
          return {
            ok: false,
            response:
              `Hermit \`${restrictedCommand}\` is restricted to trusted operators (OWNER/ADMIN, allowlisted user, or HERMIT_OWNER_ADDRESS) in this room. To allow your wallet (e.g. 0x64c3... for 1659), set HERMIT_OWNER_ADDRESS or HERMIT_ALLOWED_USERS on the Railway alfaclub-bridge/hermit service and redeploy.`,
          }
        }
        const alfaClubRoomId = parseAlfaClubRoomIdFromChatId(params.chatId)
        const cooldownCommand = resolveHermitCooldownCommand(raw)
        if (alfaClubChat && alfaClubRoomId && cooldownCommand) {
          const cooldown = await checkHermitCommandCooldown({
            roomId: alfaClubRoomId,
            senderAddress: params.senderWallet,
            command: cooldownCommand,
          })
          if (!cooldown.ok) {
            const label = cooldownCommand === 'gmeow' ? '/gmeow' : '/meme'
            return {
              ok: false,
              response: `Slow down — ${label} cooldown (${cooldown.retryAfterSec}s left in this room).`,
            }
          }
        }
        const hermitRoomContext = await resolveHermitRoomContext({
          chatId: params.chatId,
          senderWallet: params.senderWallet,
        })
        const result = await executeHermitCommand({
          commandText: raw,
          senderAddress: params.senderWallet as `0x${string}`,
          isTrustedOperator,
          sourceIdentity: isAlfaClubChatId(params.chatId) ? 'alfaclub-bridge-runner' : null,
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
          // Room 1659 market data (hype, liquidation, user position)
          ...(hermitRoomContext.room1659Market
            ? { room1659Market: hermitRoomContext.room1659Market }
            : {}),
        })
        if (alfaClubChat && alfaClubRoomId && cooldownCommand) {
          await recordHermitCommandCooldown({
            roomId: alfaClubRoomId,
            senderAddress: params.senderWallet,
            command: cooldownCommand,
          })
        }
        const mediaUrl =
          pickFirstHermitMediaUrl(result.mediaAttachments ?? []) ??
          pickFirstImageUrlFromReplyText(result.reply)
        const mediaAttachments = result.mediaAttachments ?? []
        let response = result.reply
        let alfaclubFollowUpText: string | null = null
        let outboundAttachments = mediaAttachments

        if (alfaClubChat && mediaAttachments.length > 0) {
          response = stripImageUrlsFromHermitReply(response, mediaUrl)
          if (!response) {
            response = result.meme?.caption?.trim() || 'Hermit meme drop'
          }
          if (isHermitAlfaClubPostXFirstEnabled() && mediaUrl) {
            const xPost = buildHermitXPostPayload({
              reply: result.reply,
              fallbackCaption: result.meme?.caption,
              mediaUrl: mediaUrl ?? result.meme?.url,
              memeId: result.meme?.id,
            })
            const tweet = await postTweetFromSystem({
              text: xPost.text,
              ...(xPost.media ? { media: xPost.media } : {}),
              groupId: params.groupId,
              senderWallet: params.senderWallet,
            })
            if (tweet.ok) {
              const tweetUrl =
                typeof tweet.action?.tweetUrl === 'string'
                  ? tweet.action.tweetUrl
                  : extractTweetUrl(tweet.response)
              if (tweetUrl) {
                // User-requested mode: post to X first, then post only the tweet
                // URL in AlfaClub so the room render path is driven by X.
                response = tweetUrl
                outboundAttachments = []
                alfaclubFollowUpText = null
              }
            } else {
              response = `${response}\n_(${formatHermitXCrossPostSkipMessage(tweet.response)}.)_`.trim()
            }
          }
        } else {
          const shouldPostToXFirst =
            Boolean(mediaUrl) || (result.kind === 'gmeow' && isHermitNonAlfaClubPostXFirstEnabled())
          if (shouldPostToXFirst) {
            const xPost = buildHermitXPostPayload({
              reply: result.reply,
              fallbackCaption: result.meme?.caption,
              mediaUrl: mediaUrl ?? result.meme?.url,
              memeId: result.meme?.id,
            })
            const tweet = await postTweetFromSystem({
              text: xPost.text,
              ...(xPost.media ? { media: xPost.media } : {}),
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
                outboundAttachments = []
              }
            } else if (!tweet.ok) {
              response = `${response}\n_(${formatHermitXCrossPostSkipMessage(tweet.response)}.)_`.trim()
            }
          }
        }

        const reactionEmoji = alfaClubChat
          ? pickHermitReactionEmoji({
              kind: result.kind,
              tags: result.meme?.tags,
            })
          : null

        return {
          ok: true,
          response,
          ...(outboundAttachments.length || alfaclubFollowUpText || reactionEmoji
            ? {
                action: {
                  action: 'hermit.command',
                  kind: result.kind,
                  ...(outboundAttachments.length ? { attachments: outboundAttachments } : {}),
                  ...(alfaclubFollowUpText ? { alfaclubFollowUpText } : {}),
                  ...(reactionEmoji ? { reactionEmoji } : {}),
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
