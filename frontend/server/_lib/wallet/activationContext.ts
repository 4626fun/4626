import type { VercelRequest } from '@vercel/node'
import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import { resolvePrimaryProfileIdForPrivyUser } from '@4626/server-core'
import { resolveServerBaseRpcUrl } from '../onchain/baseRpcUrl.js'
import { isOwner } from './coinbaseSmartWalletOwner.js'
import { verifyPrivyRequest } from './canonicalCswDelegation.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: unknown[] }>
}

export type ActivationContext = {
  profileId: number
  privyUserId: string
  parentCswAddress: Address
  embeddedEoaAddress: Address
  serverWalletId: string | null
  serverWalletAddress: Address | null
}

export type ActivationStatus = ActivationContext & {
  embeddedOwnerConfirmed: boolean
  serverOwnerConfirmed: boolean
  xmtpProvisioned: boolean
}

function optionalAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw && isAddress(raw) ? getAddress(raw) : null
}

export async function resolveActivationContext(params: {
  db: Db
  req: VercelRequest
}): Promise<ActivationContext> {
  const auth = await verifyPrivyRequest(params.req)
  const profileId = await resolvePrimaryProfileIdForPrivyUser(params.db as never, auth.privyUserId)
  if (!profileId) throw new Error('activation_profile_not_found')

  const result = await params.db.sql`
    SELECT csw_address, primary_embedded_eoa,
           preprov_server_wallet_id, preprov_server_wallet_address
    FROM profiles
    WHERE id = ${profileId}
      AND merged_into_profile_id IS NULL
    LIMIT 1;
  `
  const row = result.rows?.[0] as Record<string, unknown> | undefined
  const parentCswAddress = optionalAddress(row?.csw_address)
  const embeddedEoaAddress = optionalAddress(row?.primary_embedded_eoa)
  if (!parentCswAddress) throw new Error('activation_parent_csw_missing')
  if (!embeddedEoaAddress) throw new Error('activation_embedded_eoa_missing')
  if (parentCswAddress === embeddedEoaAddress) throw new Error('activation_embedded_eoa_invalid')

  return {
    profileId,
    privyUserId: auth.privyUserId,
    parentCswAddress,
    embeddedEoaAddress,
    serverWalletId:
      typeof row?.preprov_server_wallet_id === 'string' &&
      row.preprov_server_wallet_id.trim()
        ? row.preprov_server_wallet_id.trim()
        : null,
    serverWalletAddress: optionalAddress(row?.preprov_server_wallet_address),
  }
}

export async function readActivationStatus(params: {
  db: Db
  context: ActivationContext
}): Promise<ActivationStatus> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(resolveServerBaseRpcUrl()),
  })
  const embeddedOwnerConfirmed = await isOwner(
    publicClient,
    params.context.parentCswAddress,
    params.context.embeddedEoaAddress,
  )
  const serverOwnerConfirmed = params.context.serverWalletAddress
    ? await isOwner(
        publicClient,
        params.context.parentCswAddress,
        params.context.serverWalletAddress,
      )
    : false

  let xmtpProvisioned = false
  if (params.context.serverWalletId && params.context.serverWalletAddress) {
    const xmtpResult = await params.db.sql`
      SELECT 1
      FROM creator_infrastructure
      WHERE LOWER(creator_address) = ${params.context.parentCswAddress.toLowerCase()}
        AND LOWER(csw_address) = ${params.context.parentCswAddress.toLowerCase()}
        AND privy_wallet_id = ${params.context.serverWalletId}
        AND agent_type = 'csw'
      LIMIT 1;
    `
    xmtpProvisioned = Boolean(xmtpResult.rows?.[0])
  }

  return {
    ...params.context,
    embeddedOwnerConfirmed,
    serverOwnerConfirmed,
    xmtpProvisioned,
  }
}
