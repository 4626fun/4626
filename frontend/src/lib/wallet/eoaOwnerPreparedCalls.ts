import { recoverAddress, type Hex } from 'viem'

import { hexByteLength } from '@/lib/wallet/coinbaseSignatureWrapper'

export type EoaOwnerPreparedCallsExecutionMode = 'canonicalSmartWallet'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

const PREPARED_CALLS_STATUS_TIMEOUT_MS = import.meta.env.MODE === 'test' ? 25 : 12_000
const PREPARED_CALLS_STATUS_POLL_MS = import.meta.env.MODE === 'test' ? 5 : 500

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hexBytesToUtf8(value: Hex): string {
  const stripped = value.startsWith('0x') ? value.slice(2) : value
  if (stripped.length % 2 !== 0) throw new Error('Invalid hex length')
  const bytes = new Uint8Array(stripped.length / 2)
  for (let i = 0; i < stripped.length; i += 2) {
    bytes[i / 2] = Number.parseInt(stripped.slice(i, i + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

function unwrapDoubleHexEncodedHash(hash: `0x${string}`): `0x${string}` {
  try {
    const decoded = hexBytesToUtf8(hash)
    if (
      decoded.length === 66 &&
      (decoded.startsWith('0x') || decoded.startsWith('0X')) &&
      /^0x[0-9a-fA-F]{64}$/.test(decoded)
    ) {
      return decoded.toLowerCase() as `0x${string}`
    }
  } catch {
    /* keep original hash */
  }
  return hash
}

function resolvePreparedCallsPaymasterUrl(paymasterUrl: string | null): string | null {
  const directEnv = String(import.meta.env.VITE_CDP_SENDCALLS_PAYMASTER_URL ?? '').trim()
  if (/^https?:\/\//i.test(directEnv)) {
    return directEnv.replace(
      'https://api.developer.coinbase.com/',
      'https://api.cdp.coinbase.com/',
    )
  }
  if (!paymasterUrl) return null
  const normalized = String(paymasterUrl).trim()
  if (!/^https?:\/\//i.test(normalized)) return null
  return normalized.replace(
    'https://api.developer.coinbase.com/',
    'https://api.cdp.coinbase.com/',
  )
}

function extractWalletCallsId(sendResult: unknown): string {
  if (typeof sendResult === 'string') return sendResult
  if (Array.isArray(sendResult) && typeof sendResult[0] === 'string') return sendResult[0]
  if (sendResult && typeof sendResult === 'object') {
    const record = sendResult as Record<string, unknown>
    if (typeof record.id === 'string') return record.id
    if (Array.isArray(record.ids) && typeof record.ids[0] === 'string') return record.ids[0]
    if (Array.isArray(record.callIds) && typeof record.callIds[0] === 'string') return record.callIds[0]
    if (Array.isArray(record.preparedCallIds) && typeof record.preparedCallIds[0] === 'string') {
      return record.preparedCallIds[0]
    }
  }
  return ''
}

export async function submitOwnerViaPreparedCallsWithEoaOwner(params: {
  cswRequest: WalletRequest
  signerRequest: WalletRequest
  eoaOwnerAddress: `0x${string}`
  eoaOwnerIndex: number
  chainId: number
  sender: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  paymasterUrl: string | null
}): Promise<`0x${string}`> {
  const chainIdHex = `0x${params.chainId.toString(16)}`
  const capabilities: Record<string, unknown> = {}
  const paymasterUrlStr = resolvePreparedCallsPaymasterUrl(params.paymasterUrl)
  if (paymasterUrlStr) capabilities.paymasterService = { url: paymasterUrlStr }

  const prepareCallsPayload: Record<string, unknown> = {
    version: '1.0',
    from: params.sender,
    chainId: chainIdHex,
    calls: [{ to: params.to, data: params.data, value: '0x0' }],
    capabilities,
  }

  const prepareResult = (await params.cswRequest({
    method: 'wallet_prepareCalls',
    params: [prepareCallsPayload],
  })) as {
    type?: string
    chainId?: string
    signatureRequest?: { hash?: string }
    userOp?: unknown
  } | null

  if (!prepareResult?.signatureRequest?.hash) {
    throw new Error('wallet_prepareCalls did not return a signature request hash.')
  }
  if (!prepareResult.userOp) {
    throw new Error('wallet_prepareCalls did not return a userOp.')
  }

  const userOpHash = unwrapDoubleHexEncodedHash(
    prepareResult.signatureRequest.hash as `0x${string}`,
  )
  const rawSignature = (await params.signerRequest({
    method: 'personal_sign',
    params: [userOpHash, params.eoaOwnerAddress],
  })) as `0x${string}`

  if (!rawSignature || typeof rawSignature !== 'string' || !rawSignature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }
  if (hexByteLength(rawSignature) !== 65) {
    throw new Error(
      `EOA-owner submission expects a 65-byte ECDSA signature, got ${hexByteLength(rawSignature)} bytes.`,
    )
  }

  let recovered: `0x${string}`
  try {
    recovered = await recoverAddress({ hash: userOpHash, signature: rawSignature })
  } catch (recoveryError) {
    throw new Error(
      `Could not recover signer from userOpHash signature: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
    )
  }
  if (recovered.toLowerCase() !== params.eoaOwnerAddress.toLowerCase()) {
    throw new Error(
      `EOA-owner signature recovered to ${recovered}, not the expected on-chain owner ${params.eoaOwnerAddress}. ` +
        `Connect ${params.eoaOwnerAddress} directly and retry.`,
    )
  }

  const signaturePayload = {
    type: 'secp256k1' as const,
    data: {
      address: params.eoaOwnerAddress,
      signature: rawSignature,
    },
  }

  const sendResult = (await params.cswRequest({
    method: 'wallet_sendPreparedCalls',
    params: [{
      version: '1.0',
      type: prepareResult.type ?? 'user-operation-v06',
      data: prepareResult.userOp,
      chainId: prepareResult.chainId ?? chainIdHex,
      signature: signaturePayload,
      ownerIndex: params.eoaOwnerIndex,
    }],
  })) as unknown

  const callsId = extractWalletCallsId(sendResult)
  if (!callsId) {
    throw new Error('wallet_sendPreparedCalls returned no call bundle id.')
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt < PREPARED_CALLS_STATUS_TIMEOUT_MS) {
    const result = await params.cswRequest({ method: 'wallet_getCallsStatus', params: [callsId] })
    const statusCode = Number((result as { status?: unknown } | null)?.status)
    const receipts = Array.isArray((result as { receipts?: unknown[] } | null)?.receipts)
      ? ((result as { receipts: unknown[] }).receipts ?? [])
      : []
    const receiptHash =
      receipts
        .map((receipt) => String((receipt as { transactionHash?: unknown } | null)?.transactionHash ?? ''))
        .find((value) => isTxHash(value)) ?? null
    if (Number.isFinite(statusCode)) {
      if (statusCode >= 200 && statusCode < 300) {
        if (receiptHash) return receiptHash
        throw new Error('wallet_sendPreparedCalls completed without a transaction hash. Retry shortly.')
      }
      if (statusCode >= 300) {
        throw new Error(`wallet_sendPreparedCalls failed with status ${statusCode}`)
      }
    }
    await delay(PREPARED_CALLS_STATUS_POLL_MS)
  }

  throw new Error('wallet_sendPreparedCalls status is still pending. Wait a moment and retry confirmation.')
}
