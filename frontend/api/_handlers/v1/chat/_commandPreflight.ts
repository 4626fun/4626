import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  readSessionFromRequest,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'
import { getKeeprVaultByGroupId } from '../../../../server/_lib/keepr/keeprRegistry.js'
import { isCreWriteCommandText } from '../../../../server/agent/eliza/plugins/cre/index.js'

type KeeprRole = 'OWNER' | 'ADMIN' | 'MEMBER'

type PreflightBody = {
  conversationId?: string
  senderWallet?: string
  command?: string
}

type PreflightData = {
  allowed: boolean
  reason: string
  guardCategory: string
  role: KeeprRole | null
  walletMatch?: boolean | null
}

const MAX_CONVERSATION_ID_LENGTH = 128
const MAX_COMMAND_LENGTH = 4_096

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function asBoundedTrimmed(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function roleForWallet(params: { wallet: string; owner: string; admins: string[] }): KeeprRole {
  const wallet = params.wallet.toLowerCase()
  if (wallet === params.owner.toLowerCase()) return 'OWNER'
  if (params.admins.some((admin) => admin.toLowerCase() === wallet)) return 'ADMIN'
  return 'MEMBER'
}

function ok(data: PreflightData): ApiEnvelope<PreflightData> {
  return { success: true, data }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('v1-chat-command-preflight', getClientIp(req)),
    RATE_LIMITS.chatCommandPreflight,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? (rawBody as PreflightBody)
    : {}
  const conversationId = asBoundedTrimmed(body.conversationId, MAX_CONVERSATION_ID_LENGTH)
  const senderWallet = asBoundedTrimmed(body.senderWallet, 42).toLowerCase()
  const command = asBoundedTrimmed(body.command, MAX_COMMAND_LENGTH)

  const isCreWrite = isCreWriteCommandText(command)
  if (!isCreWrite) {
    return res.status(200).json(ok({
      allowed: true,
      reason: 'read_or_non_mutating_command',
      guardCategory: 'none',
      role: null,
      walletMatch: null,
    }))
  }

  if (!isAddressLike(senderWallet)) {
    return res.status(200).json(ok({
      allowed: false,
      reason: 'connect_wallet_first',
      guardCategory: 'wallet_missing',
      role: null,
      walletMatch: null,
    }))
  }

  if (!conversationId) {
    return res.status(200).json(ok({
      allowed: false,
      reason: 'conversation_context_required',
      guardCategory: 'conversation_missing',
      role: null,
      walletMatch: null,
    }))
  }

  const session = readSessionFromRequest(req)
  const sessionAddress = String(session?.address ?? '').trim().toLowerCase()
  if (!isAddressLike(sessionAddress)) {
    return res.status(200).json(ok({
      allowed: false,
      reason: 'auth_session_required',
      guardCategory: 'auth_required',
      role: null,
      walletMatch: null,
    }))
  }
  if (sessionAddress !== senderWallet) {
    return res.status(200).json(ok({
      allowed: false,
      reason: 'sender_wallet_mismatch_session',
      guardCategory: 'wallet_session_mismatch',
      role: null,
      walletMatch: null,
    }))
  }

  try {
    const vault = await getKeeprVaultByGroupId(conversationId)
    if (!vault) {
      return res.status(200).json(ok({
        allowed: false,
        reason: 'vault_not_configured_for_conversation',
        guardCategory: 'vault_missing',
        role: null,
        walletMatch: null,
      }))
    }

    const owner = String(vault.canonicalOwnerAddress ?? '').trim().toLowerCase()
    const admins = Array.isArray((vault as any).config?.roles?.admins)
      ? ((vault as any).config.roles.admins as string[]).filter((entry) => isAddressLike(entry))
      : []
    const role = roleForWallet({
      wallet: senderWallet,
      owner,
      admins,
    })
    if (role === 'MEMBER') {
      return res.status(200).json(ok({
        allowed: false,
        reason: 'admin_or_owner_required',
        guardCategory: 'role_denied',
        role,
        walletMatch: null,
      }))
    }

    return res.status(200).json(ok({
      allowed: true,
      reason: 'ok',
      guardCategory: 'none',
      role,
      walletMatch: null,
    }))
  } catch {
    return res.status(200).json(ok({
      allowed: false,
      reason: 'preflight_unavailable_retry',
      guardCategory: 'runtime_unavailable',
      role: null,
      walletMatch: null,
    }))
  }
}
