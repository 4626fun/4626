import type { VercelRequest } from '@vercel/node'

import { getAddress, type Address } from 'viem'

import { readSessionFromRequest } from '../../auth/_shared.js'
import { readSiwaAgentFromRequest } from '../../auth/_siwa.js'

export type DeployAuthContext =
  | {
      type: 'session'
      address: Address
    }
  | {
      type: 'siwa'
      address: Address
      agentId: number
      agentRegistry: string
      chainId: number
    }

function isAddressLike(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

export function readDeployAuthFromRequest(req: VercelRequest): DeployAuthContext | null {
  const session = readSessionFromRequest(req)
  const sessionAddress = typeof session?.address === 'string' ? session.address.trim() : ''
  if (sessionAddress) {
    try {
      return {
        type: 'session',
        address: getAddress(sessionAddress),
      }
    } catch {
      return {
        type: 'session',
        address: sessionAddress.toLowerCase() as Address,
      }
    }
  }

  const siwa = readSiwaAgentFromRequest(req)
  if (!siwa) return null
  const rawAddress = typeof siwa.address === 'string' ? siwa.address : ''
  if (!isAddressLike(rawAddress)) return null

  const agentId = Number(siwa.agentId)
  const chainId = Number(siwa.chainId)
  const agentRegistry = String(siwa.agentRegistry ?? '').trim().toLowerCase()
  if (!Number.isFinite(agentId) || agentId < 0 || !Number.isFinite(chainId) || chainId <= 0 || !agentRegistry) {
    return null
  }

  try {
    return {
      type: 'siwa',
      address: getAddress(rawAddress),
      agentId: Math.floor(agentId),
      agentRegistry,
      chainId: Math.floor(chainId),
    }
  } catch {
    return null
  }
}
