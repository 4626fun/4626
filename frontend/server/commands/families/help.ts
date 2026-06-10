import {
  buildAlfaClubHelpPayload,
  resolveAlfaClubHelpText,
} from '../../_lib/alfaclub/alfaclubChatHelp.js'
import type { KeeprCommandResult } from '../types.js'
import { formatKeeprHelp } from './keepr.js'

const GLOBAL_HELP_RE = /^\/?(?:help|halp)(?:\s+(\S+))?\s*$/i

export async function executeHelpCommandFamily(
  text: string,
  context?: { chatId?: string; senderWallet?: string | null },
): Promise<KeeprCommandResult | null> {
  const match = String(text ?? '').match(GLOBAL_HELP_RE)
  if (!match) return null
  const comprehensive = /^\/?\s*halp\b/i.test(String(text ?? ''))
  let alfaClubHelp: Awaited<ReturnType<typeof buildAlfaClubHelpPayload>> = null
  try {
    alfaClubHelp = await buildAlfaClubHelpPayload({
      chatId: context?.chatId,
      senderWallet: context?.senderWallet,
      comprehensive,
    })
  } catch {
    const roomFallback = resolveAlfaClubHelpText(context?.chatId)
    return { ok: true, response: roomFallback ?? formatKeeprHelp(match[1] ?? null) }
  }
  if (alfaClubHelp) {
    return {
      ok: true,
      response: alfaClubHelp.text,
      ...(alfaClubHelp.followUpText
        ? {
            action: {
              action: 'help.followup',
              alfaclubFollowUpText: alfaClubHelp.followUpText,
            },
          }
        : {}),
    }
  }
  return { ok: true, response: formatKeeprHelp(match[1] ?? null) }
}
