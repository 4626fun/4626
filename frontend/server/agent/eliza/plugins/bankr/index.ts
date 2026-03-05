import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'
import type { Address } from 'viem'

import { getKeeprVaultByGroupId } from '../../../../_lib/keeprRegistry.js'
import { executeBankrSkill, type BankrRole, type BankrSkillName } from '../../../../bankr/agentSkills.js'

const BANKR_SKILLS = new Set<BankrSkillName>(['bankr_status', 'bankr_me', 'bankr_balances', 'bankr_prompt'])

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function roleForWallet(params: {
  wallet: Address
  owner: Address
  admins: Address[]
}): BankrRole {
  const wallet = params.wallet.toLowerCase()
  if (wallet === params.owner.toLowerCase()) return 'OWNER'
  if (params.admins.some((entry) => entry.toLowerCase() === wallet)) return 'ADMIN'
  return 'MEMBER'
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
    return parseSkillInvocation(message.content?.text ?? '') !== null
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const parsed = parseSkillInvocation(message.content?.text ?? '')
    if (!parsed) {
      await callback?.({ text: 'Invalid /bankr skill command. Format: /bankr <skill_name> <json_payload>' } as Content)
      return
    }

    const metadata = extractMetadata(message)
    let role: BankrRole = 'MEMBER'
    let canonicalOwnerAddress: string | null = null
    if (metadata.conversationId) {
      const vault = await getKeeprVaultByGroupId(metadata.conversationId)
      if (vault) {
        canonicalOwnerAddress = String(vault.canonicalOwnerAddress ?? '').toLowerCase() || null
        if (metadata.senderAddress && isAddressLike(canonicalOwnerAddress ?? '')) {
          const admins = Array.isArray(vault.config?.roles?.admins) ? vault.config?.roles?.admins : []
          const adminAddresses = admins.filter(isAddressLike).map((entry) => entry.toLowerCase() as Address)
          role = roleForWallet({
            wallet: metadata.senderAddress,
            owner: canonicalOwnerAddress as Address,
            admins: adminAddresses,
          })
        }
      }
    }

    try {
      const data = await executeBankrSkill(parsed.skill, parsed.payload, {
        role,
        signerWallet: metadata.senderAddress ?? null,
        canonicalWallet: canonicalOwnerAddress,
      })
      await callback?.({ text: JSON.stringify({ skill: parsed.skill, data }, null, 2) } as Content)
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
