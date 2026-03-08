import {
  bankrGetBalances,
  bankrGetMe,
  bankrPrompt,
  type BankrBalancesResponse,
  type BankrJobResponse,
  type BankrMeResponse,
} from './client.js'
import { probeBankrCanonicalWalletMatch, type BankrCanonicalProbe } from './probe.js'

export type BankrRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type BankrSkillName = 'bankr_status' | 'bankr_me' | 'bankr_balances' | 'bankr_prompt'

type BankrSkillContext = {
  signerWallet?: string | null
  canonicalWallet?: string | null
  role?: BankrRole
  requireConfirmation?: boolean
}

type BankrPromptIntent = 'read' | 'write'

type PromptPayload = {
  prompt: string
  intent?: BankrPromptIntent
  confirm?: boolean
  threadId?: string
  timeoutMs?: number
  pollIntervalMs?: number
}

type BankrPromptSkillResult = {
  intent: BankrPromptIntent
  walletProbe: BankrCanonicalProbe | null
  jobId: string
  threadId: string | null
  status: string
  response: string | null
  raw: BankrJobResponse
}

const WRITE_ERROR_PREFIX = 'Bankr write blocked by canonical CSW policy'

export function isBankrWriteCommandText(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!normalized) return false
  return /^\/?bankr exec\b/.test(normalized)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asPositiveNumber(value: unknown): number | undefined {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.floor(n)
}

function ensurePromptPayload(payload: Record<string, unknown>): PromptPayload {
  const prompt = asString(payload.prompt)
  if (!prompt) throw new Error('Missing required prompt string')

  const intentRaw = asString(payload.intent).toLowerCase()
  const intent: BankrPromptIntent = intentRaw === 'write' ? 'write' : 'read'

  return {
    prompt,
    intent,
    confirm: payload.confirm === true,
    threadId: asString(payload.threadId) || undefined,
    timeoutMs: asPositiveNumber(payload.timeoutMs),
    pollIntervalMs: asPositiveNumber(payload.pollIntervalMs),
  }
}

async function requireWriteGuards(params: {
  payload: PromptPayload
  context: BankrSkillContext
  requireConfirmation?: boolean
}): Promise<BankrCanonicalProbe> {
  const role: BankrRole = params.context.role ?? 'MEMBER'
  if (role === 'MEMBER') {
    throw new Error(`${WRITE_ERROR_PREFIX}: ADMIN or OWNER role required`)
  }

  const requireConfirmation =
    params.requireConfirmation ?? params.context.requireConfirmation !== false
  if (requireConfirmation && params.payload.confirm !== true) {
    throw new Error(`${WRITE_ERROR_PREFIX}: confirm=true is required`)
  }

  const probe = await probeBankrCanonicalWalletMatch({
    canonicalWallet: params.context.canonicalWallet ?? null,
    signerWallet: params.context.signerWallet ?? null,
  })
  if (!probe.walletMatch) {
    const bankrWallet = probe.bankrEvmWallet ?? 'n/a'
    throw new Error(
      `${WRITE_ERROR_PREFIX}: ${probe.reason} (expected=${probe.expectedCanonical}, bankr=${bankrWallet})`,
    )
  }
  return probe
}

export async function executeBankrSkill(
  name: 'bankr_status',
  payloadInput: Record<string, unknown>,
  context?: BankrSkillContext,
): Promise<BankrCanonicalProbe>
export async function executeBankrSkill(
  name: 'bankr_me',
  payloadInput: Record<string, unknown>,
  context?: BankrSkillContext,
): Promise<BankrMeResponse>
export async function executeBankrSkill(
  name: 'bankr_balances',
  payloadInput: Record<string, unknown>,
  context?: BankrSkillContext,
): Promise<BankrBalancesResponse>
export async function executeBankrSkill(
  name: 'bankr_prompt',
  payloadInput: Record<string, unknown>,
  context?: BankrSkillContext,
): Promise<BankrPromptSkillResult>
export async function executeBankrSkill(
  name: BankrSkillName,
  payloadInput: Record<string, unknown>,
  context?: BankrSkillContext,
): Promise<BankrCanonicalProbe | BankrMeResponse | BankrBalancesResponse | BankrPromptSkillResult>
export async function executeBankrSkill(
  name: BankrSkillName,
  payloadInput: Record<string, unknown>,
  context: BankrSkillContext = {},
): Promise<BankrCanonicalProbe | BankrMeResponse | BankrBalancesResponse | BankrPromptSkillResult> {
  const payload = isObject(payloadInput) ? payloadInput : {}

  switch (name) {
    case 'bankr_status': {
      return probeBankrCanonicalWalletMatch({
        canonicalWallet: context.canonicalWallet ?? null,
        signerWallet: context.signerWallet ?? null,
      })
    }
    case 'bankr_me': {
      const me = await bankrGetMe()
      if (!me.ok) throw new Error(me.error)
      return me.data
    }
    case 'bankr_balances': {
      const chains = asString(payload.chains) || undefined
      const balances = await bankrGetBalances({ chains })
      if (!balances.ok) throw new Error(balances.error)
      return balances.data
    }
    case 'bankr_prompt': {
      const promptPayload = ensurePromptPayload(payload)
      const walletProbe = await requireWriteGuards({
        payload: promptPayload,
        context,
        requireConfirmation: promptPayload.intent === 'write',
      })

      const promptResult = await bankrPrompt({
        prompt: promptPayload.prompt,
        threadId: promptPayload.threadId,
        timeoutMs: promptPayload.timeoutMs,
        pollIntervalMs: promptPayload.pollIntervalMs,
      })
      if (!promptResult.ok) throw new Error(promptResult.error)

      return {
        intent: promptPayload.intent,
        walletProbe,
        ...promptResult.data,
      }
    }
    default: {
      throw new Error(`Unsupported Bankr skill: ${name as string}`)
    }
  }
}
