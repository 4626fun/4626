import type { VercelRequest } from '@vercel/node'

import { getAddress, type Address } from 'viem'

import type { DeploySessionRecord } from '../../../../server/_lib/deploySessions.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'

export class DeploySessionAccessError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DeploySessionAccessError'
    this.status = status
  }
}

export async function loadAuthorizedDeploySession(params: {
  req: VercelRequest
  sessionId: string
  getDeploySessionById: (id: string) => Promise<DeploySessionRecord | null>
}): Promise<{
  auth:
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
  sessionAddress: Address
  rec: DeploySessionRecord
}> {
  const auth = readDeployAuthFromRequest(params.req)
  if (!auth?.address) {
    throw new DeploySessionAccessError(401, 'Not authenticated')
  }

  const rec = await params.getDeploySessionById(params.sessionId)
  if (!rec) {
    throw new DeploySessionAccessError(404, 'Not found')
  }

  const sessionAddress = getAddress(auth.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    throw new DeploySessionAccessError(403, 'Forbidden')
  }

  return { auth, sessionAddress, rec }
}
