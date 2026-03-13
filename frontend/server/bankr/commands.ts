import type { Address } from 'viem'

import { executeBankrSkill, type BankrRole } from './agentSkills.js'

export type BankrCommandResult =
  | { ok: true; response: string; action?: Record<string, unknown> }
  | { ok: false; response: string }

function formatHelp(): string {
  return [
    'Bankr commands',
    '',
    '- /bankr help',
    '- /bankr status',
    '- /bankr me',
    '- /bankr balances [base,solana]',
    '- /bankr ask <question>',
    '- /bankr exec <instruction> --confirm  (ADMIN/OWNER)',
    '',
    'Notes:',
    '- /bankr exec is hard-gated by canonical CSW wallet match.',
    '- Write actions require ADMIN/OWNER and explicit --confirm.',
  ].join('\n')
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function normalizePrefix(raw: string): '/bankr' | 'bankr' | null {
  const lower = raw.toLowerCase()
  if (lower.startsWith('/bankr')) return '/bankr'
  if (lower === 'bankr' || lower.startsWith('bankr ')) return 'bankr'
  return null
}

function splitCommand(raw: string): { cmd: string; args: string[] } | null {
  const prefix = normalizePrefix(raw)
  if (!prefix) return null
  const parts = raw.split(/\s+/g).filter(Boolean)
  const cmd = parts[0]?.toLowerCase() === prefix ? String(parts[1] ?? 'help').toLowerCase() : 'help'
  const args = parts[0]?.toLowerCase() === prefix ? parts.slice(2) : []
  return { cmd, args }
}

function parseExecArgs(args: string[]): { prompt: string; confirm: boolean } {
  let confirm = false
  const promptTokens: string[] = []
  for (const arg of args) {
    const token = arg.trim().toLowerCase()
    if (token === '--confirm' || token === '-y') {
      confirm = true
      continue
    }
    promptTokens.push(arg)
  }
  return { prompt: promptTokens.join(' ').trim(), confirm }
}

function toUserErrorMessage(error: unknown): string {
  const msg = String((error as Error | undefined)?.message ?? 'Bankr command failed')
  return msg.slice(0, 320)
}

export async function handleBankrCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: BankrRole
  canonicalOwnerAddress?: string | null
}): Promise<BankrCommandResult> {
  const parsed = splitCommand((params.text ?? '').trim())
  if (!parsed) return { ok: false, response: '' }

  const context = {
    signerWallet: params.senderWallet,
    canonicalWallet: params.canonicalOwnerAddress ?? null,
    role: params.role,
    requireConfirmation: true,
  }

  try {
    switch (parsed.cmd) {
      case 'help': {
        return { ok: true, response: formatHelp() }
      }
      case 'status': {
        const status = await executeBankrSkill('bankr_status', {}, context)
        return {
          ok: true,
          response: [
            'Bankr status',
            '',
            `- configured: ${status.configured ? 'yes' : 'no'}`,
            `- walletMatch: ${status.walletMatch ? 'yes' : 'no'}`,
            `- reason: ${status.reason}`,
            `- expectedCanonical: ${status.expectedCanonical}`,
            `- bankrEvmWallet: ${status.bankrEvmWallet ?? 'n/a'}`,
            `- bankrError: ${status.bankrError ?? 'none'}`,
          ].join('\n'),
        }
      }
      case 'me': {
        const me = await executeBankrSkill('bankr_me', {}, context)
        return { ok: true, response: `Bankr account\n\n${formatJson(me)}` }
      }
      case 'balances': {
        const balances = await executeBankrSkill(
          'bankr_balances',
          { chains: parsed.args[0] ?? '' },
          context,
        )
        return { ok: true, response: `Bankr balances\n\n${formatJson(balances)}` }
      }
      case 'ask': {
        const prompt = parsed.args.join(' ').trim()
        if (!prompt) return { ok: false, response: 'Usage: /bankr ask <question>' }
        const result = await executeBankrSkill(
          'bankr_prompt',
          {
            prompt,
            intent: 'read',
          },
          context,
        )
        return {
          ok: true,
          response: [
            'Bankr response',
            '',
            result.response ?? '(no response)',
          ].join('\n'),
        }
      }
      case 'exec': {
        const parsedExec = parseExecArgs(parsed.args)
        if (!parsedExec.prompt) {
          return { ok: false, response: 'Usage: /bankr exec <instruction> --confirm' }
        }
        const result = await executeBankrSkill(
          'bankr_prompt',
          {
            prompt: parsedExec.prompt,
            intent: 'write',
            confirm: parsedExec.confirm,
          },
          context,
        )
        return {
          ok: true,
          response: [
            'Bankr write execution',
            '',
            `- status: ${result.status}`,
            `- jobId: ${result.jobId}`,
            `- walletMatch: ${result.walletProbe?.walletMatch ? 'yes' : 'no'}`,
            '',
            result.response ?? '(no response)',
          ].join('\n'),
          action: {
            action: 'bankr.exec',
            groupId: params.groupId,
            actor: params.senderWallet,
            canonicalOwnerAddress: params.canonicalOwnerAddress ?? null,
            confirmed: parsedExec.confirm,
            walletMatch: result.walletProbe?.walletMatch ?? false,
            jobId: result.jobId,
          },
        }
      }
      default: {
        return { ok: false, response: 'Unknown /bankr command. Try /bankr help.' }
      }
    }
  } catch (error) {
    return { ok: false, response: toUserErrorMessage(error) }
  }
}
