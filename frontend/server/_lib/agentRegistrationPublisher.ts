import { createHash } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'

import type { RegistrationFile } from './agentRegistration.js'
import {
  getGroveChainId,
  tryUploadImmutableJson,
  updateMutableJson,
  uploadMutableJson,
  type GroveUploadResult,
} from './lensGrove.js'
import { getAgentRegistrationState, upsertAgentRegistrationState } from './agentRegistrationState.js'

declare const process: { env: Record<string, string | undefined> }

export type RegistrationPublishMode = 'on-change' | 'always' | 'off'
export type RegistrationPublishPipeline = 'mutable' | 'immutable'

export type PublishAgentRegistrationResult =
  | {
      ok: true
      status: 'reused' | 'stored'
      lensUri: string
      gatewayUrl: string
      storageKey: string | null
      payloadHash: string
      mode: RegistrationPublishMode
      pipeline: RegistrationPublishPipeline
    }
  | {
      ok: false
      status: 'skipped' | 'unavailable'
      error?: string
      payloadHash: string
      mode: RegistrationPublishMode
      pipeline: RegistrationPublishPipeline
    }

function parsePublishMode(raw: string | undefined): RegistrationPublishMode {
  const v = String(raw ?? 'on-change').trim().toLowerCase()
  if (v === 'off' || v === 'disabled' || v === 'false' || v === '0') return 'off'
  if (v === 'always' || v === 'force') return 'always'
  return 'on-change'
}

function parsePipeline(raw: string | undefined): RegistrationPublishPipeline | null {
  const v = String(raw ?? '').trim().toLowerCase()
  if (!v) return null
  if (v === 'mutable') return 'mutable'
  if (v === 'immutable') return 'immutable'
  return null
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function asPrivateKey(value: string): `0x${string}` | null {
  const raw = value.trim()
  if (!raw) return null
  const normalized = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) return null
  return normalized as `0x${string}`
}

function parseAclType(raw: string | undefined): 'wallet' | 'lensAccount' {
  const v = String(raw ?? 'wallet').trim().toLowerCase()
  return v === 'lensaccount' ? 'lensAccount' : 'wallet'
}

function parsePositiveInt(raw: string | undefined): number | null {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n <= 0 || Math.floor(n) !== n) return null
  return n
}

function safeGatewayUrl(upload: GroveUploadResult): string {
  if (upload.gatewayUrl && upload.gatewayUrl.trim()) return upload.gatewayUrl
  const uri = String(upload.lensUri ?? '').trim()
  return uri.startsWith('lens://') ? `https://api.grove.storage/${uri.slice('lens://'.length)}` : uri
}

export function resolveAgentRegistrationKey(payload: RegistrationFile, fallback = 'single-agent'): string {
  const explicit = String(process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim().toLowerCase()
  if (isAddressLike(explicit)) return `single-csw:${explicit}`

  const services = Array.isArray(payload.services) ? payload.services : []
  const walletService = services.find((service) => String(service?.name ?? '').trim() === 'agentWallet')
  const accountRaw = String((walletService as any)?.account ?? '').trim()
  const accountMatch = accountRaw.match(/^eip155:\d+:(0x[a-fA-F0-9]{40})$/)
  if (accountMatch) return `single-csw:${accountMatch[1].toLowerCase()}`

  const xmtpService = services.find((service) => String(service?.name ?? '').trim() === 'XMTP')
  const xmtpAddress = String((xmtpService as any)?.address ?? '').trim()
  if (isAddressLike(xmtpAddress)) return `single-csw:${xmtpAddress.toLowerCase()}`
  const endpoint = String((xmtpService as any)?.endpoint ?? '').trim()
  const endpointMatch = endpoint.match(/\/dm\/(0x[a-fA-F0-9]{40})$/)
  if (endpointMatch) return `single-csw:${endpointMatch[1].toLowerCase()}`

  return fallback
}

export async function publishAgentRegistrationToGrove(params: {
  payload: RegistrationFile
  agentKey: string
  mode?: RegistrationPublishMode
}): Promise<PublishAgentRegistrationResult> {
  const payloadCanonical = JSON.stringify(params.payload)
  const payloadHash = createHash('sha256').update(payloadCanonical).digest('hex')
  const mode = params.mode ?? parsePublishMode(process.env.ELIZA_GROVE_UPLOAD_MODE)
  const configuredPipeline = parsePipeline(process.env.GROVE_REGISTRATION_PIPELINE)
  const publisherPrivateKey = asPrivateKey(String(process.env.GROVE_PUBLISHER_PRIVATE_KEY ?? ''))
  const pipeline: RegistrationPublishPipeline = configuredPipeline ?? (publisherPrivateKey ? 'mutable' : 'immutable')

  if (mode === 'off') {
    return { ok: false, status: 'skipped', payloadHash, mode, pipeline }
  }

  const existing = await getAgentRegistrationState(params.agentKey).catch(() => null)
  const hasMutableState = Boolean(existing?.storageKey)
  const canReuseWithoutWrite = mode === 'on-change' && existing?.payloadHash === payloadHash && (pipeline === 'immutable' || hasMutableState)
  if (canReuseWithoutWrite && existing?.lensUri) {
    return {
      ok: true,
      status: 'reused',
      lensUri: existing.lensUri,
      gatewayUrl:
        existing.gatewayUrl && existing.gatewayUrl.trim()
          ? existing.gatewayUrl
          : existing.lensUri.replace(/^lens:\/\//, 'https://api.grove.storage/'),
      storageKey: existing.storageKey ?? null,
      payloadHash,
      mode,
      pipeline,
    }
  }

  if (pipeline === 'mutable') {
    if (!publisherPrivateKey) {
      return {
        ok: false,
        status: 'unavailable',
        error: 'grove_publisher_private_key_missing',
        payloadHash,
        mode,
        pipeline,
      }
    }

    const account = privateKeyToAccount(publisherPrivateKey)
    const aclType = parseAclType(process.env.GROVE_PUBLISHER_ACL_TYPE)
    const aclAddressRaw = String(process.env.GROVE_PUBLISHER_ADDRESS ?? '').trim()
    const aclAddress = isAddressLike(aclAddressRaw) ? aclAddressRaw : account.address
    const chainId = parsePositiveInt(process.env.GROVE_PUBLISHER_CHAIN_ID) ?? getGroveChainId()
    const signer = {
      address: account.address,
      signMessage: async ({ message }: { message: string }) => account.signMessage({ message }),
    }

    let upload: GroveUploadResult
    if (existing?.storageKey) {
      try {
        upload = await updateMutableJson(existing.storageKey, params.payload, signer, {
          aclType,
          address: aclAddress,
          chainId,
        })
      } catch {
        upload = await uploadMutableJson(params.payload, {
          aclType,
          address: aclAddress,
          chainId,
        })
      }
    } else {
      upload = await uploadMutableJson(params.payload, {
        aclType,
        address: aclAddress,
        chainId,
      })
    }

    const gatewayUrl = safeGatewayUrl(upload)
    await upsertAgentRegistrationState({
      agentKey: params.agentKey,
      payloadHash,
      lensUri: upload.lensUri,
      gatewayUrl,
      storageKey: upload.storageKey,
    })
    return {
      ok: true,
      status: 'stored',
      lensUri: upload.lensUri,
      gatewayUrl,
      storageKey: upload.storageKey,
      payloadHash,
      mode,
      pipeline,
    }
  }

  const immutableUpload = await tryUploadImmutableJson(params.payload)
  if (!immutableUpload.ok) {
    return {
      ok: false,
      status: 'unavailable',
      error: immutableUpload.error,
      payloadHash,
      mode,
      pipeline,
    }
  }

  await upsertAgentRegistrationState({
    agentKey: params.agentKey,
    payloadHash,
    lensUri: immutableUpload.result.lensUri,
    gatewayUrl: immutableUpload.result.gatewayUrl,
    storageKey: immutableUpload.result.storageKey,
  })
  return {
    ok: true,
    status: 'stored',
    lensUri: immutableUpload.result.lensUri,
    gatewayUrl: immutableUpload.result.gatewayUrl,
    storageKey: immutableUpload.result.storageKey,
    payloadHash,
    mode,
    pipeline,
  }
}
