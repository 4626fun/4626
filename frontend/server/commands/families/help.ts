import { buildAlfaClubHelpResponse } from '../../_lib/alfaclub/alfaclubChatHelp.js'
import type { KeeprCommandResult } from '../types.js'
import { formatKeeprHelp } from './keepr.js'

const GLOBAL_HELP_RE = /^\/?(?:help|halp)(?:\s+(\S+))?\s*$/i

export async function executeHelpCommandFamily(
  text: string,
  context?: { chatId?: string; senderWallet?: string | null },
): Promise<KeeprCommandResult | null> {
  const match = String(text ?? '').match(GLOBAL_HELP_RE)
  if (!match) return null
  const alfaClubHelp = await buildAlfaClubHelpResponse({
    chatId: context?.chatId,
    senderWallet: context?.senderWallet,
  })
  if (alfaClubHelp) {
    return { ok: true, response: alfaClubHelp }
  }
  return { ok: true, response: formatKeeprHelp(match[1] ?? null) }
}
