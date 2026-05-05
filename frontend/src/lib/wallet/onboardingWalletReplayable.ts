import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import {
  createPublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  recoverAddress,
  recoverMessageAddress,
} from 'viem'
import { base } from 'viem/chains'

import { detectSignatureShape, type SignatureShape } from './signatureShape'

const ENTRY_POINT_V06_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const
const REPLAYABLE_NONCE_KEY = 8453n
const ADD_OWNER_ADDRESS_SELECTOR = '0x0f0f3f24'

export const REPLAYABLE_INNER_SELECTORS = new Set<string>([
  '0x0f0f3f24', // addOwnerAddress(address)
  '0x29565e3b', // addOwnerPublicKey(bytes32,bytes32)
  '0x89625b57', // removeOwnerAtIndex(uint256,bytes)
  '0xb8197367', // removeLastOwner(uint256,bytes)
  '0x4f1ef286', // upgradeToAndCall(address,bytes)
])

export type SelfBuiltUserOpLaneTelemetry = {
  step:
    | 'wrap'
    | 'read_nonce'
    | 'build_userop'
    | 'compute_hash'
    | 'sign'
    | 'signature_preflight'
    | 'splice'
    | 'encode_handle_ops'
    | 'submit_relay'
    | 'success'
    | 'error'
  detail: Record<string, unknown>
}

type V06UserOpFields = {
  sender: `0x${string}`
  nonce: bigint
  initCode: `0x${string}`
  callData: `0x${string}`
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: `0x${string}`
  signature: `0x${string}`
}

type PreflightOutcome =
  | {
      kind: 'ok'
      parsedOwnerIndex: number
      parsedOwnerAddress: `0x${string}` | null
      recoveredAddress: `0x${string}`
      recoveredRawAddress?: `0x${string}` | null
      recoveredEip191Address?: `0x${string}` | null
    }
  | {
      kind: 'mismatch'
      parsedOwnerIndex: number
      parsedOwnerAddress: `0x${string}` | null
      recoveredAddress: `0x${string}`
      recoveredRawAddress?: `0x${string}` | null
      recoveredEip191Address?: `0x${string}` | null
    }
  | {
      kind: 'unknown'
      reason: string
    }
  | {
      kind: 'skipped_webauthn'
      reason: string
    }
  | {
      kind: 'skipped_code_bearing'
      parsedOwnerIndex: number
      parsedOwnerAddress: `0x${string}` | null
    }
  | {
      kind: 'skipped_self_auth_session_key'
      parsedOwnerIndex: number
      parsedOwnerAddress: `0x${string}` | null
      recoveredAddress: `0x${string}`
      recoveredRawAddress?: `0x${string}` | null
      recoveredEip191Address?: `0x${string}` | null
    }

const ENTRY_POINT_V06_HANDLE_OPS_ABI = [
  {
    type: 'function',
    name: 'handleOps',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'ops',
        type: 'tuple[]',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'callGasLimit', type: 'uint256' },
          { name: 'verificationGasLimit', type: 'uint256' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'maxPriorityFeePerGas', type: 'uint256' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [],
  },
] as const

const ENTRY_POINT_V06_GET_NONCE_ABI = [
  {
    type: 'function',
    name: 'getNonce',
    stateMutability: 'view',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
] as const

const CSW_OWNER_AT_INDEX_ABI = [
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: 'owner', type: 'bytes' }],
  },
] as const

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function encodeHandleOpsV06(
  signedUserOp: V06UserOpFields,
  beneficiary: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: ENTRY_POINT_V06_HANDLE_OPS_ABI,
    functionName: 'handleOps',
    args: [[signedUserOp], beneficiary],
  })
}

function serializeUserOpForLog(op: V06UserOpFields): Record<string, string> {
  return {
    sender: op.sender,
    nonce: `0x${op.nonce.toString(16)}`,
    initCode: op.initCode,
    callData: op.callData,
    callGasLimit: `0x${op.callGasLimit.toString(16)}`,
    verificationGasLimit: `0x${op.verificationGasLimit.toString(16)}`,
    preVerificationGas: `0x${op.preVerificationGas.toString(16)}`,
    maxFeePerGas: `0x${op.maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${op.maxPriorityFeePerGas.toString(16)}`,
    paymasterAndData: op.paymasterAndData,
    signature: op.signature,
  }
}

async function readReplayableNonce(
  csw: `0x${string}`,
  rpcUrl: string,
): Promise<bigint> {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const nonce = await client.readContract({
    address: ENTRY_POINT_V06_ADDRESS,
    abi: ENTRY_POINT_V06_GET_NONCE_ABI,
    functionName: 'getNonce',
    args: [csw, REPLAYABLE_NONCE_KEY],
  })
  return nonce as bigint
}

function hashUserOpV06WithoutChainId(op: V06UserOpFields): `0x${string}` {
  const packed = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bytes32' },
    ],
    [
      op.sender,
      op.nonce,
      keccak256(op.initCode),
      keccak256(op.callData),
      op.callGasLimit,
      op.verificationGasLimit,
      op.preVerificationGas,
      op.maxFeePerGas,
      op.maxPriorityFeePerGas,
      keccak256(op.paymasterAndData),
    ],
  )
  return keccak256(packed)
}

function getUserOpHashWithoutChainIdLocal(
  op: V06UserOpFields,
  entryPoint: `0x${string}`,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }],
      [hashUserOpV06WithoutChainId(op), entryPoint],
    ),
  )
}

function extractRelayTxHash(relayResponse: unknown): `0x${string}` | null {
  const root = relayResponse && typeof relayResponse === 'object'
    ? relayResponse as Record<string, unknown>
    : null
  const data = root?.data && typeof root.data === 'object'
    ? root.data as Record<string, unknown>
    : null
  const candidates = [
    root?.txHash,
    root?.transactionHash,
    data?.txHash,
    data?.transactionHash,
    data?.hash,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isTxHash(candidate)) {
      return candidate as `0x${string}`
    }
  }
  return null
}

function parseCoinbaseSignatureWrapper(signature: `0x${string}`): {
  ownerIndex: number
  signatureData: `0x${string}`
} | null {
  const tryDecodeTuple = (value: `0x${string}`) => {
    const [ownerIndexRaw, signatureData] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      value,
    )
    return {
      ownerIndex: Number(ownerIndexRaw),
      signatureData: signatureData as `0x${string}`,
    }
  }
  try {
    return tryDecodeTuple(signature)
  } catch {}
  try {
    const [innerBytes] = decodeAbiParameters([{ type: 'bytes' }], signature)
    return tryDecodeTuple(innerBytes as `0x${string}`)
  } catch {}
  if (hexByteLength(signature) >= 96) {
    const headWord = signature.slice(2, 66).toLowerCase()
    if (headWord === '0000000000000000000000000000000000000000000000000000000000000020') {
      try {
        const stripped = (`0x${signature.slice(66)}`) as `0x${string}`
        return tryDecodeTuple(stripped)
      } catch {}
    }
  }
  return null
}

export function classifyWebAuthnOwnerSignature(signature: `0x${string}`): {
  ok: boolean
  ownerIndex: number | null
  innerSignatureKind: SignatureShape['kind']
  signatureLengthBytes: number
} {
  const signatureWrapper = parseCoinbaseSignatureWrapper(signature)
  const innerSignatureShape = signatureWrapper
    ? detectSignatureShape(signatureWrapper.signatureData)
    : detectSignatureShape(signature)
  return {
    ok: signatureWrapper?.ownerIndex != null && innerSignatureShape.kind === 'webauthn',
    ownerIndex: signatureWrapper?.ownerIndex ?? null,
    innerSignatureKind: innerSignatureShape.kind,
    signatureLengthBytes: (signature.length - 2) / 2,
  }
}

function decodeAddOwnerAddressTarget(innerCallData: `0x${string}`): `0x${string}` | null {
  if (innerCallData.slice(0, 10).toLowerCase() !== ADD_OWNER_ADDRESS_SELECTOR) return null
  if (innerCallData.length < 10) return null
  try {
    const encodedArgs = (`0x${innerCallData.slice(10)}`) as `0x${string}`
    const [ownerAddress] = decodeAbiParameters([{ type: 'address' }], encodedArgs)
    return getAddress(ownerAddress)
  } catch {
    return null
  }
}

function hexBytesToUtf8(hex: string): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  if (stripped.length % 2 !== 0) throw new Error('odd-length hex')
  const bytes = new Uint8Array(stripped.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(stripped.substring(i * 2, i * 2 + 2), 16)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function unwrapDoubleHexEncodedHash(hash: `0x${string}`): `0x${string}` {
  try {
    const decoded = hexBytesToUtf8(hash)
    if (
      decoded.length === 66 &&
      (decoded.startsWith('0x') || decoded.startsWith('0X')) &&
      /^0x[0-9a-fA-F]{64}$/.test(decoded)
    ) {
      return decoded.toLowerCase() as `0x${string}`
    }
  } catch {}
  return hash
}

export function hexByteLength(value: string): number {
  if (!value || typeof value !== 'string') return 0
  if (!value.startsWith('0x')) return 0
  const hex = value.slice(2)
  return Math.floor(hex.length / 2)
}

function parseSignatureForRecovery(signature: `0x${string}`): {
  ownerIndex: number | null
  ecdsaSignature: `0x${string}` | null
} {
  const wrapped = parseCoinbaseSignatureWrapper(signature)
  if (!wrapped) {
    if (hexByteLength(signature) === 65) {
      return { ownerIndex: null, ecdsaSignature: signature }
    }
    return { ownerIndex: null, ecdsaSignature: null }
  }
  const data = wrapped.signatureData
  if (hexByteLength(data) === 65) {
    return { ownerIndex: wrapped.ownerIndex, ecdsaSignature: data }
  }
  return { ownerIndex: wrapped.ownerIndex, ecdsaSignature: null }
}

function decodeOwnerBytesAsAddress(ownerBytes: `0x${string}`): `0x${string}` | null {
  try {
    const [ownerAddress] = decodeAbiParameters([{ type: 'address' }], ownerBytes)
    return getAddress(ownerAddress)
  } catch {
    return null
  }
}

function encodeOwnerAtIndexCall(index: number): `0x${string}` {
  return encodeFunctionData({
    abi: CSW_OWNER_AT_INDEX_ABI,
    functionName: 'ownerAtIndex',
    args: [BigInt(index)],
  })
}

function decodeOwnerAtIndexResult(result: `0x${string}`): `0x${string}` | null {
  try {
    const [bytes] = decodeAbiParameters([{ type: 'bytes' }], result)
    return bytes as `0x${string}`
  } catch {
    return null
  }
}

export async function preflightOwnerKeyMismatch(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  sender: `0x${string}`
  hashToSign: `0x${string}`
  signature: `0x${string}`
  sessionKind?: 'self_auth' | 'external_signer'
}): Promise<PreflightOutcome> {
  const shape = detectSignatureShape(params.signature)
  if (shape.kind === 'webauthn') {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[preflightOwnerKeyMismatch] passkey signature — skipping EOA recovery preflight')
    }
    return { kind: 'skipped_webauthn', reason: 'webauthn signature shape — bundler will verify via CSW.WebAuthn.verify' }
  }

  const parsed = parseSignatureForRecovery(params.signature)
  if (!parsed.ecdsaSignature) {
    return { kind: 'unknown', reason: 'no recoverable 65-byte ecdsa component' }
  }
  if (parsed.ownerIndex === null) {
    return { kind: 'unknown', reason: 'raw 65-byte ecdsa with no parsed owner index' }
  }

  let ownerBytes: `0x${string}` | null = null
  try {
    const result = (await params.walletRequest({
      method: 'eth_call',
      params: [
        {
          to: params.sender,
          data: encodeOwnerAtIndexCall(parsed.ownerIndex),
        },
        'latest',
      ],
    })) as string
    if (typeof result === 'string' && result.startsWith('0x')) {
      ownerBytes = decodeOwnerAtIndexResult(result as `0x${string}`)
    }
  } catch {
    return { kind: 'unknown', reason: 'eth_call ownerAtIndex failed' }
  }
  if (!ownerBytes) {
    return { kind: 'unknown', reason: 'ownerAtIndex returned no bytes' }
  }
  const ownerAddress = decodeOwnerBytesAsAddress(ownerBytes)
  if (!ownerAddress) {
    return { kind: 'skipped_code_bearing', parsedOwnerIndex: parsed.ownerIndex, parsedOwnerAddress: null }
  }

  let codeAtOwner = '0x'
  try {
    const code = (await params.walletRequest({
      method: 'eth_getCode',
      params: [ownerAddress, 'latest'],
    })) as string
    if (typeof code === 'string') codeAtOwner = code
  } catch {
    return { kind: 'unknown', reason: 'eth_getCode failed' }
  }
  if (codeAtOwner !== '0x' && codeAtOwner !== '0x0') {
    return {
      kind: 'skipped_code_bearing',
      parsedOwnerIndex: parsed.ownerIndex,
      parsedOwnerAddress: ownerAddress,
    }
  }

  let recoveredRaw: `0x${string}` | null = null
  try {
    recoveredRaw = await recoverAddress({ hash: params.hashToSign, signature: parsed.ecdsaSignature })
  } catch {}
  let recoveredEip191: `0x${string}` | null = null
  try {
    recoveredEip191 = await recoverMessageAddress({
      message: { raw: params.hashToSign },
      signature: parsed.ecdsaSignature,
    })
  } catch {}

  if (!recoveredRaw && !recoveredEip191) {
    return { kind: 'unknown', reason: 'ecrecover failed (raw and eip191)' }
  }

  const ownerLower = ownerAddress.toLowerCase()
  if (recoveredRaw && recoveredRaw.toLowerCase() === ownerLower) {
    return {
      kind: 'ok',
      parsedOwnerIndex: parsed.ownerIndex,
      parsedOwnerAddress: ownerAddress,
      recoveredAddress: recoveredRaw,
      recoveredRawAddress: recoveredRaw,
      recoveredEip191Address: recoveredEip191,
    }
  }
  if (recoveredEip191 && recoveredEip191.toLowerCase() === ownerLower) {
    return {
      kind: 'ok',
      parsedOwnerIndex: parsed.ownerIndex,
      parsedOwnerAddress: ownerAddress,
      recoveredAddress: recoveredEip191,
      recoveredRawAddress: recoveredRaw,
      recoveredEip191Address: recoveredEip191,
    }
  }
  if (params.sessionKind === 'self_auth') {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug(
        '[preflightOwnerKeyMismatch] self-auth session key substitution — bundler will validate via sub-account path',
        {
          parsedOwnerIndex: parsed.ownerIndex,
          parsedOwnerAddress: ownerAddress,
          recoveredRaw,
          recoveredEip191,
        },
      )
    }
    return {
      kind: 'skipped_self_auth_session_key',
      parsedOwnerIndex: parsed.ownerIndex,
      parsedOwnerAddress: ownerAddress,
      recoveredAddress: recoveredRaw ?? recoveredEip191 ?? ('0x' as `0x${string}`),
      recoveredRawAddress: recoveredRaw,
      recoveredEip191Address: recoveredEip191,
    }
  }
  return {
    kind: 'mismatch',
    parsedOwnerIndex: parsed.ownerIndex,
    parsedOwnerAddress: ownerAddress,
    recoveredAddress: recoveredRaw ?? recoveredEip191 ?? ('0x' as `0x${string}`),
    recoveredRawAddress: recoveredRaw,
    recoveredEip191Address: recoveredEip191,
  }
}

export function encodeExecuteWithoutChainIdValidation(
  innerCallData: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'executeWithoutChainIdValidation',
        inputs: [{ name: 'calls', type: 'bytes[]' }],
        outputs: [],
        stateMutability: 'payable',
      },
    ] as const,
    functionName: 'executeWithoutChainIdValidation',
    args: [[innerCallData]],
  })
}

export async function _submitOwnerViaSelfBuiltUserOp(params: {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  csw: `0x${string}`
  innerCallData: `0x${string}`
  expectedOwnerAddress?: `0x${string}` | null
  requireWebAuthnOwnerSignature?: boolean
  sessionKind?: 'self_auth' | 'external_signer'
  rpcUrl?: string
  beneficiary?: `0x${string}`
  onTelemetry?: (event: SelfBuiltUserOpLaneTelemetry) => void
}): Promise<{
  userOp: V06UserOpFields
  hashSigned: `0x${string}`
  signature: `0x${string}`
  handleOpsCalldata: `0x${string}`
  relayResponse: unknown
  txHash: `0x${string}` | null
}> {
  const emit = (event: SelfBuiltUserOpLaneTelemetry) => {
    try {
      params.onTelemetry?.(event)
    } catch {}
  }

  const innerSelector = params.innerCallData.slice(0, 10).toLowerCase()
  if (!REPLAYABLE_INNER_SELECTORS.has(innerSelector)) {
    throw new Error(
      `Inner selector ${innerSelector} is not in canSkipChainIdValidation. Only addOwnerAddress / addOwnerPublicKey / removeOwnerAtIndex / removeLastOwner / upgradeToAndCall are valid for the replayable lane.`,
    )
  }
  const addOwnerTarget = decodeAddOwnerAddressTarget(params.innerCallData)
  if (innerSelector === ADD_OWNER_ADDRESS_SELECTOR && !addOwnerTarget) {
    throw new Error('Replayable owner-install lane could not decode addOwnerAddress(address) call target.')
  }
  if (params.expectedOwnerAddress && addOwnerTarget) {
    const expectedOwner = getAddress(params.expectedOwnerAddress)
    if (addOwnerTarget.toLowerCase() !== expectedOwner.toLowerCase()) {
      emit({
        step: 'error',
        detail: {
          stage: 'validate_intent',
          reason: 'add_owner_target_mismatch',
          expectedOwnerAddress: expectedOwner,
          decodedAddOwnerTarget: addOwnerTarget,
        },
      })
      throw new Error(
        `Prepared addOwnerAddress target ${addOwnerTarget} does not match intended owner ${expectedOwner}. Reload /add-owner and retry so Coinbase signs the exact owner-install payload.`,
      )
    }
  }
  const wrappedData = encodeExecuteWithoutChainIdValidation(params.innerCallData)
  emit({ step: 'wrap', detail: { innerSelector, innerCallData: params.innerCallData, addOwnerTarget, wrappedData } })
  const requireWebAuthnOwnerSignature =
    Boolean(params.requireWebAuthnOwnerSignature) ||
    (params.sessionKind === 'self_auth' && innerSelector === ADD_OWNER_ADDRESS_SELECTOR)

  const rpcUrl = params.rpcUrl ?? 'https://mainnet.base.org'
  const nonce = await readReplayableNonce(params.csw, rpcUrl)
  emit({ step: 'read_nonce', detail: { nonce: `0x${nonce.toString(16)}` } })

  const userOp: V06UserOpFields = {
    sender: params.csw,
    nonce,
    initCode: '0x',
    callData: wrappedData,
    callGasLimit: 150_000n,
    verificationGasLimit: 1_000_000n,
    preVerificationGas: 0n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    paymasterAndData: '0x',
    signature: '0x',
  }
  emit({ step: 'build_userop', detail: { userOp: serializeUserOpForLog(userOp) } })

  const hashToSign = getUserOpHashWithoutChainIdLocal(userOp, ENTRY_POINT_V06_ADDRESS)
  emit({ step: 'compute_hash', detail: { hashToSign } })

  const signAttempts: Array<{
    method: 'personal_sign' | 'eth_sign'
    params: unknown[]
    label: string
    signature: `0x${string}` | null
    ownerIndex: number | null
    innerSignatureKind: SignatureShape['kind'] | 'invalid'
    signatureLengthBytes: number
    ownerRecoveryOutcome?: string | null
    error?: string
  }> = []
  const signatureCandidates: Array<{
    method: 'personal_sign' | 'eth_sign'
    params: unknown[]
    label: string
  }> = requireWebAuthnOwnerSignature
    ? [
      // For embedded-owner installs we want the Coinbase passkey/WebAuthn lane only.
      // Restricting to the canonical personal_sign argument order avoids drifting into
      // alternate ECDSA-style responses from fallback signer implementations.
      { method: 'personal_sign', params: [hashToSign, params.csw], label: 'personal_sign_data_address' },
      // Retry once on the same canonical method to handle transient popup/provider failures
      // without broadening into non-WebAuthn signature lanes.
      { method: 'personal_sign', params: [hashToSign, params.csw], label: 'personal_sign_data_address_retry' },
    ]
    : [
      { method: 'personal_sign', params: [hashToSign, params.csw], label: 'personal_sign_data_address' },
      { method: 'personal_sign', params: [params.csw, hashToSign], label: 'personal_sign_address_data' },
      { method: 'eth_sign', params: [params.csw, hashToSign], label: 'eth_sign_address_hash' },
    ]
  let signature: `0x${string}` | null = null
  let webAuthnOwnerCheck: ReturnType<typeof classifyWebAuthnOwnerSignature> | null = null
  let acceptedSignatureKind: 'webauthn_owner' | 'ecdsa_owner_recovered' | null = null
  for (const candidate of signatureCandidates) {
    try {
      const maybeSignature = (await params.walletRequest({
        method: candidate.method,
        params: candidate.params,
      })) as `0x${string}`
      if (!maybeSignature || !maybeSignature.startsWith('0x')) {
        signAttempts.push({
          method: candidate.method,
          params: candidate.params,
          label: candidate.label,
          signature: null,
          ownerIndex: null,
          innerSignatureKind: 'invalid',
          signatureLengthBytes: 0,
          error: 'invalid_signature_payload',
        })
        continue
      }
      const classification = classifyWebAuthnOwnerSignature(maybeSignature)
      let ownerRecoveryOutcome: string | null = null
      if (!classification.ok) {
        const ownerRecovery = await preflightOwnerKeyMismatch({
          walletRequest: params.walletRequest,
          sender: params.csw,
          hashToSign,
          signature: maybeSignature,
          sessionKind: params.sessionKind ?? 'external_signer',
        })
        ownerRecoveryOutcome = ownerRecovery.kind
        if (
          !requireWebAuthnOwnerSignature &&
          (ownerRecovery.kind === 'ok' || ownerRecovery.kind === 'skipped_self_auth_session_key')
        ) {
          signature = maybeSignature
          webAuthnOwnerCheck = classification
          acceptedSignatureKind = 'ecdsa_owner_recovered'
        }
      }
      signAttempts.push({
        method: candidate.method,
        params: candidate.params,
        label: candidate.label,
        signature: maybeSignature,
        ownerIndex: classification.ownerIndex,
        innerSignatureKind: classification.innerSignatureKind,
        signatureLengthBytes: classification.signatureLengthBytes,
        ownerRecoveryOutcome,
      })
      if (classification.ok) {
        signature = maybeSignature
        webAuthnOwnerCheck = classification
        acceptedSignatureKind = 'webauthn_owner'
        break
      }
      if (acceptedSignatureKind === 'ecdsa_owner_recovered') break
    } catch (error) {
      signAttempts.push({
        method: candidate.method,
        params: candidate.params,
        label: candidate.label,
        signature: null,
        ownerIndex: null,
        innerSignatureKind: 'invalid',
        signatureLengthBytes: 0,
        ownerRecoveryOutcome: null,
        error: error instanceof Error ? error.message : String(error ?? ''),
      })
    }
  }
  const lastValidAttempt = [...signAttempts].reverse().find((attempt) => Boolean(attempt.signature))
  if (!signature || !webAuthnOwnerCheck) {
    emit({
      step: 'error',
      detail: {
        stage: 'sign',
        reason: 'coinbase_did_not_return_acceptable_owner_signature',
        hashSigned: hashToSign,
        signAttempts: signAttempts.map((attempt) => ({
          method: attempt.method,
          label: attempt.label,
          ownerIndex: attempt.ownerIndex,
          innerSignatureKind: attempt.innerSignatureKind,
          signatureLengthBytes: attempt.signatureLengthBytes,
          ownerRecoveryOutcome: attempt.ownerRecoveryOutcome ?? null,
          error: attempt.error ?? null,
        })),
        intendedAddOwnerTarget: addOwnerTarget,
      },
    })
    throw new Error(
      `Coinbase did not return an acceptable owner signature after trying ${signAttempts.map((a) => a.label).join(', ')}. Re-open /add-owner in Base app and select a Coinbase passkey credential for this smart wallet before approving.`,
    )
  }
  emit({
    step: 'sign',
    detail: {
      hashSigned: hashToSign,
      signature,
      signatureLengthBytes: (signature.length - 2) / 2,
      acceptedSignatureKind,
      signMethod: lastValidAttempt?.method ?? 'personal_sign',
      signLabel: lastValidAttempt?.label ?? 'personal_sign_data_address',
    },
  })
  emit({
    step: 'signature_preflight',
    detail: {
      outcome: acceptedSignatureKind ?? (webAuthnOwnerCheck.ok ? 'webauthn_owner' : 'not_webauthn_owner'),
      ownerIndex: webAuthnOwnerCheck.ownerIndex,
      innerSignatureKind: webAuthnOwnerCheck.innerSignatureKind,
      signatureLengthBytes: webAuthnOwnerCheck.signatureLengthBytes,
      intendedAddOwnerTarget: addOwnerTarget,
    },
  })
  const signedUserOp: V06UserOpFields = { ...userOp, signature }
  emit({ step: 'splice', detail: { signedUserOp: serializeUserOpForLog(signedUserOp) } })

  const beneficiary = params.beneficiary ?? params.csw
  const handleOpsCalldata = encodeHandleOpsV06(signedUserOp, beneficiary)
  emit({
    step: 'encode_handle_ops',
    detail: {
      entryPointAddress: ENTRY_POINT_V06_ADDRESS,
      beneficiary,
      handleOpsCalldata,
      handleOpsLengthBytes: (handleOpsCalldata.length - 2) / 2,
    },
  })

  const relayBody = {
    chainId: params.chainId,
    to: ENTRY_POINT_V06_ADDRESS,
    data: handleOpsCalldata,
    value: '0',
    user: params.csw,
  }
  emit({ step: 'submit_relay', detail: { stage: 'request', relayBody } })

  const fetchResult = await apiFetch('/api/relay/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(relayBody),
  })
  if (!fetchResult.ok) {
    let rawText = ''
    let parsedBody: unknown = null
    try {
      rawText = await fetchResult.clone().text()
    } catch {}
    try {
      parsedBody = rawText ? JSON.parse(rawText) : null
    } catch {}
    const errMessage = await resolveApiErrorMessage(fetchResult, 'Relay /execute proxy failed')
    emit({
      step: 'error',
      detail: {
        stage: 'submit_relay',
        status: fetchResult.status,
        message: errMessage,
        rawBodyFirst500: rawText.slice(0, 500),
        rawBodyTotalLen: rawText.length,
        parsedBody,
      },
    })
    throw new Error(errMessage)
  }
  const relayResponse = await fetchResult.json()
  const txHash = extractRelayTxHash(relayResponse)
  emit({ step: 'success', detail: { relayResponse, txHash } })
  return {
    userOp: signedUserOp,
    hashSigned: hashToSign,
    signature,
    handleOpsCalldata,
    relayResponse,
    txHash,
  }
}
