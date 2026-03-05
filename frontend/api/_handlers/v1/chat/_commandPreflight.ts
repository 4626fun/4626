import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getKeeprVaultByGroupId } from '../../../../server/_lib/keeprRegistry.js'
import { isBankrWriteCommandText } from '../../../../server/bankr/agentSkills.js'
import { probeBankrCanonicalWalletMatch } from '../../../../server/bankr/probe.js'
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

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
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

  const body = await readJsonBody<PreflightBody>(req)
  const conversationId = String(body?.conversationId ?? '').trim()
  const senderWallet = String(body?.senderWallet ?? '').trim().toLowerCase()
  const command = String(body?.command ?? '').trim()

  const isBankrWrite = isBankrWriteCommandText(command)
  const isCreWrite = isCreWriteCommandText(command)
  if (!isBankrWrite && !isCreWrite) {
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

    if (isBankrWrite) {
      const probe = await probeBankrCanonicalWalletMatch({
        canonicalWallet: owner || null,
        signerWallet: senderWallet,
      })
      if (!probe.walletMatch) {
        return res.status(200).json(ok({
          allowed: false,
          reason: `bankr_wallet_mismatch:${probe.reason}`,
          guardCategory: 'wallet_mismatch',
          role,
          walletMatch: false,
        }))
      }
      return res.status(200).json(ok({
        allowed: true,
        reason: 'ok',
        guardCategory: 'none',
        role,
        walletMatch: true,
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
      allowed: true,
      reason: 'preflight_unavailable_backend_checks_apply',
      guardCategory: 'runtime_fallback',
      role: null,
      walletMatch: null,
    }))
  }
}
