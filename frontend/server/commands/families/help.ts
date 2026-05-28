import { resolveAlfaClubHelpText } from '../../_lib/alfaclub/alfaclubChatHelp.js'
import type { KeeprCommandResult } from '../types.js'
import { formatKeeprHelp } from './keepr.js'

const GLOBAL_HELP_RE = /^\/?help(?:\s+(\S+))?\s*$/i

export function executeHelpCommandFamily(
  text: string,
  context?: { chatId?: string },
): KeeprCommandResult | null {
  const match = String(text ?? '').match(GLOBAL_HELP_RE)
  if (!match) return null
  const alfaClubHelp = resolveAlfaClubHelpText(context?.chatId)
  if (alfaClubHelp) {
    return { ok: true, response: alfaClubHelp }
  }
  return { ok: true, response: formatKeeprHelp(match[1] ?? null) }
}
