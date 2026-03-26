import type { Address } from 'viem'

import { executeConversationalFallback } from '../../agent/core/executeConversationalFallback.js'
import {
  EMPTY_CONVERSATIONAL_PROMPT_RESPONSE,
  isConversationalAgentInput,
  resolveConversationalPrompt,
} from '../../agent/core/conversationalInput.js'
import type { KeeprVaultRow } from '../../_lib/keeprRegistry.js'
import type { KeeprCommandResult } from '../types.js'
import { formatGroupConnectGuidance, looksLikeGroupConnectIntent } from './keepr.js'

export function looksLikeConversationalCommand(text: string): boolean {
  const raw = String(text ?? '').trim()
  return isConversationalAgentInput(raw) && (/^\/ai\b/i.test(raw) || /^@(keepr|bot)\b/i.test(raw))
}

export async function executeConversationalCommandFamily(params: {
  groupId: string
  senderWallet: Address
  text: string
  vault: KeeprVaultRow | null
}): Promise<KeeprCommandResult> {
  const resolvedPrompt = resolveConversationalPrompt(params.text)
  if (resolvedPrompt.kind === 'empty') {
    return { ok: true, response: EMPTY_CONVERSATIONAL_PROMPT_RESPONSE }
  }

  if (!params.vault && looksLikeGroupConnectIntent(resolvedPrompt.prompt)) {
    return { ok: true, response: formatGroupConnectGuidance(params.groupId) }
  }

  const aiResult = await executeConversationalFallback({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    text: resolvedPrompt.prompt,
    vault: params.vault,
  })

  return { ok: aiResult.ok, response: aiResult.responseText }
}
