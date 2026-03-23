import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'
import type { Address } from 'viem'

import { getKeeprVaultByGroupId } from '../../../../_lib/keeprRegistry.js'
import { handleBankrCommand } from '../../../../bankr/commands.js'
import { executeBankrSkill, type BankrRole, type BankrSkillName } from '../../../../bankr/agentSkills.js'
import { resolveVaultAccessRoleFromVault } from '../../../core/resolveVaultRole.js'

const BANKR_SKILLS = new Set<BankrSkillName>(['bankr_status', 'bankr_me', 'bankr_balances', 'bankr_prompt'])

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function parseSkillInvocation(text: string): { skill: BankrSkillName; payload: Record<string, unknown> } | null {
  const trimmed = text.trim()
  if (!trimmed.toLowerCase().startsWith('/bankr')) return null

  const [, rawSkill, ...rest] = trimmed.split(' ')
  const skill = String(rawSkill ?? '').trim() as BankrSkillName
  if (!BANKR_SKILLS.has(skill)) return null

  const payloadText = rest.join(' ').trim()
  if (!payloadText) return { skill, payload: {} }

  try {
    const parsed = JSON.parse(payloadText)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return { skill, payload: parsed as Record<string, unknown> }
  } catch {
    return null
  }
}

function isBankrCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return normalized.startsWith('/bankr') || normalized === 'bankr' || normalized.startsWith('bankr ')
}

function extractMetadata(message: Memory): {
  conversationId: string | null
  senderAddress: Address | null
} {
  const metadata = (message.content as { metadata?: Record<string, unknown> } | undefined)?.metadata ?? {}
  const conversationId = typeof metadata.conversationId === 'string' ? metadata.conversationId.trim() : ''
  const senderAddressRaw =
    typeof metadata.senderAddress === 'string'
      ? metadata.senderAddress.trim()
      : typeof metadata.address === 'string'
        ? metadata.address.trim()
        : ''
  return {
    conversationId: conversationId || null,
    senderAddress: isAddressLike(senderAddressRaw) ? (senderAddressRaw.toLowerCase() as Address) : null,
  }
}

const bankrSkillAction: Action = {
  name: 'BANKR_SKILL',
  similes: ['bankr skill', '/bankr'],
  description: 'Execute structured Bankr skills by command: /bankr <skill_name> <json_payload>.',

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text ?? ''
    return parseSkillInvocation(text) !== null || isBankrCommand(text)
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const text = message.content?.text ?? ''
    const parsed = parseSkillInvocation(text)

    const metadata = extractMetadata(message)
    let role: BankrRole = 'MEMBER'
    let canonicalOwnerAddress: string | null = null
    if (metadata.conversationId) {
      const vault = await getKeeprVaultByGroupId(metadata.conversationId)
      if (vault) {
        canonicalOwnerAddress = String(vault.canonicalOwnerAddress ?? '').toLowerCase() || null
        role = resolveVaultAccessRoleFromVault({ wallet: metadata.senderAddress, vault }) as BankrRole
      }
    }

    try {
      if (parsed) {
        const data = await executeBankrSkill(parsed.skill, parsed.payload, {
          role,
          signerWallet: metadata.senderAddress ?? null,
          canonicalWallet: canonicalOwnerAddress,
        })
        await callback?.({ text: JSON.stringify({ skill: parsed.skill, data }, null, 2) } as Content)
        return
      }

      if (!metadata.conversationId) {
        await callback?.({ text: 'Could not determine conversation ID.' } as Content)
        return
      }
      if (!metadata.senderAddress) {
        await callback?.({ text: 'Could not determine sender wallet address.' } as Content)
        return
      }

      const result = await handleBankrCommand({
        groupId: metadata.conversationId,
        senderWallet: metadata.senderAddress,
        text: text.trim(),
        role,
        canonicalOwnerAddress,
      })
      await callback?.({ text: result.response || 'Unknown /bankr command. Try `/bankr help`.' } as Content)
    } catch (error: unknown) {
      const messageText = String((error as Error | undefined)?.message ?? 'unknown error')
      await callback?.({ text: `Bankr skill failed: ${messageText}` } as Content)
    }
  },
}

export const bankrPlugin: Plugin = {
  name: '@4626/plugin-bankr',
  description: 'Structured Bankr protocol actions for ElizaOS runtime.',
  actions: [bankrSkillAction],
}

export default bankrPlugin
