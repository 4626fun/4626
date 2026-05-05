import { useEffect, useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient } from 'wagmi'
import {
  decodeAbiParameters,
  encodeFunctionData,
  encodeAbiParameters,
  getAddress,
  hashMessage,
  hashTypedData,
  isAddress,
  keccak256,
  recoverAddress,
  stringToHex,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { selectPreferredWalletConnector } from '@/lib/wallet/wagmiConnectorSelection'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import {
  _submitOwnerViaSelfBuiltUserOp,
  encodeExecuteWithoutChainIdValidation,
  _submitOwnerViaPreparedCallsAllowAnyOwner,
  _submitOwnerViaWalletSendCalls,
  unwrapDoubleHexEncodedHash,
} from '@/lib/wallet/onboardingWallet'
import { detectSignatureShape, type SignatureShape } from '@/lib/wallet/signatureShape'
import { checkEphemeralKey, type EphemeralKeySignal } from '@/lib/wallet/ephemeralKeyHeuristic'
import { computeProbeVerdict, hasUsableEcdsaRecovery } from '@/lib/wallet/probeVerdict'
import {
  inferOwnerIndexFromShape,
  type InferOwnerSlot,
} from '@/lib/wallet/inferOwnerIndexFromShape'
import {
  captureWalletSessionSnapshot,
  type WalletSessionSnapshot,
} from '@/lib/wallet/walletSessionSnapshot'

const CSW_OWNER_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  // Authoritative: the contract's own replaySafeHash. We read this on-chain
  // instead of trusting our local buildReplaySafeHash, in case domain params
  // (name/version/chainId/verifyingContract) drift.
  {
    type: 'function',
    name: 'replaySafeHash',
    stateMutability: 'view',
    inputs: [{ name: 'hash', type: 'bytes32' }],
    outputs: [{ type: 'bytes32' }],
  },
] as const

const ERC1271_ABI = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes4' }],
  },
] as const

// EIP-1271 magic value: bytes4(keccak256("isValidSignature(bytes32,bytes)"))
const ERC1271_MAGIC_VALUE: Hex = '0x1626ba7e'
const DEBUG_SESSION_ID = '345a30'
const DEBUG_ENDPOINT = 'http://127.0.0.1:7706/ingest/3a1085e1-3d80-4358-aa04-a03ce8273573'
const KNOWN_EOA_OWNER_INDEX = 2
const KNOWN_EOA_OWNER_ADDRESS = '0xCf8D17Ce01B73637ef936fe7c47bA7100b820142' as const

const CSW_OWNER_MUTATION_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeOwnerAtIndex',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'owner', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeLastOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'owner', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

const CREATE2_DEPLOYER_AUTH_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'authorizedDeployers',
    stateMutability: 'view',
    inputs: [{ name: 'deployer', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setAuthorizedDeployer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'deployer', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
] as const

type OwnerSlot = {
  index: number
  ownerBytes: Hex
  ownerBytesLength: number
  ownerType: 'eoa' | 'passkey' | 'unknown'
  ownerAddress: Address | null
}

type ProbeResult = {
  method: string
  signature: Hex
  parsedSignatureKind:
    | 'raw-ecdsa'
    | 'signature-wrapper'
    | 'signature-wrapper-bytes'
    | 'signature-wrapper-leading-offset'
    | 'unknown'
  parsedOwnerIndex: number | null
  parsedOwnerAddress: Address | null
  parsedOwnerIndexMatchesTarget: boolean
  parsedSignatureData: Hex | null
  ecdsaSignatureForRecovery: Hex | null
  replaySafeHash: Hex
  recoveredDirect: Address | null
  recoveredPrefixed: Address | null
  recoveredAgainstReplaySafe: Address | null
  recoveredAgainstPrefixedReplaySafe: Address | null
  onchainReplaySafeHash: Hex | null
  // Tri-state: true — local matches on-chain; false — they differ;
  // null — on-chain lookup failed (call reverted / RPC error). Treating a
  // failed lookup as `false` would mislead diagnosis into a 'mismatch'
  // branch, so we preserve the unknown state explicitly.
  localReplaySafeMatchesOnchain: boolean | null
  recoveredAgainstOnchainReplaySafe: Address | null
  // Live on-chain snapshot of ownerAtIndex(parsedOwnerIndex), read at probe
  // time — not from cached state. This avoids stale or empty `parsedOwnerAddress`
  // when the owner-slot panel hasn't been loaded for the current CSW.
  parsedOwnerAddressOnchain: Address | null
  parsedOwnerRawBytesOnchain: Hex | null
  targetOwnerIndex: number
  targetOwnerAddress: Address | null
  directMatchesTarget: boolean
  prefixedMatchesTarget: boolean
  wrappedSignature: Hex
  signedHash: Hex
  erc1271MagicValue: Hex | null
  erc1271Verified: boolean
  // Coarse shape classifier — orthogonal to `parsedSignatureKind`. Drives the
  // verdict banner: webauthn signatures are routed through CSW.WebAuthn.verify
  // and ecrecover-based diagnostics below are inapplicable.
  signatureShape: SignatureShape
  signatureByteLength: number
  // For webauthn shape only: pre-decoded view of the clientDataJSON.challenge
  // field (base64url) plus a comparison to the signed hash and on-chain
  // replaySafeHash. Null if the signature is not webauthn or decode failed.
  webauthnChallenge: {
    raw: string
    decodedHex: Hex | null
    matchesSignedHash: boolean
    matchesOnchainReplaySafeHash: boolean | null
  } | null
  // Snapshot of what the wallet provider thought the connected session was
  // at the moment the probe sign was issued. Surfaces Base App sub-account
  // substitution before the popup even returns a signature. See
  // walletSessionSnapshot.ts for the warningState semantics.
  walletSession: WalletSessionSnapshot | null
}

type StepState = { kind: 'idle' | 'pending' | 'ok' | 'err'; label: string; detail?: string }

const INITIAL_STEP: StepState = { kind: 'idle', label: 'not run' }

type RemoveOwnerPreview = {
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  preflight: {
    selectedFunction: 'removeOwnerAtIndex' | 'removeLastOwner'
    selectedBy?: 'heuristic' | 'simulation'
    targetOwnerIndex: number
    targetOwnerBytes: `0x${string}`
    targetOwnerAddress: `0x${string}` | null
    highestPopulatedOwnerIndex: number
    ownerCount: number
    nextOwnerIndex: number
    simulation: {
      ok: boolean
      error: string | null
      removeOwnerAtIndex?: { ok: boolean; error: string | null }
      removeLastOwner?: { ok: boolean; error: string | null }
    }
  }
}

type RelayQuoteEnvelope = {
  success?: boolean
  error?: string
  data?: {
    steps?: Array<{
      id?: string
      kind?: string
      requestId?: string
      items?: Array<{
        status?: string
        data?: {
          from?: string
          to?: string
          data?: string
          value?: string
          chainId?: number
        }
        check?: {
          endpoint?: string
          method?: string
        }
      }>
    }>
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error ?? 'unknown error')
}

function decodeOwnerSlot(index: number, ownerBytes: Hex): OwnerSlot {
  const ownerBytesLength = (ownerBytes.length - 2) / 2
  if (ownerBytesLength === 32) {
    try {
      const decoded = decodeAbiParameters([{ type: 'address' }], ownerBytes)[0]
      if (isAddress(decoded) && decoded !== '0x0000000000000000000000000000000000000000') {
        return {
          index,
          ownerBytes,
          ownerBytesLength,
          ownerType: 'eoa',
          ownerAddress: getAddress(decoded),
        }
      }
    } catch {
      // fall through to unknown
    }
  }
  if (ownerBytesLength === 64) {
    return {
      index,
      ownerBytes,
      ownerBytesLength,
      ownerType: 'passkey',
      ownerAddress: null,
    }
  }
  return {
    index,
    ownerBytes,
    ownerBytesLength,
    ownerType: 'unknown',
    ownerAddress: null,
  }
}

function hexByteLength(value: Hex): number {
  return Math.max(0, (value.length - 2) / 2)
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x([a-fA-F0-9]{64})$/.test(value)
}

function emitProbeDebug(params: {
  runId: string
  hypothesisId: string
  location: string
  message: string
  data: Record<string, unknown>
}): void {
  if (typeof fetch !== 'function') return
  // #region agent log
  fetch(DEBUG_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':DEBUG_SESSION_ID},body:JSON.stringify({sessionId:DEBUG_SESSION_ID,runId:params.runId,hypothesisId:params.hypothesisId,location:params.location,message:params.message,data:params.data,timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}

type ParsedWalletSignature = {
  kind:
    | 'raw-ecdsa'
    | 'signature-wrapper'
    | 'signature-wrapper-bytes'
    | 'signature-wrapper-leading-offset'
    | 'unknown'
  ownerIndex: number | null
  signatureData: Hex | null
  ecdsaSignature: Hex | null
}

function parseWalletSignature(signature: Hex): ParsedWalletSignature {
  if (hexByteLength(signature) === 65) {
    return {
      kind: 'raw-ecdsa',
      ownerIndex: null,
      signatureData: signature,
      ecdsaSignature: signature,
    }
  }

  const tryDecodeTuple = (value: Hex) => {
    const [ownerIndexRaw, signatureData] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      value,
    )
    const ownerIndex = Number(ownerIndexRaw)
    const ecdsaSignature = hexByteLength(signatureData) === 65 ? signatureData : null
    return { ownerIndex, signatureData, ecdsaSignature }
  }

  try {
    const decoded = tryDecodeTuple(signature)
    return {
      kind: 'signature-wrapper',
      ownerIndex: decoded.ownerIndex,
      signatureData: decoded.signatureData,
      ecdsaSignature: decoded.ecdsaSignature,
    }
  } catch {
    // fall through
  }

  try {
    const [innerBytes] = decodeAbiParameters([{ type: 'bytes' }], signature)
    const decoded = tryDecodeTuple(innerBytes)
    return {
      kind: 'signature-wrapper-bytes',
      ownerIndex: decoded.ownerIndex,
      signatureData: decoded.signatureData,
      ecdsaSignature: decoded.ecdsaSignature,
    }
  } catch {
    // fall through
  }

  // Observed Base App return shape:
  // [0]=0x20, [1]=ownerIndex, [2]=0x40, [3]=0x41, [4..]=r,s,v
  // i.e. a single leading ABI offset word before SignatureWrapper tuple bytes.
  try {
    if (hexByteLength(signature) >= 96) {
      const headWord = signature.slice(2, 66).toLowerCase()
      if (headWord === '0000000000000000000000000000000000000000000000000000000000000020') {
        const stripped = (`0x${signature.slice(66)}`) as Hex
        const decoded = tryDecodeTuple(stripped)
        return {
          kind: 'signature-wrapper-leading-offset',
          ownerIndex: decoded.ownerIndex,
          signatureData: decoded.signatureData,
          ecdsaSignature: decoded.ecdsaSignature,
        }
      }
    }
  } catch {
    // fall through
  }

  return {
    kind: 'unknown',
    ownerIndex: null,
    signatureData: null,
    ecdsaSignature: null,
  }
}

function buildReplaySafeHash(params: { smartWallet: Address; userOpHash: Hex }): Hex {
  return hashTypedData({
    domain: {
      name: 'Coinbase Smart Wallet',
      version: '1',
      chainId: base.id,
      verifyingContract: params.smartWallet,
    },
    types: {
      CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
    },
    primaryType: 'CoinbaseSmartWalletMessage',
    message: { hash: params.userOpHash },
  })
}

function makeChallengeHash(): Hex {
  return keccak256(
    stringToHex(`4626-csw-probe:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`),
  )
}

// Decode the base64url-encoded `challenge` field from a WebAuthn clientDataJSON
// into hex bytes. Browsers (and the CSW tests) emit base64url *without* padding,
// so we restore '=' before delegating to `atob`. Returns null if the input is
// missing or not valid base64url.
function base64UrlDecodeToHex(value: string): Hex | null {
  if (!value) return null
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    const binary = atob(padded + padding)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    let hex = '0x'
    for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
    return hex as Hex
  } catch {
    return null
  }
}

// Pull the `challenge` string out of a clientDataJSON blob. The field is a
// base64url-encoded byte string of whatever the relying party gave the
// authenticator — for a CSW WebAuthn signature, that's the userOpHash (or the
// replaySafeHash, depending on which path the wallet exercised). Tolerant of
// malformed JSON: returns null on any parse failure.
function readWebauthnChallengeField(clientDataJSON: string): string | null {
  try {
    const parsed = JSON.parse(clientDataJSON) as { challenge?: unknown }
    if (typeof parsed.challenge === 'string') return parsed.challenge
    return null
  } catch {
    return null
  }
}

export function CswSignatureProbe() {
  const { address: connectedAddress, chainId } = useAccount()
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient()

  const [cswInput, setCswInput] = useState('0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef')
  // Default to owner[0] (passkey via Base App popup) — the canonical signer
  // for the addOwnerAddress self-call lane. Recovery rows for non-passkey
  // indices may be meaningless if the active wallet session doesn't actually
  // hold that owner's key (the popup happily wraps a foreign signature into
  // a SignatureWrapper that *claims* the requested ownerIndex).
  const [targetOwnerIndex, setTargetOwnerIndex] = useState(0)
  const [challengeHash, setChallengeHash] = useState<Hex>(() => makeChallengeHash())
  const [ownerReadState, setOwnerReadState] = useState<StepState>(INITIAL_STEP)
  const [signState, setSignState] = useState<StepState>(INITIAL_STEP)
  const [connectState, setConnectState] = useState<StepState>(INITIAL_STEP)
  const [preparedCallsState, setPreparedCallsState] = useState<StepState>(INITIAL_STEP)
  const [preparedCallsTxHash, setPreparedCallsTxHash] = useState<string | null>(null)
  const [preparedCallEventLog, setPreparedCallEventLog] = useState<string[]>([])
  const [ownerToAddInput, setOwnerToAddInput] = useState('0xb2aad65a5402714bf428a66731ae62ba5c45cac0')
  const [preparedCallsUsePaymaster] = useState(true)
  const [ownerToRemoveIndexInput, setOwnerToRemoveIndexInput] = useState('2')
  const [ownerRemoveState, setOwnerRemoveState] = useState<StepState>(INITIAL_STEP)
  const [ownerRemoveTxHash, setOwnerRemoveTxHash] = useState<string | null>(null)
  const [ownerRemoveEventLog, setOwnerRemoveEventLog] = useState<string[]>([])
  const [ownerRemovePreview, setOwnerRemovePreview] = useState<RemoveOwnerPreview | null>(null)
  const [ownerRemoveUserOpState, setOwnerRemoveUserOpState] = useState<StepState>(INITIAL_STEP)
  const [ownerRemoveUserOpTxHash, setOwnerRemoveUserOpTxHash] = useState<string | null>(null)
  const [create2DeployerInput, setCreate2DeployerInput] = useState('0x808f2Cf1b7e7afaC561dd9d2A2aA20be15EEb3fd')
  const [authorizedDeployerInput, setAuthorizedDeployerInput] = useState('0xab6d5c10b03300326cd7fab7267ae192842967b5')
  const [create2ReadState, setCreate2ReadState] = useState<StepState>(INITIAL_STEP)
  const [create2WriteState, setCreate2WriteState] = useState<StepState>(INITIAL_STEP)
  const [create2TxHash, setCreate2TxHash] = useState<string | null>(null)
  const [create2OwnerAddress, setCreate2OwnerAddress] = useState<string | null>(null)
  const [create2IsAuthorized, setCreate2IsAuthorized] = useState<boolean | null>(null)
  const [ownerSlots, setOwnerSlots] = useState<OwnerSlot[]>([])
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null)
  // Cache of eth_getCode + eth_getTransactionCount results keyed by lowercased
  // address. Populated lazily when the verdict turns red so that recovered
  // candidates with no on-chain history can be flagged as Base App
  // sub-account/session keys.
  const [ephemeralSignals, setEphemeralSignals] = useState<Map<string, EphemeralKeySignal>>(
    () => new Map(),
  )
  // Live wallet-session snapshot. Refreshed on demand and on every probe sign.
  // Independent of `probeResult` so the user can spot a sub-account session
  // before they even click `probe personal_sign`.
  const [walletSession, setWalletSession] = useState<WalletSessionSnapshot | null>(null)
  const [walletSessionState, setWalletSessionState] = useState<StepState>(INITIAL_STEP)

  const normalizedCswAddress = useMemo(() => {
    const raw = String(cswInput ?? '').trim()
    if (!isAddress(raw)) return null
    return getAddress(raw)
  }, [cswInput])
  const selfAuthSession = useMemo(() => {
    if (!normalizedCswAddress || !connectedAddress) return false
    return connectedAddress.toLowerCase() === normalizedCswAddress.toLowerCase()
  }, [connectedAddress, normalizedCswAddress])

  const targetOwnerAddress = useMemo(() => {
    return ownerSlots.find((slot) => slot.index === targetOwnerIndex)?.ownerAddress ?? null
  }, [ownerSlots, targetOwnerIndex])

  // Single-glance verdict: does ANY recovered address match an on-chain owner?
  // Tri-state: 'green' = match, 'yellow' = unknown (no on-chain snapshot or no
  // recoverable signature), 'red' = recovery succeeded but nothing matched.
  // The yellow state preserves the #496 tri-state principle: a missing
  // owner-snapshot is NOT the same as a confirmed mismatch.
  const verdict = useMemo(() => {
    if (!probeResult) return null
    return computeProbeVerdict(probeResult, ownerSlots)
  }, [probeResult, ownerSlots])

  // Shape-inferred owner index. The wrapper's `parsedOwnerIndex` is unreliable
  // (Base App hard-codes it to 2 for some flows even when the inner bytes are
  // a WebAuthnAuth tuple), so the SHAPE of the inner signature is the source
  // of truth. See lib/wallet/inferOwnerIndexFromShape.ts.
  const inferredOwner = useMemo(() => {
    if (!probeResult) return null
    const ownersForInference: InferOwnerSlot[] = ownerSlots
      .filter((slot) => slot.ownerType === 'eoa' || slot.ownerType === 'passkey')
      .map((slot) => ({
        index: slot.index,
        kind: slot.ownerType as 'eoa' | 'passkey',
        address: slot.ownerAddress ?? undefined,
        pubkey: slot.ownerType === 'passkey' ? slot.ownerBytes : undefined,
      }))
    return inferOwnerIndexFromShape({
      shape: probeResult.signatureShape.kind,
      wrapperClaimedIndex: probeResult.parsedOwnerIndex,
      owners: ownersForInference,
      recoveredCandidates: {
        raw: probeResult.recoveredDirect ?? undefined,
        eip191: probeResult.recoveredPrefixed ?? undefined,
      },
    })
  }, [probeResult, ownerSlots])

  // When the inferred owner index disagrees with the wrapper's claim, re-run
  // ERC-1271 against the inferred owner using the SAME on-chain
  // `replaySafeHash` + `isValidSignature(0x1626ba7e)` path the probe already
  // exercised, except with a SignatureWrapper that targets the inferred
  // index. We don't introduce a new transport — `publicClient.readContract`
  // is the existing path. Result is tri-state: 'valid' | 'invalid' | 'skipped'.
  const [reverificationState, setReverificationState] = useState<{
    state: 'valid' | 'invalid' | 'skipped' | 'pending'
    detail: string
  } | null>(null)
  useEffect(() => {
    if (!probeResult || !inferredOwner || !publicClient || !normalizedCswAddress) {
      setReverificationState(null)
      return
    }
    if (
      inferredOwner.inferredIndex === null ||
      inferredOwner.inferredIndex === probeResult.parsedOwnerIndex
    ) {
      setReverificationState(null)
      return
    }
    // Only EOA owners can be re-wrapped client-side — for passkey inference
    // we don't have the WebAuthnAuth bytes split out into a fresh wrapper, so
    // the existing wallet-returned signature is the only thing we can verify
    // and that already happened in the main probe path.
    if (inferredOwner.inferredKind !== 'eoa') {
      setReverificationState({
        state: 'skipped',
        detail:
          'inferred owner is a passkey — the original wallet-returned signature is what gets verified; no client-side re-wrap is possible.',
      })
      return
    }
    if (!probeResult.ecdsaSignatureForRecovery) {
      setReverificationState({
        state: 'skipped',
        detail: 'no inner 65-byte ECDSA signature to re-wrap.',
      })
      return
    }
    let cancelled = false
    setReverificationState({ state: 'pending', detail: 're-verifying…' })
    void (async () => {
      try {
        const rewrapped = encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'bytes' }],
          [BigInt(inferredOwner.inferredIndex as number), probeResult.ecdsaSignatureForRecovery as Hex],
        )
        const result = (await publicClient.readContract({
          address: normalizedCswAddress,
          abi: ERC1271_ABI,
          functionName: 'isValidSignature',
          args: [probeResult.signedHash, rewrapped],
        })) as Hex
        if (cancelled) return
        const ok = result.toLowerCase() === ERC1271_MAGIC_VALUE
        setReverificationState({
          state: ok ? 'valid' : 'invalid',
          detail: `CSW.isValidSignature returned ${result} for SignatureWrapper(ownerIndex=${inferredOwner.inferredIndex}, innerEcdsa).`,
        })
      } catch (error) {
        if (cancelled) return
        setReverificationState({
          state: 'invalid',
          detail: `re-verification reverted: ${describeError(error)}`,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [probeResult, inferredOwner, publicClient, normalizedCswAddress])

  // True only when the verdict was reached via the unknown-shape-with-recovery
  // path — i.e. a wrapped EOA signature whose outer bytes don't classify but
  // whose inner ECDSA still recovers. Drives the explanatory note above the
  // recovery table so users aren't surprised by a red/green verdict on an
  // "unrecognized" shape.
  const verdictUsedUnknownWithRecovery = useMemo(() => {
    if (!probeResult) return false
    if (probeResult.signatureShape.kind !== 'unknown') return false
    return hasUsableEcdsaRecovery(probeResult)
  }, [probeResult])

  // Unique non-null recovered addresses across all five hash variants. Lower-
  // cased so de-duping the side-by-side rows yields the same set the
  // ephemeral-key heuristic operates on.
  const uniqueRecoveredAddresses = useMemo<Address[]>(() => {
    if (!probeResult) return []
    const candidates = [
      probeResult.recoveredDirect,
      probeResult.recoveredAgainstOnchainReplaySafe,
      probeResult.recoveredAgainstReplaySafe,
      probeResult.recoveredPrefixed,
      probeResult.recoveredAgainstPrefixedReplaySafe,
    ]
    const seen = new Set<string>()
    const out: Address[] = []
    for (const addr of candidates) {
      if (!addr) continue
      const lower = addr.toLowerCase()
      if (seen.has(lower)) continue
      seen.add(lower)
      out.push(addr)
    }
    return out
  }, [probeResult])

  // When the verdict goes red, query eth_getCode + eth_getTransactionCount for
  // each unique recovered candidate. Best-effort: failures fall through to a
  // null signal that's rendered as "—" in the UI. Cache by lowercased address
  // so reruns of the verdict memo don't refetch.
  useEffect(() => {
    if (!publicClient) return
    if (verdict?.state !== 'red') return
    if (uniqueRecoveredAddresses.length === 0) return
    const toQuery = uniqueRecoveredAddresses.filter(
      (addr) => !ephemeralSignals.has(addr.toLowerCase()),
    )
    if (toQuery.length === 0) return
    let cancelled = false
    void (async () => {
      const results = await Promise.allSettled(
        toQuery.map((addr) => checkEphemeralKey(publicClient, addr)),
      )
      if (cancelled) return
      setEphemeralSignals((prev) => {
        const next = new Map(prev)
        for (let i = 0; i < toQuery.length; i++) {
          const addr = toQuery[i]
          const res = results[i]
          if (!addr || !res) continue
          if (res.status === 'fulfilled') {
            next.set(addr.toLowerCase(), res.value)
          } else {
            next.set(addr.toLowerCase(), {
              address: addr,
              code: null,
              txCount: null,
              isEphemeralCandidate: false,
            })
          }
        }
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [publicClient, verdict?.state, uniqueRecoveredAddresses, ephemeralSignals])

  const ephemeralCandidates = useMemo<EphemeralKeySignal[]>(() => {
    if (verdict?.state !== 'red') return []
    return uniqueRecoveredAddresses
      .map((addr) => ephemeralSignals.get(addr.toLowerCase()) ?? null)
      .filter((s): s is EphemeralKeySignal => s !== null && s.isEphemeralCandidate)
  }, [verdict?.state, uniqueRecoveredAddresses, ephemeralSignals])

  const parsedOwnerIndexSuggestion = useMemo(() => {
    if (!probeResult) return null
    if (probeResult.parsedOwnerIndex === null) return null
    if (probeResult.parsedOwnerIndex === targetOwnerIndex) return null
    return probeResult.parsedOwnerIndex
  }, [probeResult, targetOwnerIndex])
  // The probe page deliberately bypasses `resolveCdpPaymasterUrl` here.
  //
  // In production, that helper rewrites the URL to our same-origin proxy
  // (`https://app.4626.fun/api/paymaster`) to avoid embedding a CDP API key in
  // the bundle. That's correct for the in-app account-setup flow (where our
  // own backend forwards the request to CDP), but it BREAKS the Base App
  // `wallet_prepareCalls` lane: Base App forwards the `paymasterService.url`
  // capability directly to the bundler, which then POSTs to that URL
  // server-side and parses the response as JSON. When the bundler hits our
  // proxy and gets back HTML / a non-JSON-RPC payload, it errors with
  //   "invalid argument 0: invalid character 'x' after top-level value"
  // (observed in the probe's prepared-calls events log).
  //
  // The probe is a dev-only page — it's acceptable to expose the raw
  // CDP paymaster URL from `VITE_CDP_PAYMASTER_URL` here so the bundler
  // can fetch it directly. Production app paths continue to use the proxy.
  const paymasterUrlForPreparedCalls = useMemo(() => {
    const raw = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (!trimmed) return null
    // Only accept absolute URLs — if it's a relative path or unparsable, fall
    // back to the resolver (which would produce the proxy URL) so we never
    // ship a malformed string to the bundler.
    try {
      const parsed = new URL(trimmed)
      // Reject non-https URLs outright — the bundler will refuse plaintext
      // paymaster endpoints anyway, and rejecting here makes the intent of
      // the allowlist explicit.
      if (parsed.protocol !== 'https:') {
        return resolveCdpPaymasterUrl(trimmed) ?? null
      }
      // Allowlist Coinbase CDP / developer hostnames using strict subdomain
      // boundary checks. Naive `endsWith('coinbase.com')` would also match
      // hostile lookalikes like `evilcoinbase.com` — a mistyped or poisoned
      // `VITE_CDP_PAYMASTER_URL` would then ship a non-CDP URL (potentially
      // including the project key in the path) straight to the bundler.
      // Match either the bare host or any `*.<host>` subdomain.
      const hostname = parsed.hostname.toLowerCase()
      const isAllowedCoinbaseHost = (host: string): boolean => {
        const allowed = ['coinbase.com', 'cdp.coinbase.com', 'developer.coinbase.com']
        return allowed.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`))
      }
      if (isAllowedCoinbaseHost(hostname)) {
        return parsed.toString()
      }
      return resolveCdpPaymasterUrl(trimmed) ?? null
    } catch {
      return resolveCdpPaymasterUrl(trimmed) ?? null
    }
  }, [])

  const bundlerUserOpConfigError = useMemo(() => {
    const raw = String(import.meta.env.VITE_CDP_BUNDLER_URL ?? '').trim()
    if (!raw) {
      return 'Set VITE_CDP_BUNDLER_URL to a direct bundler RPC URL for this lane.'
    }
    if (raw === '/api/paymaster' || raw.endsWith('/api/paymaster')) {
      return 'VITE_CDP_BUNDLER_URL must not point to /api/paymaster (paymaster proxy). Use direct bundler RPC.'
    }
    return null
  }, [])

  const preferredConnector = useMemo(() => {
    const baseFirst =
      connectors.find((connector) => {
        const text = `${connector.id ?? ''} ${connector.name ?? ''}`.toLowerCase()
        return text.includes('coinbase') || text.includes('base')
      }) ?? null
    if (baseFirst) return baseFirst
    return selectPreferredWalletConnector(connectors)
  }, [connectors])

  async function connectWallet() {
    if (!preferredConnector) {
      setConnectState({
        kind: 'err',
        label: 'no wallet connector found',
        detail: 'No wagmi connector is available in this context.',
      })
      return
    }
    setConnectState({
      kind: 'pending',
      label: `opening ${preferredConnector.name ?? preferredConnector.id ?? 'wallet'}…`,
    })
    try {
      const result = await connectAsync({
        connector: preferredConnector,
        chainId: base.id,
      })
      const connected = result.accounts?.[0] ?? '—'
      setConnectState({
        kind: 'ok',
        label: `connected via ${preferredConnector.name ?? preferredConnector.id ?? 'wallet'}`,
        detail: `${connected} on chain ${result.chainId}`,
      })
    } catch (error) {
      setConnectState({
        kind: 'err',
        label: 'connect failed',
        detail: describeError(error),
      })
    }
  }

  async function disconnectWallet() {
    try {
      await disconnectAsync()
      setConnectState({ kind: 'ok', label: 'disconnected' })
    } catch (error) {
      setConnectState({
        kind: 'err',
        label: 'disconnect failed',
        detail: describeError(error),
      })
    }
  }

  async function loadOwnerSlots() {
    if (!publicClient) {
      setOwnerReadState({ kind: 'err', label: 'Base client unavailable', detail: 'Reload and retry.' })
      return
    }
    if (!normalizedCswAddress) {
      setOwnerReadState({ kind: 'err', label: 'Invalid CSW address' })
      return
    }

    setOwnerReadState({ kind: 'pending', label: 'reading owner slots…' })
    setProbeResult(null)
    setEphemeralSignals(new Map())
    try {
      const [ownerCountRaw, nextOwnerIndexRaw] = await Promise.all([
        publicClient.readContract({
          address: normalizedCswAddress,
          abi: CSW_OWNER_ABI,
          functionName: 'ownerCount',
        }),
        publicClient.readContract({
          address: normalizedCswAddress,
          abi: CSW_OWNER_ABI,
          functionName: 'nextOwnerIndex',
        }),
      ])
      const ownerCount = Number(ownerCountRaw)
      const nextOwnerIndex = Number(nextOwnerIndexRaw)
      const maxScan = Math.min(Math.max(nextOwnerIndex, ownerCount), 16)
      const slots: OwnerSlot[] = []
      for (let index = 0; index < maxScan; index += 1) {
        const ownerBytes = (await publicClient.readContract({
          address: normalizedCswAddress,
          abi: CSW_OWNER_ABI,
          functionName: 'ownerAtIndex',
          args: [BigInt(index)],
        })) as Hex
        slots.push(decodeOwnerSlot(index, ownerBytes))
      }
      setOwnerSlots(slots)
      setOwnerReadState({
        kind: 'ok',
        label: `loaded ownerCount=${ownerCount}, nextOwnerIndex=${nextOwnerIndex}`,
      })
    } catch (error) {
      setOwnerReadState({
        kind: 'err',
        label: 'failed to load owner slots',
        detail: describeError(error),
      })
    }
  }

  // Helper for the snapshot UI block + the per-probe walletSession capture.
  // Reads via the wagmi walletClient request fn (same surface the probe uses
  // to sign), so what we capture is exactly what the wallet about to be asked
  // to sign sees.
  async function refreshWalletSessionSnapshot(): Promise<WalletSessionSnapshot> {
    setWalletSessionState({ kind: 'pending', label: 'reading wallet session…' })
    const request = (walletClient as any)?.request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    const snapshot = await captureWalletSessionSnapshot({
      request: request ?? null,
      wagmiAddress: connectedAddress ?? null,
      cswAddress: normalizedCswAddress,
    })
    setWalletSession(snapshot)
    setWalletSessionState({
      kind: snapshot.warningState === 'green' ? 'ok' : snapshot.warningState === 'amber' ? 'err' : 'pending',
      label:
        snapshot.warningState === 'green'
          ? 'provider operating on CSW'
          : snapshot.warningState === 'amber'
            ? 'sub-account session detected'
            : 'snapshot incomplete',
      detail: snapshot.message,
    })
    return snapshot
  }

  async function runProbe(
    method: 'eth_sign' | 'personal_sign' | 'typed_data' | 'prepared_personal_sign',
  ) {
    if (!walletClient || !connectedAddress) {
      setSignState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!normalizedCswAddress) {
      setSignState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    if (!Number.isInteger(targetOwnerIndex) || targetOwnerIndex < 0) {
      setSignState({ kind: 'err', label: 'invalid owner index' })
      return
    }
    if (!publicClient) {
      setSignState({ kind: 'err', label: 'public client unavailable' })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<Hex>)
      | undefined
    if (!request && method !== 'typed_data') {
      setSignState({ kind: 'err', label: 'wallet client request() unavailable' })
      return
    }

    // The prepared-calls personal_sign lane requires self-auth (sender === CSW)
    // because we ask the popup to sign the hash with `sender = CSW`. That shape
    // is only accepted when the connected wallet is the CSW itself.
    if (method === 'prepared_personal_sign') {
      const isSelfAuthSession =
        connectedAddress.toLowerCase() === normalizedCswAddress.toLowerCase()
      if (!isSelfAuthSession) {
        setSignState({
          kind: 'err',
          label: 'connected wallet must be the CSW itself for the prepared-calls lane',
          detail:
            'This lane targets Base App\u2019s self-auth passkey signer. ' +
            `Connected: ${connectedAddress}. CSW: ${normalizedCswAddress}. ` +
            'Reconnect via Base App so the wagmi connector exposes the CSW.',
        })
        return
      }
    }

    // For the regular probe lanes we ASK the wallet to sign the raw challenge
    // hash. For the prepared-calls lane the hash we sign is the userOpHash that
    // wallet_prepareCalls returns — we resolve it below before signing.
    let signedHash: Hex = challengeHash
    let replaySafeHash: Hex = buildReplaySafeHash({
      smartWallet: normalizedCswAddress,
      userOpHash: challengeHash,
    })

    setSignState({ kind: 'pending', label: `awaiting ${method} signature…` })
    setProbeResult(null)
    setEphemeralSignals(new Map())
    // Capture the snapshot *before* the popup opens, so the JSON dump records
    // exactly what the provider believed the session was at sign time. Best
    // effort — failure here never blocks the probe.
    let walletSessionForProbe: WalletSessionSnapshot | null = null
    try {
      walletSessionForProbe = await refreshWalletSessionSnapshot()
    } catch {
      walletSessionForProbe = null
    }
    try {
      let signature: Hex
      if (method === 'eth_sign') {
        signature = await request!({
          method: 'eth_sign',
          params: [connectedAddress, signedHash],
        })
      } else if (method === 'personal_sign') {
        signature = await request!({
          method: 'personal_sign',
          params: [signedHash, connectedAddress],
        })
      } else if (method === 'prepared_personal_sign') {
        // Route through wallet_prepareCalls so Base App enters self-auth signing
        // mode and dispatches the popup to the CSW’s passkey owner (owner[0])
        // — instead of the sub-account/session key it falls back to for raw
        // personal_sign(hash, sender=CSW). The call we ask the wallet to bundle
        // is a no-op self-call (data='0x', value='0x0') so even if a user clicks
        // through far enough to send it, nothing happens on chain. This probe
        // does NOT call wallet_sendPreparedCalls; we sign-and-inspect only.
        const capabilities: Record<string, unknown> = {}
        if (paymasterUrlForPreparedCalls) {
          const paymasterUrlStr = String(paymasterUrlForPreparedCalls)
            .trim()
            .replace(
              'https://api.developer.coinbase.com/',
              'https://api.cdp.coinbase.com/',
            )
          capabilities.paymasterService = { url: paymasterUrlStr }
        }
        const chainIdHex = `0x${base.id.toString(16)}`
        const prepareResult = (await request!({
          method: 'wallet_prepareCalls',
          params: [
            {
              version: '1.0',
              from: normalizedCswAddress,
              chainId: chainIdHex,
              calls: [
                { to: normalizedCswAddress, data: '0x' as Hex, value: '0x0' },
              ],
              capabilities,
            },
          ],
        })) as {
          signatureRequest?: { hash?: string }
        } | null
        if (!prepareResult?.signatureRequest?.hash) {
          throw new Error('wallet_prepareCalls did not return a signature request hash.')
        }
        signedHash = unwrapDoubleHexEncodedHash(
          prepareResult.signatureRequest.hash as Hex,
        )
        replaySafeHash = buildReplaySafeHash({
          smartWallet: normalizedCswAddress,
          userOpHash: signedHash,
        })
        signature = await request!({
          method: 'personal_sign',
          params: [signedHash, connectedAddress],
        })
      } else {
        // For typed_data we sign the CoinbaseSmartWalletMessage envelope, which
        // is what offchain ERC-1271 verifiers expect. The popup will not double-wrap.
        const typedDataPayload = {
          domain: {
            name: 'Coinbase Smart Wallet',
            version: '1',
            chainId: base.id,
            verifyingContract: normalizedCswAddress,
          },
          types: {
            CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
          },
          primaryType: 'CoinbaseSmartWalletMessage',
          message: { hash: challengeHash },
        }
        if (typeof walletClient.signTypedData === 'function') {
          signature = await walletClient.signTypedData({
            account: connectedAddress,
            domain: typedDataPayload.domain,
            types: typedDataPayload.types,
            primaryType: 'CoinbaseSmartWalletMessage',
            message: typedDataPayload.message,
          })
        } else if (request) {
          signature = await request({
            method: 'eth_signTypedData_v4',
            params: [connectedAddress, JSON.stringify(typedDataPayload)],
          })
        } else {
          throw new Error('Wallet does not support typed-data signing')
        }
      }

      const parsedSignature = parseWalletSignature(signature)
      const recoverableSignature = parsedSignature.ecdsaSignature
      const signatureShape = detectSignatureShape(signature)
      const signatureByteLength = hexByteLength(signature)
      // Try recovery against multiple candidate hashes — useful as a diagnostic
      // for raw-ECDSA EOA signatures, but meaningless for WebAuthn/passkey wrappers.
      const recoveredDirect = recoverableSignature
        ? await recoverAddress({ hash: signedHash, signature: recoverableSignature }).catch(() => null)
        : null
      const prefixedHash = hashMessage({ raw: signedHash })
      const recoveredPrefixed = recoverableSignature
        ? await recoverAddress({ hash: prefixedHash, signature: recoverableSignature }).catch(() => null)
        : null
      // Extra diagnostic recoveries: some wallets/connectors apply replaySafeHash
      // before signing (esp. for EOA owners through the CSW connector). If the
      // wallet pre-wrapped the hash, recovery against `replaySafeHash` (or its
      // EIP-191 prefixed form) will land on the actual signer.
      const recoveredAgainstReplaySafe = recoverableSignature
        ? await recoverAddress({ hash: replaySafeHash, signature: recoverableSignature }).catch(() => null)
        : null
      const prefixedReplaySafeHash = hashMessage({ raw: replaySafeHash })
      const recoveredAgainstPrefixedReplaySafe = recoverableSignature
        ? await recoverAddress({ hash: prefixedReplaySafeHash, signature: recoverableSignature }).catch(() => null)
        : null
      // Authoritative on-chain replaySafeHash — read from the CSW itself so
      // domain parameter drift in our local builder can't hide bugs. If this
      // differs from the local one, the local builder is wrong. If it matches
      // and recovery still fails, the wallet is signing something else entirely.
      let onchainReplaySafeHash: Hex | null = null
      try {
        onchainReplaySafeHash = await publicClient.readContract({
          address: normalizedCswAddress,
          abi: CSW_OWNER_ABI,
          functionName: 'replaySafeHash',
          // For the prepared-calls lane signedHash is the userOpHash returned
          // by wallet_prepareCalls, not the on-page challengeHash. We must ask
          // the CSW for replaySafeHash(signedHash) so the recovery row below
          // and the webauthn challenge check both line up with the bytes the
          // wallet actually signed.
          args: [signedHash],
        }) as Hex
      } catch {
        // CSW may not expose replaySafeHash if it's a non-standard fork; ignore.
      }
      // Preserve unknown state if on-chain lookup failed (e.g. non-standard
      // CSW implementation or transient RPC error). null ≠ false here.
      const localReplaySafeMatchesOnchain: boolean | null =
        onchainReplaySafeHash === null
          ? null
          : onchainReplaySafeHash.toLowerCase() === replaySafeHash.toLowerCase()
      const recoveredAgainstOnchainReplaySafe =
        recoverableSignature && onchainReplaySafeHash
          ? await recoverAddress({ hash: onchainReplaySafeHash, signature: recoverableSignature }).catch(() => null)
          : null

      // Authoritative verification: ask the CSW itself via ERC-1271.
      // The signature we send must be the FULL wrapped signature returned by the
      // wallet (not just the inner ecdsa bytes). The hash argument is whichever
      // hash the wallet was actually asked to sign — challengeHash for the
      // direct lanes, or the userOpHash returned by wallet_prepareCalls for the
      // prepared-calls lane. The contract’s ERC-1271 implementation applies
      // replaySafeHash internally before verifying.
      let erc1271MagicValue: Hex | null = null
      let erc1271Verified = false
      try {
        const result = await publicClient.readContract({
          address: normalizedCswAddress,
          abi: ERC1271_ABI,
          functionName: 'isValidSignature',
          args: [signedHash, signature],
        }) as Hex
        erc1271MagicValue = result
        erc1271Verified = result.toLowerCase() === ERC1271_MAGIC_VALUE
      } catch {
        // CSW reverts on invalid sig (per Coinbase impl); keep verified=false.
      }

      const wrappedSignature = recoverableSignature
        ? encodeAbiParameters(
            [{ type: 'uint256' }, { type: 'bytes' }],
            [BigInt(targetOwnerIndex), recoverableSignature],
          )
        : null
      const targetOwnerLower = targetOwnerAddress?.toLowerCase() ?? null
      const directMatchesTarget = Boolean(
        recoveredDirect && targetOwnerLower && recoveredDirect.toLowerCase() === targetOwnerLower,
      )
      const prefixedMatchesTarget = Boolean(
        recoveredPrefixed && targetOwnerLower && recoveredPrefixed.toLowerCase() === targetOwnerLower,
      )
      const parsedOwnerAddress =
        parsedSignature.ownerIndex !== null
          ? ownerSlots.find((slot) => slot.index === parsedSignature.ownerIndex)?.ownerAddress ?? null
          : null
      const parsedOwnerIndexMatchesTarget =
        parsedSignature.ownerIndex !== null && parsedSignature.ownerIndex === targetOwnerIndex

      // Authoritative: read ownerAtIndex(parsedOwnerIndex) on-chain at probe
      // time so we always have the live snapshot, regardless of whether the
      // user clicked 'load owner slots' beforehand.
      let parsedOwnerRawBytesOnchain: Hex | null = null
      let parsedOwnerAddressOnchain: Address | null = null
      if (parsedSignature.ownerIndex !== null) {
        try {
          parsedOwnerRawBytesOnchain = (await publicClient.readContract({
            address: normalizedCswAddress,
            abi: CSW_OWNER_ABI,
            functionName: 'ownerAtIndex',
            args: [BigInt(parsedSignature.ownerIndex)],
          })) as Hex
          // Reuse decodeOwnerSlot so we get the same isAddress + zero-address
          // validation as the rest of this file. Sparse/deleted slots, passkey
          // payloads, and other non-address 32-byte values will correctly
          // surface ownerAddress=null instead of a synthetic 0x... value.
          if (parsedOwnerRawBytesOnchain) {
            parsedOwnerAddressOnchain = decodeOwnerSlot(
              parsedSignature.ownerIndex,
              parsedOwnerRawBytesOnchain,
            ).ownerAddress
          }
        } catch {
          // CSW may revert if the index is out of range; surface as null.
        }
      }

      // Build the webauthn-only challenge view: pull `challenge` from the
      // clientDataJSON, base64url-decode it, and compare to the hash we asked
      // the wallet to sign and the on-chain replaySafeHash. Either match is
      // expected; which one depends on whether the wallet wrapped the digest
      // before passing it to the authenticator.
      let webauthnChallenge: ProbeResult['webauthnChallenge'] = null
      if (signatureShape.kind === 'webauthn') {
        const rawChallenge = readWebauthnChallengeField(signatureShape.clientDataJSON)
        const decodedHex = rawChallenge ? base64UrlDecodeToHex(rawChallenge) : null
        const matchesSignedHash = Boolean(
          decodedHex && decodedHex.toLowerCase() === signedHash.toLowerCase(),
        )
        const matchesOnchainReplaySafeHash =
          onchainReplaySafeHash === null
            ? null
            : Boolean(
                decodedHex &&
                  decodedHex.toLowerCase() === onchainReplaySafeHash.toLowerCase(),
              )
        webauthnChallenge = {
          raw: rawChallenge ?? '',
          decodedHex,
          matchesSignedHash,
          matchesOnchainReplaySafeHash,
        }
      }

      setProbeResult({
        method,
        signature,
        parsedSignatureKind: parsedSignature.kind,
        parsedOwnerIndex: parsedSignature.ownerIndex,
        parsedOwnerAddress,
        parsedOwnerIndexMatchesTarget,
        parsedSignatureData: parsedSignature.signatureData,
        ecdsaSignatureForRecovery: recoverableSignature,
        signedHash,
        replaySafeHash,
        recoveredDirect,
        recoveredPrefixed,
        recoveredAgainstReplaySafe,
        recoveredAgainstPrefixedReplaySafe,
        onchainReplaySafeHash,
        localReplaySafeMatchesOnchain,
        recoveredAgainstOnchainReplaySafe,
        parsedOwnerAddressOnchain,
        parsedOwnerRawBytesOnchain,
        targetOwnerIndex,
        targetOwnerAddress,
        directMatchesTarget,
        prefixedMatchesTarget,
        erc1271MagicValue,
        erc1271Verified,
        wrappedSignature: wrappedSignature ?? ('0x' as Hex),
        signatureShape,
        signatureByteLength,
        webauthnChallenge,
        walletSession: walletSessionForProbe,
      })
      setSignState({
        kind: erc1271Verified ? 'ok' : 'err',
        label: `${method} signature ${erc1271Verified ? 'verified' : 'captured (NOT verified)'}`,
        detail: (() => {
          if (erc1271Verified) {
            if (signatureShape.kind === 'webauthn') {
              return 'CSW.isValidSignature returned the EIP-1271 magic value and the signature is a WebAuthnAuth tuple \u2014 owner[0] (passkey) signed via the popup.'
            }
            return 'CSW.isValidSignature returned the EIP-1271 magic value \u2014 the bundler will accept this signature shape.'
          }
          if (method === 'prepared_personal_sign' && signatureShape.kind !== 'webauthn') {
            return (
              'wallet_prepareCalls succeeded but the popup returned a non-WebAuthn signature \u2014 ' +
              'Base App is still routing to a sub-account/session key instead of the passkey owner. ' +
              'Disconnect, reconnect via Base App, and ensure the connected account IS the CSW.'
            )
          }
          if (parsedSignature.kind === 'raw-ecdsa' && (directMatchesTarget || prefixedMatchesTarget)) {
            return 'Raw ECDSA recovers to selected owner, but CSW.isValidSignature did not return the magic value. Wrap as SignatureWrapper(ownerIndex, r||s||v) and resubmit.'
          }
          if (parsedOwnerIndexMatchesTarget) {
            return `Wrapper owner index matches target (${targetOwnerIndex}) but onchain ERC-1271 check failed.`
          }
          return 'CSW.isValidSignature did not return the magic value. Inspect signedHash and the parsed wrapper below.'
        })(),
      })
    } catch (error) {
      setSignState({ kind: 'err', label: `${method} failed`, detail: describeError(error) })
    }
  }

  async function runPreparedCallsOwnerAdd() {
    const ownerToAddRaw = String(ownerToAddInput ?? '').trim()
    if (!walletClient || !connectedAddress) {
      setPreparedCallsState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!normalizedCswAddress) {
      setPreparedCallsState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    // Hard self-auth gate: this probe now runs only the self-built relay UserOp
    // lane with WebAuthn-owner enforcement. That requires the connected session
    // to be the CSW itself so the Base App passkey owner can sign.
    const isSelfAuthSession =
      connectedAddress.toLowerCase() === normalizedCswAddress.toLowerCase()
    if (!isSelfAuthSession) {
      setPreparedCallsState({
        kind: 'err',
        label: 'connected wallet must be the CSW itself (self-auth session)',
        detail:
          `This probe targets the Base-App passkey self-auth lane. Connected: ${connectedAddress}. CSW: ${normalizedCswAddress}. ` +
          'Reconnect via Base App so the wagmi connector exposes the CSW, or use the standard owner-install flow for EOA-owner sessions.',
      })
      return
    }
    if (!isAddress(ownerToAddRaw)) {
      setPreparedCallsState({ kind: 'err', label: 'invalid owner address to add' })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPreparedCallsState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot call wallet_prepareCalls/wallet_sendPreparedCalls.',
      })
      return
    }

    const ownerToAdd = getAddress(ownerToAddRaw)
    const data = encodeFunctionData({
      abi: CSW_OWNER_MUTATION_ABI,
      functionName: 'addOwnerAddress',
      args: [ownerToAdd],
    })

    setPreparedCallsTxHash(null)
    setPreparedCallEventLog([])
    setPreparedCallsState({
      kind: 'pending',
      label: 'submitting via Base prepared-calls owner add…',
    })
    try {
      const appendEvent = (row: string) => {
        setPreparedCallEventLog((prev) => [...prev, row].slice(-30))
      }
      const formatEventDetail = (detail: unknown): string => {
        if (detail == null) return ''
        if (typeof detail === 'string') return detail
        try {
          return JSON.stringify(detail)
        } catch {
          return String(detail)
        }
      }
      appendEvent(`session:${isSelfAuthSession ? 'self_auth' : 'external_signer'}`)
      appendEvent('lane:relay_two_part_depository_then_handleOps')
      appendEvent('step:sign replayable executeWithoutChainIdValidation UserOp')
      appendEvent('step:submit EntryPoint.handleOps through /api/relay/execute')
      const relayResult = await _submitOwnerViaSelfBuiltUserOp({
        walletRequest: async (args) => await request(args),
        chainId: base.id,
        csw: normalizedCswAddress,
        innerCallData: data,
        expectedOwnerAddress: ownerToAdd,
        requireWebAuthnOwnerSignature: true,
        sessionKind: 'self_auth',
        quoteRelayBeforeSubmit: true,
        onTelemetry: (event) => {
          appendEvent(formatEventDetail(event).slice(0, 2000))
        },
      })
      if (!relayResult.txHash) {
        throw new Error('Relay /execute did not return a transaction hash for the owner-add UserOp.')
      }
      const txHash = relayResult.txHash

      setPreparedCallsTxHash(txHash)
      setPreparedCallsState({
        kind: 'ok',
        label: 'Relay two-part owner add submitted',
        detail: txHash,
      })
    } catch (error) {
      setPreparedCallsState({
        kind: 'err',
        label: 'Relay two-part owner add failed',
        detail:
          /Relay \/execute \(400\): execution reverted|Relay \/execute proxy failed/i.test(describeError(error))
            ? 'Relay reached on-chain execution and reverted. The current wallet session is still returning an ECDSA owner[2] signature, not the WebAuthn owner[0] passkey signature required for this CSW self-auth add-owner path.'
            : describeError(error),
      })
    }
  }

  async function runWalletSendCallsOwnerAdd(options?: { usePaymaster?: boolean }) {
    const ownerToAddRaw = String(ownerToAddInput ?? '').trim()
    if (!walletClient || !connectedAddress) {
      setPreparedCallsState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!normalizedCswAddress) {
      setPreparedCallsState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    if (connectedAddress.toLowerCase() !== normalizedCswAddress.toLowerCase()) {
      setPreparedCallsState({
        kind: 'err',
        label: 'connected wallet must be the CSW itself (self-auth session)',
        detail: `Connected: ${connectedAddress}. CSW: ${normalizedCswAddress}.`,
      })
      return
    }
    if (!isAddress(ownerToAddRaw)) {
      setPreparedCallsState({ kind: 'err', label: 'invalid owner address to add' })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPreparedCallsState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot call wallet_sendCalls.',
      })
      return
    }

    const ownerToAdd = getAddress(ownerToAddRaw)
    const data = encodeFunctionData({
      abi: CSW_OWNER_MUTATION_ABI,
      functionName: 'addOwnerAddress',
      args: [ownerToAdd],
    })
    const usePaymaster = Boolean(options?.usePaymaster)
    const runId = `probe-sendcalls-${usePaymaster ? 'paymaster' : 'nopaymaster'}-${Date.now()}`
    const appendEvent = (row: string) => {
      setPreparedCallEventLog((prev) => [...prev, row].slice(-30))
    }
    const formatEventDetail = (detail: unknown): string => {
      if (detail == null) return ''
      if (typeof detail === 'string') return detail
      try {
        return JSON.stringify(detail)
      } catch {
        return String(detail)
      }
    }
    setPreparedCallsTxHash(null)
    setPreparedCallEventLog([])
    setPreparedCallsState({
      kind: 'pending',
      label: 'submitting via native wallet_sendCalls owner add…',
    })
    try {
      appendEvent('session:self_auth')
      appendEvent(`lane:wallet_sendCalls_native:${usePaymaster ? 'with_paymaster' : 'without_paymaster'}`)
      const txHash = await _submitOwnerViaWalletSendCalls({
        walletRequest: async (args) => await request(args),
        chainId: base.id,
        sender: normalizedCswAddress,
        to: normalizedCswAddress,
        data,
        paymasterUrl: usePaymaster ? paymasterUrlForPreparedCalls : null,
        approvalRunId: runId,
        executionMode: 'canonicalSmartWallet',
        signerAddress: connectedAddress,
        canonicalCswAddress: normalizedCswAddress,
        onStageEvent: (event) => {
          appendEvent(formatEventDetail(event).slice(0, 2000))
        },
      })
      setPreparedCallsTxHash(txHash)
      setPreparedCallsState({
        kind: 'ok',
        label: 'wallet_sendCalls owner add submitted',
        detail: txHash,
      })
    } catch (error) {
      setPreparedCallsState({
        kind: 'err',
        label: 'wallet_sendCalls owner add failed',
        detail: describeError(error),
      })
    }
  }

  async function runNormalPreparedCallsOwnerAddWithOwner2() {
    const ownerToAddRaw = String(ownerToAddInput ?? '').trim()
    if (!walletClient || !connectedAddress) {
      setPreparedCallsState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!normalizedCswAddress) {
      setPreparedCallsState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    if (connectedAddress.toLowerCase() !== normalizedCswAddress.toLowerCase()) {
      setPreparedCallsState({
        kind: 'err',
        label: 'connected wallet must be the CSW itself (self-auth session)',
        detail: `Connected: ${connectedAddress}. CSW: ${normalizedCswAddress}.`,
      })
      return
    }
    if (!isAddress(ownerToAddRaw)) {
      setPreparedCallsState({ kind: 'err', label: 'invalid owner address to add' })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPreparedCallsState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot call wallet_prepareCalls/wallet_sendPreparedCalls.',
      })
      return
    }
    const ownerToAdd = getAddress(ownerToAddRaw)
    const data = encodeFunctionData({
      abi: CSW_OWNER_MUTATION_ABI,
      functionName: 'addOwnerAddress',
      args: [ownerToAdd],
    })
    const runId = `probe-owner2-normal-${Date.now()}`
    const appendEvent = (row: string) => {
      setPreparedCallEventLog((prev) => [...prev, row].slice(-30))
    }
    const formatEventDetail = (detail: unknown): string => {
      if (detail == null) return ''
      if (typeof detail === 'string') return detail
      try {
        return JSON.stringify(detail)
      } catch {
        return String(detail)
      }
    }
    setPreparedCallsTxHash(null)
    setPreparedCallEventLog([])
    setPreparedCallsState({
      kind: 'pending',
      label: 'submitting owner[2] normal prepared-calls addOwnerAddress…',
    })
    try {
      appendEvent('session:self_auth')
      appendEvent('lane:normal_wallet_prepareCalls_owner2')
      const txHash = await _submitOwnerViaPreparedCallsAllowAnyOwner({
        walletRequest: async (args) => await request(args),
        chainId: base.id,
        sender: normalizedCswAddress,
        to: normalizedCswAddress,
        data,
        paymasterUrl: paymasterUrlForPreparedCalls,
        approvalRunId: runId,
        executionMode: 'canonicalSmartWallet',
        signerAddress: connectedAddress,
        canonicalCswAddress: normalizedCswAddress,
        onStageEvent: (event) => {
          appendEvent(formatEventDetail(event).slice(0, 2000))
        },
      })
      setPreparedCallsTxHash(txHash)
      setPreparedCallsState({
        kind: 'ok',
        label: 'owner[2] normal prepared-calls owner add submitted',
        detail: txHash,
      })
    } catch (error) {
      setPreparedCallsState({
        kind: 'err',
        label: 'owner[2] normal prepared-calls owner add failed',
        detail: describeError(error),
      })
    }
  }

  async function runRelayQuotedDepositForOwnerAdd() {
    const ownerToAddRaw = String(ownerToAddInput ?? '').trim()
    if (!walletClient || !connectedAddress) {
      setPreparedCallsState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!normalizedCswAddress) {
      setPreparedCallsState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    if (connectedAddress.toLowerCase() !== normalizedCswAddress.toLowerCase()) {
      setPreparedCallsState({
        kind: 'err',
        label: 'connected wallet must be the CSW itself',
        detail: `Connected: ${connectedAddress}. CSW: ${normalizedCswAddress}.`,
      })
      return
    }
    if (!isAddress(ownerToAddRaw)) {
      setPreparedCallsState({ kind: 'err', label: 'invalid owner address to add' })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPreparedCallsState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot submit the quoted Relay deposit transaction.',
      })
      return
    }
    const ownerToAdd = getAddress(ownerToAddRaw)
    const addOwnerData = encodeFunctionData({
      abi: CSW_OWNER_MUTATION_ABI,
      functionName: 'addOwnerAddress',
      args: [ownerToAdd],
    })
    const wrappedData = encodeExecuteWithoutChainIdValidation(addOwnerData)
    const appendEvent = (row: string) => {
      setPreparedCallEventLog((prev) => [...prev, row].slice(-30))
    }
    setPreparedCallsTxHash(null)
    setPreparedCallEventLog([])
    setPreparedCallsState({ kind: 'pending', label: 'fetching Relay quote deposit step…' })
    try {
      appendEvent('session:self_auth')
      appendEvent('lane:relay_quote_deposit_step_first')
      const quoteResponse = await fetch('/api/relay/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: base.id,
          user: normalizedCswAddress,
          to: normalizedCswAddress,
          data: wrappedData,
          value: '0',
          amount: '0',
        }),
      })
      const quoteJson = await quoteResponse.json().catch(() => null) as RelayQuoteEnvelope | null
      appendEvent(JSON.stringify({ step: 'relay_quote_response', ok: quoteResponse.ok, status: quoteResponse.status, data: quoteJson }).slice(0, 2000))
      if (!quoteResponse.ok || !quoteJson?.success || !quoteJson.data?.steps) {
        throw new Error(quoteJson?.error ?? `Relay quote failed (${quoteResponse.status})`)
      }
      const depositStep = quoteJson.data.steps.find((step) => step.id === 'deposit' && step.kind === 'transaction')
      const depositItem = depositStep?.items?.find((item) => item.data?.to && item.data?.data)
      const tx = depositItem?.data
      if (!tx?.to || !tx.data) {
        throw new Error('Relay quote did not return a deposit transaction item.')
      }
      appendEvent(JSON.stringify({
        step: 'relay_deposit_tx',
        requestId: depositStep?.requestId,
        to: tx.to,
        value: tx.value ?? '0',
        selector: tx.data.slice(0, 10),
      }))
      setPreparedCallsState({ kind: 'pending', label: 'submitting quoted Relay deposit step…' })
      const txHashRaw = await request({
        method: 'eth_sendTransaction',
        params: [{
          from: normalizedCswAddress,
          to: tx.to,
          data: tx.data,
          value: tx.value ?? '0x0',
        }],
      })
      if (!isTxHash(txHashRaw)) throw new Error('eth_sendTransaction did not return a transaction hash for Relay deposit.')
      setPreparedCallsTxHash(txHashRaw)
      setPreparedCallsState({
        kind: 'ok',
        label: 'quoted Relay deposit submitted',
        detail: txHashRaw,
      })
    } catch (error) {
      setPreparedCallsState({
        kind: 'err',
        label: 'quoted Relay deposit failed',
        detail: describeError(error),
      })
    }
  }

  async function runBundlerOwnerAddWithKnownEoaOwner() {
    const ownerToAddRaw = String(ownerToAddInput ?? '').trim()
    if (!walletClient || !connectedAddress) {
      setPreparedCallsState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!publicClient) {
      setPreparedCallsState({ kind: 'err', label: 'Base public client unavailable' })
      return
    }
    if (!normalizedCswAddress) {
      setPreparedCallsState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    if (!isAddress(ownerToAddRaw)) {
      setPreparedCallsState({ kind: 'err', label: 'invalid owner address to add' })
      return
    }
    if (connectedAddress.toLowerCase() !== KNOWN_EOA_OWNER_ADDRESS.toLowerCase()) {
      setPreparedCallsState({
        kind: 'err',
        label: 'connect the on-chain EOA owner[2]',
        detail:
          `Manual CSW self-auth paths keep returning owner[2], so this fallback must be signed by ` +
          `${KNOWN_EOA_OWNER_ADDRESS}. Connected: ${connectedAddress}.`,
      })
      return
    }
    if (bundlerUserOpConfigError) {
      setPreparedCallsState({
        kind: 'err',
        label: 'bundler userop lane misconfigured',
        detail: bundlerUserOpConfigError,
      })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPreparedCallsState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot sign a bundler UserOp.',
      })
      return
    }

    const ownerToAdd = getAddress(ownerToAddRaw)
    const data = encodeFunctionData({
      abi: CSW_OWNER_MUTATION_ABI,
      functionName: 'addOwnerAddress',
      args: [ownerToAdd],
    })
    const bundlerUrl = String(import.meta.env.VITE_CDP_BUNDLER_URL ?? '').trim()
    const runId = `probe-owner2-bundler-${Date.now()}`
    setPreparedCallsTxHash(null)
    setPreparedCallEventLog([])
    setPreparedCallsState({
      kind: 'pending',
      label: 'submitting addOwnerAddress via owner[2] bundler UserOp…',
    })
    emitProbeDebug({
      runId,
      hypothesisId: 'H6_direct_owner2_eoa_userop',
      location: 'frontend/src/pages/dev/CswSignatureProbe.tsx:runBundlerOwnerAddWithKnownEoaOwner:start',
      message: 'direct owner[2] bundler add-owner UserOp start',
      data: {
        csw: normalizedCswAddress,
        ownerToAdd,
        ownerIndex: KNOWN_EOA_OWNER_INDEX,
        ownerAddress: KNOWN_EOA_OWNER_ADDRESS,
        connectedAddress,
        hasPaymasterUrl: Boolean(paymasterUrlForPreparedCalls),
      },
    })
    try {
      const result = await sendCoinbaseSmartWalletUserOperation({
        publicClient: publicClient as any,
        walletClient: {
          request: async (args: any) => await request(args),
          signMessage: typeof (walletClient as any).signMessage === 'function'
            ? async (args: any) => await (walletClient as any).signMessage(args)
            : undefined,
          signTypedData: typeof (walletClient as any).signTypedData === 'function'
            ? async (args: any) => await (walletClient as any).signTypedData(args)
            : undefined,
        } as any,
        bundlerUrl,
        paymasterUrl: paymasterUrlForPreparedCalls ?? undefined,
        smartWallet: normalizedCswAddress,
        ownerAddress: KNOWN_EOA_OWNER_ADDRESS,
        calls: [{ to: normalizedCswAddress, value: 0n, data }],
        version: '1',
        ownerIsContract: false,
        userOpSignMode: 'auto',
        ownerIndexOverride: KNOWN_EOA_OWNER_INDEX,
        bypassOwnerIndexCache: true,
        retryOnInvalidSignature: false,
        ownerApprovalContext: {
          approvalRunId: runId,
          stage: 'add_owner_owner2_bundler',
          executionMode: 'canonicalSmartWallet',
        },
      })
      emitProbeDebug({
        runId,
        hypothesisId: 'H6_direct_owner2_eoa_userop',
        location: 'frontend/src/pages/dev/CswSignatureProbe.tsx:runBundlerOwnerAddWithKnownEoaOwner:success',
        message: 'direct owner[2] bundler add-owner UserOp succeeded',
        data: {
          userOpHash: result.userOpHash,
          transactionHash: result.transactionHash,
        },
      })
      setPreparedCallsTxHash(result.transactionHash)
      setPreparedCallsState({
        kind: 'ok',
        label: 'owner[2] bundler add-owner submitted',
        detail: result.transactionHash,
      })
    } catch (error) {
      emitProbeDebug({
        runId,
        hypothesisId: 'H6_direct_owner2_eoa_userop',
        location: 'frontend/src/pages/dev/CswSignatureProbe.tsx:runBundlerOwnerAddWithKnownEoaOwner:error',
        message: 'direct owner[2] bundler add-owner UserOp failed',
        data: {
          message: describeError(error),
        },
      })
      setPreparedCallsState({
        kind: 'err',
        label: 'owner[2] bundler add-owner failed',
        detail: describeError(error),
      })
    }
  }

  async function runDirectReplayableOwnerAdd() {
    const ownerToAddRaw = String(ownerToAddInput ?? '').trim()
    if (!walletClient || !connectedAddress) {
      setPreparedCallsState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!normalizedCswAddress) {
      setPreparedCallsState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    if (connectedAddress.toLowerCase() !== normalizedCswAddress.toLowerCase()) {
      setPreparedCallsState({
        kind: 'err',
        label: 'connected wallet must be the CSW itself (self-auth session)',
        detail: `Connected: ${connectedAddress}. CSW: ${normalizedCswAddress}.`,
      })
      return
    }
    if (!isAddress(ownerToAddRaw)) {
      setPreparedCallsState({ kind: 'err', label: 'invalid owner address to add' })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPreparedCallsState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot call eth_sendTransaction.',
      })
      return
    }

    const ownerToAdd = getAddress(ownerToAddRaw)
    const innerData = encodeFunctionData({
      abi: CSW_OWNER_MUTATION_ABI,
      functionName: 'addOwnerAddress',
      args: [ownerToAdd],
    })
    const wrappedData = encodeExecuteWithoutChainIdValidation(innerData)
    const runId = `probe-direct-replayable-${Date.now()}`
    const appendEvent = (row: string) => {
      setPreparedCallEventLog((prev) => [...prev, row].slice(-30))
    }
    setPreparedCallsTxHash(null)
    setPreparedCallEventLog([])
    setPreparedCallsState({
      kind: 'pending',
      label: 'submitting addOwnerAddress via direct replayable CSW self-call…',
    })
    appendEvent('session:self_auth')
    appendEvent('lane:eth_sendTransaction_executeWithoutChainIdValidation')
    emitProbeDebug({
      runId,
      hypothesisId: 'H7_direct_replayable_csw_selfcall',
      location: 'frontend/src/pages/dev/CswSignatureProbe.tsx:runDirectReplayableOwnerAdd:start',
      message: 'direct replayable CSW self-call start',
      data: {
        csw: normalizedCswAddress,
        ownerToAdd,
        innerSelector: innerData.slice(0, 10),
        wrappedSelector: wrappedData.slice(0, 10),
        connectedAddress,
      },
    })
    try {
      const txHashRaw = await request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: normalizedCswAddress,
            to: normalizedCswAddress,
            data: wrappedData,
            value: '0x0',
          },
        ],
      })
      if (!isTxHash(txHashRaw)) {
        throw new Error('eth_sendTransaction did not return a transaction hash for replayable CSW self-call.')
      }
      emitProbeDebug({
        runId,
        hypothesisId: 'H7_direct_replayable_csw_selfcall',
        location: 'frontend/src/pages/dev/CswSignatureProbe.tsx:runDirectReplayableOwnerAdd:success',
        message: 'direct replayable CSW self-call submitted',
        data: { txHash: txHashRaw },
      })
      setPreparedCallsTxHash(txHashRaw)
      setPreparedCallsState({
        kind: 'ok',
        label: 'direct replayable CSW self-call submitted',
        detail: txHashRaw,
      })
    } catch (error) {
      emitProbeDebug({
        runId,
        hypothesisId: 'H7_direct_replayable_csw_selfcall',
        location: 'frontend/src/pages/dev/CswSignatureProbe.tsx:runDirectReplayableOwnerAdd:error',
        message: 'direct replayable CSW self-call failed',
        data: { message: describeError(error) },
      })
      setPreparedCallsState({
        kind: 'err',
        label: 'direct replayable CSW self-call failed',
        detail: describeError(error),
      })
    }
  }

  async function runSelfBuiltOwnerRemove() {
    if (!walletClient || !connectedAddress) {
      setOwnerRemoveState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!normalizedCswAddress) {
      setOwnerRemoveState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    const isSelfAuthSession =
      connectedAddress.toLowerCase() === normalizedCswAddress.toLowerCase()
    if (!isSelfAuthSession) {
      setOwnerRemoveState({
        kind: 'err',
        label: 'connected wallet must be the CSW itself (self-auth session)',
        detail:
          `Connected: ${connectedAddress}. CSW: ${normalizedCswAddress}. ` +
          'Reconnect via Base App so the passkey owner signs this relay payload.',
      })
      return
    }
    const removeIndex = Number(ownerToRemoveIndexInput)
    if (!Number.isInteger(removeIndex) || removeIndex < 0) {
      setOwnerRemoveState({ kind: 'err', label: 'invalid owner index to remove' })
      return
    }
    const ownerSlot = ownerSlots.find((slot) => slot.index === removeIndex)
    if (!ownerSlot) {
      setOwnerRemoveState({
        kind: 'err',
        label: `owner slot ${removeIndex} is not loaded`,
        detail: 'Click "load owner slots" first, then retry the removal.',
      })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setOwnerRemoveState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot call the relay-backed self-built UserOp lane.',
      })
      return
    }

    setOwnerRemoveTxHash(null)
    setOwnerRemoveEventLog([])
    setOwnerRemovePreview(null)
    setOwnerRemoveState({
      kind: 'pending',
      label: `building remove-owner preview for index ${removeIndex}…`,
    })
    try {
      const appendEvent = (row: string) => {
        setOwnerRemoveEventLog((prev) => [...prev, row].slice(-20))
      }
      const previewResponse = await fetch('/api/onboarding/preview-remove-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cswAddress: normalizedCswAddress,
          connectedAddress,
          ownerIndex: removeIndex,
        }),
      })
      let previewJson: {
        success?: boolean
        error?: string
        data?: RemoveOwnerPreview
      } | null = null
      try {
        previewJson = await previewResponse.json()
      } catch {
        previewJson = null
      }
      if (!previewResponse.ok || !previewJson?.success || !previewJson.data) {
        throw new Error(previewJson?.error ?? `preview-remove-owner failed (${previewResponse.status})`)
      }
      const preview = previewJson.data
      setOwnerRemovePreview(preview)
      appendEvent(`target:index=${removeIndex}`)
      appendEvent(`target:function=${preview.preflight.selectedFunction}`)
      appendEvent(`target:ownerType=${ownerSlot.ownerType}`)
      appendEvent(`target:ownerAddress=${ownerSlot.ownerAddress ?? '—'}`)
      appendEvent(`preflight:simulation=${preview.preflight.simulation.ok ? 'ok' : 'reverted'}`)
      if (preview.preflight.simulation.error) {
        appendEvent(`preflight:error=${preview.preflight.simulation.error}`)
      }
      // Best-effort session refresh before sendCalls. Coinbase/Base App can
      // return stale "connecting" flows that time out when the WalletLink
      // session is old; wallet_connect + chain switch helps rehydrate context.
      try {
        await request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }],
        })
        appendEvent('session:chain_switched_base')
      } catch {
        appendEvent('session:chain_switch_skipped')
      }
      try {
        await request({
          method: 'wallet_connect',
          params: [{ version: '1' }],
        })
        appendEvent('session:wallet_connect_ok')
      } catch {
        appendEvent('session:wallet_connect_skipped')
      }
      appendEvent('lane:wallet_sendCalls_primary')
      const txHash = await _submitOwnerViaWalletSendCalls({
        walletRequest: async (args) => await request(args),
        chainId: base.id,
        sender: normalizedCswAddress,
        to: preview.txRequest.to,
        data: preview.txRequest.data,
        paymasterUrl: preparedCallsUsePaymaster ? paymasterUrlForPreparedCalls : null,
        approvalRunId: `probe-remove-${Date.now()}`,
        executionMode: 'canonicalSmartWallet',
        signerAddress: connectedAddress,
        canonicalCswAddress: normalizedCswAddress,
        onStageEvent: (event) => {
          const row = `${event.stage}:${event.status}${event.code ? `:${event.code}` : ''}${event.txHash ? `:${event.txHash}` : ''}`
          appendEvent(row)
        },
      })
      setOwnerRemoveTxHash(txHash)
      setOwnerRemoveState({
        kind: 'ok',
        label: `${preview.preflight.selectedFunction}(${removeIndex}) submitted via wallet_sendCalls`,
        detail: txHash,
      })
      return
    } catch (error) {
      const message = describeError(error)
      const lower = message.toLowerCase()
      if (lower.includes('user rejected') || lower.includes('request rejected')) {
        setOwnerRemoveState({
          kind: 'err',
          label: 'owner remove canceled in wallet popup',
          detail: `${message}. Re-run and approve the remove-owner request in Coinbase/Base App.`,
        })
        return
      }
      setOwnerRemoveState({
        kind: 'err',
        label: 'owner remove failed',
        detail: message,
      })
    }
  }

  async function runOwnerRemoveViaBundlerUserOp() {
    if (!walletClient || !connectedAddress) {
      setOwnerRemoveUserOpState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!normalizedCswAddress) {
      setOwnerRemoveUserOpState({ kind: 'err', label: 'invalid CSW address' })
      return
    }
    if (!publicClient) {
      setOwnerRemoveUserOpState({ kind: 'err', label: 'public client unavailable' })
      return
    }
    const removeIndex = Number(ownerToRemoveIndexInput)
    if (!Number.isInteger(removeIndex) || removeIndex < 0) {
      setOwnerRemoveUserOpState({ kind: 'err', label: 'invalid owner index to remove' })
      return
    }
    const targetOwnerSlot = ownerSlots.find((slot) => slot.index === removeIndex)
    const isSelfAuthSession =
      connectedAddress.toLowerCase() === normalizedCswAddress.toLowerCase()
    const resolvePasskeySignerIndexOnchain = async (): Promise<number | null> => {
      if (!publicClient) return null
      try {
        const ownerCountRaw = await publicClient.readContract({
          address: normalizedCswAddress,
          abi: CSW_OWNER_ABI,
          functionName: 'ownerCount',
        })
        const ownerCount = Number(ownerCountRaw)
        if (!Number.isFinite(ownerCount) || ownerCount <= 0) return null
        const maxScan = Math.min(ownerCount, 32)
        for (let index = 0; index < maxScan; index += 1) {
          try {
            const ownerBytes = await publicClient.readContract({
              address: normalizedCswAddress,
              abi: CSW_OWNER_ABI,
              functionName: 'ownerAtIndex',
              args: [BigInt(index)],
            })
            const ownerBytesLength = (String(ownerBytes).length - 2) / 2
            if (ownerBytesLength === 64) return index
          } catch {
            continue
          }
        }
        return null
      } catch {
        return null
      }
    }

    let signerOwnerIndex = removeIndex
    let signerOwnerAddress = connectedAddress as Address
    let signerOwnerIsContract = true

    if (isSelfAuthSession) {
      const passkeySignerIndex = await resolvePasskeySignerIndexOnchain()
      if (passkeySignerIndex === null) {
        setOwnerRemoveUserOpState({
          kind: 'err',
          label: 'passkey signer slot missing',
          detail:
            'Self-auth UserOp remove requires an onchain passkey owner slot (typically index 0). ' +
            'No passkey owner was discovered on this CSW.',
        })
        return
      }
      signerOwnerIndex = passkeySignerIndex
      signerOwnerAddress = normalizedCswAddress
      signerOwnerIsContract = true
    } else if (
      targetOwnerSlot?.ownerType === 'eoa' &&
      targetOwnerSlot.ownerAddress &&
      targetOwnerSlot.ownerAddress.toLowerCase() === connectedAddress.toLowerCase()
    ) {
      signerOwnerIndex = removeIndex
      signerOwnerAddress = targetOwnerSlot.ownerAddress
      signerOwnerIsContract = false
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setOwnerRemoveUserOpState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot submit AA UserOps.',
      })
      return
    }
    if (bundlerUserOpConfigError) {
      setOwnerRemoveUserOpState({
        kind: 'err',
        label: 'bundler userop lane misconfigured',
        detail: bundlerUserOpConfigError,
      })
      return
    }

    setOwnerRemoveUserOpTxHash(null)
    setOwnerRemoveUserOpState({
      kind: 'pending',
      label: `building remove preview for UserOp index ${removeIndex}…`,
    })
    try {
      const previewResponse = await fetch('/api/onboarding/preview-remove-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cswAddress: normalizedCswAddress,
          connectedAddress,
          ownerIndex: removeIndex,
        }),
      })
      let previewJson: {
        success?: boolean
        error?: string
        data?: RemoveOwnerPreview
      } | null = null
      try {
        previewJson = await previewResponse.json()
      } catch {
        previewJson = null
      }
      if (!previewResponse.ok || !previewJson?.success || !previewJson.data) {
        throw new Error(previewJson?.error ?? `preview-remove-owner failed (${previewResponse.status})`)
      }
      const preview = previewJson.data
      setOwnerRemovePreview(preview)
      setOwnerRemoveUserOpState({
        kind: 'pending',
        label:
          `submitting ${preview.preflight.selectedFunction} via bundler UserOp ` +
          `(target=${removeIndex}, signer=${signerOwnerIndex})…`,
      })

      const bundlerUrlCandidateRaw = String(import.meta.env.VITE_CDP_BUNDLER_URL ?? '').trim()

      const result = await sendCoinbaseSmartWalletUserOperation({
        publicClient: publicClient as any,
        walletClient: {
          request: async (args: any) => await request(args),
          signMessage: typeof (walletClient as any).signMessage === 'function'
            ? async (args: any) => await (walletClient as any).signMessage(args)
            : undefined,
          signTypedData: typeof (walletClient as any).signTypedData === 'function'
            ? async (args: any) => await (walletClient as any).signTypedData(args)
            : undefined,
        } as any,
        bundlerUrl: bundlerUrlCandidateRaw,
        paymasterUrl: undefined,
        smartWallet: normalizedCswAddress,
        ownerAddress: signerOwnerAddress,
        calls: [
          {
            to: preview.txRequest.to as Address,
            value: BigInt(preview.txRequest.value),
            data: preview.txRequest.data as Hex,
          },
        ],
        version: '1',
        ownerIsContract: signerOwnerIsContract,
        userOpSignMode: 'auto',
        skipPaymaster: true,
        // Keep signer slot deterministic: target owner index != signer owner index.
        ownerIndexOverride: signerOwnerIndex,
        bypassOwnerIndexCache: true,
        retryOnInvalidSignature: false,
      })
      setOwnerRemoveUserOpTxHash(result.transactionHash)
      setOwnerRemoveUserOpState({
        kind: 'ok',
        label: `UserOp submitted (${preview.preflight.selectedFunction})`,
        detail: result.transactionHash,
      })
    } catch (error) {
      const message = describeError(error)
      const lower = message.toLowerCase()
      if (lower.includes('user rejected') || lower.includes('request rejected')) {
        setOwnerRemoveUserOpState({
          kind: 'err',
          label: 'owner remove UserOp canceled in wallet popup',
          detail: `${message}. Re-run and approve the UserOp signature request in Coinbase/Base App.`,
        })
        return
      }
      setOwnerRemoveUserOpState({
        kind: 'err',
        label: 'owner remove UserOp failed',
        detail: message,
      })
    }
  }

  async function loadCreate2AuthorizationStatus() {
    if (!publicClient) {
      setCreate2ReadState({ kind: 'err', label: 'Base client unavailable', detail: 'Reload and retry.' })
      return
    }
    if (!isAddress(create2DeployerInput)) {
      setCreate2ReadState({ kind: 'err', label: 'invalid create2 deployer address' })
      return
    }
    if (!isAddress(authorizedDeployerInput)) {
      setCreate2ReadState({ kind: 'err', label: 'invalid deployer-to-authorize address' })
      return
    }
    const create2 = getAddress(create2DeployerInput)
    const candidate = getAddress(authorizedDeployerInput)
    setCreate2ReadState({ kind: 'pending', label: 'reading create2 authorization state…' })
    try {
      const [ownerRead, authorizedRead] = await Promise.all([
        publicClient.readContract({
          address: create2,
          abi: CREATE2_DEPLOYER_AUTH_ABI,
          functionName: 'owner',
        }),
        publicClient.readContract({
          address: create2,
          abi: CREATE2_DEPLOYER_AUTH_ABI,
          functionName: 'authorizedDeployers',
          args: [candidate],
        }),
      ])
      setCreate2OwnerAddress(String(ownerRead))
      setCreate2IsAuthorized(Boolean(authorizedRead))
      setCreate2ReadState({
        kind: 'ok',
        label: `owner loaded; candidate authorization is ${Boolean(authorizedRead) ? 'enabled' : 'disabled'}`,
      })
    } catch (error) {
      setCreate2ReadState({
        kind: 'err',
        label: 'failed to read create2 authorization state',
        detail: describeError(error),
      })
    }
  }

  async function authorizeCreate2Deployer() {
    if (!walletClient || !connectedAddress) {
      setCreate2WriteState({ kind: 'err', label: 'connect wallet first' })
      return
    }
    if (!publicClient) {
      setCreate2WriteState({ kind: 'err', label: 'Base client unavailable' })
      return
    }
    if (!isAddress(create2DeployerInput)) {
      setCreate2WriteState({ kind: 'err', label: 'invalid create2 deployer address' })
      return
    }
    if (!isAddress(authorizedDeployerInput)) {
      setCreate2WriteState({ kind: 'err', label: 'invalid deployer-to-authorize address' })
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setCreate2WriteState({
        kind: 'err',
        label: 'wallet request() unavailable',
        detail: 'This wallet client cannot call eth_sendTransaction.',
      })
      return
    }
    const create2 = getAddress(create2DeployerInput)
    const candidate = getAddress(authorizedDeployerInput)
    const ownerRead = await publicClient.readContract({
      address: create2,
      abi: CREATE2_DEPLOYER_AUTH_ABI,
      functionName: 'owner',
    })
    const ownerAddress = getAddress(String(ownerRead))
    setCreate2OwnerAddress(ownerAddress)
    if (connectedAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      setCreate2WriteState({
        kind: 'err',
        label: 'wrong signer connected',
        detail: `Connect owner ${ownerAddress} to call setAuthorizedDeployer.`,
      })
      return
    }

    const data = encodeFunctionData({
      abi: CREATE2_DEPLOYER_AUTH_ABI,
      functionName: 'setAuthorizedDeployer',
      args: [candidate, true],
    })

    setCreate2TxHash(null)
    setCreate2WriteState({ kind: 'pending', label: 'awaiting setAuthorizedDeployer signature…' })
    try {
      const hashRaw = await request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: connectedAddress,
            to: create2,
            data,
            value: '0x0',
          },
        ],
      })
      if (!isTxHash(hashRaw)) {
        throw new Error('eth_sendTransaction did not return a transaction hash')
      }
      setCreate2TxHash(hashRaw)
      setCreate2WriteState({
        kind: 'ok',
        label: 'setAuthorizedDeployer transaction submitted',
        detail: hashRaw,
      })
      setCreate2ReadState({ kind: 'pending', label: 'refreshing create2 authorization state…' })
      await loadCreate2AuthorizationStatus()
    } catch (error) {
      setCreate2WriteState({
        kind: 'err',
        label: 'setAuthorizedDeployer failed',
        detail: describeError(error),
      })
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 text-sm">
      <header className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">4626 · dev probe</div>
        <h1 className="text-2xl font-medium">CSW owner signature probe</h1>
        <p className="text-zinc-400">
          Loads CSW owner slots and probes Base App signatures against the CSW.
          IMPORTANT: the CSW has TWO verification paths with DIFFERENT hash semantics.
          (1) The bundler / validateUserOp path verifies the signature against the raw
          userOpHash directly (no replaySafeHash wrap) — see CoinbaseSmartWallet.sol
          line 191. (2) The off-chain ERC-1271 isValidSignature(hash, sig) path wraps
          with replaySafeHash before verifying — see ERC1271.sol line 70. These two
          paths cannot be satisfied by the same signature. This probe signs the raw
          challenge hash and then calls isValidSignature(challengeHash, sig) on-chain
          for an ERC-1271 check; recovery rows recover the inner ECDSA against several
          candidate hashes (raw, EIP-191, local replaySafeHash, on-chain replaySafeHash)
          to localize where the wallet diverges from expectation. erc1271Verified=true
          means the off-chain ERC-1271 path accepts this shape; it does NOT directly
          imply the bundler will accept it (those are different paths). This probe
          does not send transactions.
        </p>
        <p className="text-zinc-400">
          For owners that are passkeys (e.g. owner[0] on a Coinbase Smart Wallet),
          a raw personal_sign(hash, sender=CSW) request is silently routed by
          Base App to a sub-account/session key — the popup never wakes the
          passkey signer for an arbitrary off-chain hash. Use
          <span className="font-mono text-emerald-300"> probe prepared-calls personal_sign </span>
          to route the request through wallet_prepareCalls first; that puts the
          popup into self-auth signing mode and dispatches the passkey owner.
          The probe inspects the resulting signature shape (expect WebAuthnAuth)
          and verifies it via on-chain isValidSignature without sending a tx.
        </p>
      </header>

      {!selfAuthSession ? (
      <section className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-4">
        <div className="space-y-2 rounded border border-zinc-800 bg-black/40 p-3">
          <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">Base App wallet</div>
          <div className="text-xs text-zinc-500">
            Use this first when testing inside Base App. It prefers the Coinbase/Base connector.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500 disabled:opacity-50"
              onClick={connectWallet}
              disabled={isConnectPending}
            >
              {isConnectPending ? 'connecting…' : 'connect wallet'}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
              onClick={disconnectWallet}
            >
              disconnect
            </button>
          </div>
          <StatusRow title="wallet connect" state={connectState} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">CSW address</div>
            <input
              className="w-full rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-xs text-zinc-100"
              value={cswInput}
              onChange={(event) => setCswInput(event.target.value)}
              spellCheck={false}
            />
          </label>
          <label className="space-y-1">
            <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">Target owner index</div>
            <input
              className="w-full rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-xs text-zinc-100"
              type="number"
              min={0}
              value={targetOwnerIndex}
              onChange={(event) => setTargetOwnerIndex(Number(event.target.value))}
            />
            {parsedOwnerIndexSuggestion !== null ? (
              <button
                type="button"
                className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 hover:border-amber-400/60"
                onClick={() => setTargetOwnerIndex(parsedOwnerIndexSuggestion)}
              >
                use parsed owner index ({parsedOwnerIndexSuggestion})
              </button>
            ) : null}
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">Test userOpHash</div>
            <input
              className="w-full rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-xs text-zinc-100"
              value={challengeHash}
              onChange={(event) => setChallengeHash(event.target.value as Hex)}
              spellCheck={false}
            />
          </label>
          <div className="space-y-1">
            <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">Connected wallet</div>
            <div className="rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-xs text-zinc-100">
              {connectedAddress ?? 'not connected'} · chain {chainId ?? '—'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={() => setChallengeHash(makeChallengeHash())}
          >
            regenerate test hash
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={loadOwnerSlots}
          >
            load owner slots
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={() => runProbe('eth_sign')}
          >
            probe eth_sign
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={() => runProbe('personal_sign')}
          >
            probe personal_sign
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={() => runProbe('typed_data')}
          >
            probe typed data
          </button>
          <button
            type="button"
            className="rounded border border-emerald-500/60 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-400"
            onClick={() => runProbe('prepared_personal_sign')}
            title="Routes through wallet_prepareCalls so Base App signs with the CSW\u2019s passkey owner instead of a sub-account session key. No transaction is sent."
          >
            probe prepared-calls personal_sign (passkey)
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={() => { void refreshWalletSessionSnapshot() }}
          >
            snapshot wallet session
          </button>
        </div>
      </section>
      ) : (
      <section className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">
          Owner remove controls hidden (self-auth mode)
        </div>
        <div className="text-xs text-zinc-500">
          Remove and bundler controls are hidden during self-auth sessions so this page
          stays focused on add-owner via the relay lane.
        </div>
      </section>
      )}

      {walletSession ? (
        <section
          className={`space-y-2 rounded border p-4 ${
            walletSession.warningState === 'green'
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : walletSession.warningState === 'amber'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-yellow-500/40 bg-yellow-500/10'
          }`}
        >
          <div
            className={`font-mono text-[11px] uppercase tracking-wide ${
              walletSession.warningState === 'green'
                ? 'text-emerald-300'
                : walletSession.warningState === 'amber'
                  ? 'text-amber-200'
                  : 'text-yellow-200'
            }`}
          >
            wallet session snapshot
          </div>
          <div
            className={`font-mono text-sm ${
              walletSession.warningState === 'green'
                ? 'text-emerald-100'
                : walletSession.warningState === 'amber'
                  ? 'text-amber-100'
                  : 'text-yellow-100'
            }`}
          >
            {walletSession.message}
          </div>
          <div className="grid gap-1 md:grid-cols-2">
            <KeyValue label="eth_accounts[0]" value={walletSession.ethAccountsAddress ?? '— (read failed)'} />
            <KeyValue label="useAccount().address (wagmi)" value={walletSession.wagmiAddress ?? '— (not connected)'} />
            <KeyValue label="eth_chainId" value={walletSession.ethChainIdHex ?? '— (read failed)'} />
            <KeyValue label="cswAddress (configured)" value={walletSession.cswAddress ?? '—'} />
          </div>
          {walletSession.walletCapabilities ? (
            <KeyValue
              label="wallet_getCapabilities"
              value={JSON.stringify(walletSession.walletCapabilities, null, 2)}
            />
          ) : null}
          <StatusRow title="snapshot status" state={walletSessionState} />
        </section>
      ) : null}

      <section className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">
          Create2 deployer authorization
        </div>
        <div className="text-xs text-zinc-500">
          Sends setAuthorizedDeployer(candidate, true). Must be signed by the create2 deployer owner.
        </div>
        <label className="space-y-1">
          <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">Create2 deployer</div>
          <input
            className="w-full rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-xs text-zinc-100"
            value={create2DeployerInput}
            onChange={(event) => setCreate2DeployerInput(event.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="space-y-1">
          <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">Deployer to authorize</div>
          <input
            className="w-full rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-xs text-zinc-100"
            value={authorizedDeployerInput}
            onChange={(event) => setAuthorizedDeployerInput(event.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={loadCreate2AuthorizationStatus}
          >
            load auth status
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={authorizeCreate2Deployer}
          >
            authorize via setAuthorizedDeployer
          </button>
        </div>
        <StatusRow title="create2 auth read" state={create2ReadState} />
        <StatusRow title="create2 auth write" state={create2WriteState} />
        {create2OwnerAddress ? <KeyValue label="create2Owner" value={create2OwnerAddress} /> : null}
        {create2IsAuthorized !== null ? <KeyValue label="isAuthorized(candidate)" value={String(create2IsAuthorized)} /> : null}
        {create2TxHash ? <KeyValue label="create2AuthorizeTxHash" value={create2TxHash} /> : null}
      </section>

      <section className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">
          Self-call owner add (Base App prepared calls)
        </div>
        <div className="text-xs text-zinc-500">
          Preferred path: ask Base App to submit the CSW self-call through
          <span className="font-mono text-zinc-300"> wallet_sendCalls </span>
          with paymaster sponsorship. This keeps the passkey signature inside the
          wallet's prepared-call flow instead of asking the CSW to sign a raw hash.
        </div>
        <label className="space-y-1">
          <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">Owner address to add</div>
          <input
            className="w-full rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-xs text-zinc-100"
            value={ownerToAddInput}
            onChange={(event) => setOwnerToAddInput(event.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="rounded border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-100">
          Use the sponsored prepared-call button first. The old two-part Relay lane
          directly calls <span className="font-mono">personal_sign(hash, CSW)</span>;
          Base App can surface that as "Error generating message / enough funds"
          because it is outside the wallet's sponsored prepared-call flow.
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-sky-500/60 px-3 py-1.5 text-xs text-sky-200 hover:border-sky-400 disabled:opacity-50"
            onClick={() => { void runWalletSendCallsOwnerAdd({ usePaymaster: true }) }}
            disabled={!paymasterUrlForPreparedCalls}
            title={paymasterUrlForPreparedCalls ?? 'VITE_CDP_PAYMASTER_URL is not configured'}
          >
            run sponsored add owner via wallet_sendCalls
          </button>
          <button
            type="button"
            className="rounded border border-emerald-500/60 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-400"
            onClick={() => { void runWalletSendCallsOwnerAdd({ usePaymaster: false }) }}
          >
            run add owner via native wallet_sendCalls (no paymaster)
          </button>
          <button
            type="button"
            className="rounded border border-orange-500/60 px-3 py-1.5 text-xs text-orange-200 hover:border-orange-400 disabled:opacity-50"
            onClick={runNormalPreparedCallsOwnerAddWithOwner2}
            disabled={!paymasterUrlForPreparedCalls}
            title={paymasterUrlForPreparedCalls ?? 'VITE_CDP_PAYMASTER_URL is not configured'}
          >
            run add owner via owner[2] normal prepared calls
          </button>
          <button
            type="button"
            className="rounded border border-purple-500/60 px-3 py-1.5 text-xs text-purple-200 hover:border-purple-400"
            onClick={runRelayQuotedDepositForOwnerAdd}
          >
            fetch Relay quote and submit deposit step
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 opacity-60"
            onClick={runPreparedCallsOwnerAdd}
            disabled
            title="Disabled: this legacy Relay lane uses raw personal_sign(hash, CSW), which Base App can reject as an unfunded signature request. Use sponsored wallet_sendCalls instead."
          >
            legacy Relay two-part owner add (raw sign disabled)
          </button>
          <button
            type="button"
            className="rounded border border-amber-500/60 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-400 disabled:opacity-50"
            onClick={runBundlerOwnerAddWithKnownEoaOwner}
            disabled={Boolean(bundlerUserOpConfigError)}
            title={bundlerUserOpConfigError ?? `Requires connected owner[2] ${KNOWN_EOA_OWNER_ADDRESS}.`}
          >
            run add owner via owner[2] bundler UserOp
          </button>
          <button
            type="button"
            className="rounded border border-blue-500/60 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-400"
            onClick={runDirectReplayableOwnerAdd}
            title="CSW self-auth lane: eth_sendTransaction from CSW to CSW with executeWithoutChainIdValidation(addOwnerAddress)."
          >
            run add owner via direct replayable CSW self-call
          </button>
        </div>
        <div className="text-[11px] text-zinc-500">
          owner[2] fallback requires connected signer{' '}
          <span className="font-mono text-zinc-300">{KNOWN_EOA_OWNER_ADDRESS}</span>.
        </div>
        <StatusRow title="prepared add-owner lane" state={preparedCallsState} />
        {preparedCallsTxHash ? <KeyValue label="preparedCallsTxHash" value={preparedCallsTxHash} /> : null}
        {preparedCallEventLog.length ? (
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">prepared add-owner events</div>
            <div className="whitespace-pre-wrap break-all rounded border border-zinc-800 bg-black/50 px-2 py-1 font-mono text-[11px] text-zinc-300">
              {preparedCallEventLog.join('\n')}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">
          Self-call owner remove (preview + sendCalls)
        </div>
        <div className="text-xs text-zinc-500">
          Dev-only helper that first calls `/api/onboarding/preview-remove-owner`, then submits the returned remove transaction through `wallet_sendCalls`.
        </div>
        <label className="space-y-1">
          <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">Owner index to remove</div>
          <input
            className="w-full rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-xs text-zinc-100"
            type="number"
            min={0}
            value={ownerToRemoveIndexInput}
            onChange={(event) => setOwnerToRemoveIndexInput(event.target.value)}
          />
        </label>
        <div className="text-[11px] text-zinc-500">
          selected owner slot:{' '}
          <span className="font-mono text-zinc-300">
            {(() => {
              const parsedIndex = Number(ownerToRemoveIndexInput)
              if (!Number.isInteger(parsedIndex) || parsedIndex < 0) return 'invalid index'
              const slot = ownerSlots.find((item) => item.index === parsedIndex)
              if (!slot) return 'not loaded (click "load owner slots")'
              return `index=${slot.index} type=${slot.ownerType} address=${slot.ownerAddress ?? '—'} bytesLen=${slot.ownerBytesLength}`
            })()}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-rose-500/60 px-3 py-1.5 text-xs text-rose-200 hover:border-rose-400"
            onClick={runSelfBuiltOwnerRemove}
          >
            run remove via wallet_sendCalls
          </button>
          <button
            type="button"
            className="rounded border border-sky-500/60 px-3 py-1.5 text-xs text-sky-200 hover:border-sky-400"
            onClick={runOwnerRemoveViaBundlerUserOp}
            disabled={Boolean(bundlerUserOpConfigError)}
            title={bundlerUserOpConfigError ?? 'Submit remove through direct bundler UserOp lane (self-funded).'}
          >
            run remove via bundler userop
          </button>
        </div>
        {bundlerUserOpConfigError ? (
          <div className="text-[11px] text-amber-300">{bundlerUserOpConfigError}</div>
        ) : null}
        <StatusRow title="owner remove lane" state={ownerRemoveState} />
        {ownerRemoveTxHash ? <KeyValue label="ownerRemoveTxHash" value={ownerRemoveTxHash} /> : null}
        <StatusRow title="owner remove userop lane" state={ownerRemoveUserOpState} />
        {ownerRemoveUserOpTxHash ? <KeyValue label="ownerRemoveUserOpTxHash" value={ownerRemoveUserOpTxHash} /> : null}
        {ownerRemovePreview ? (
          <div className="space-y-1 rounded border border-zinc-800 bg-black/40 p-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">remove preflight</div>
            <KeyValue label="selectedFunction" value={ownerRemovePreview.preflight.selectedFunction} />
            <KeyValue label="selectedBy" value={ownerRemovePreview.preflight.selectedBy ?? 'heuristic'} />
            <KeyValue
              label="simulation"
              value={
                ownerRemovePreview.preflight.simulation.ok
                  ? 'ok'
                  : `reverted: ${ownerRemovePreview.preflight.simulation.error ?? 'unknown'}`
              }
            />
            {ownerRemovePreview.preflight.simulation.removeOwnerAtIndex ? (
              <KeyValue
                label="simulation.removeOwnerAtIndex"
                value={
                  ownerRemovePreview.preflight.simulation.removeOwnerAtIndex.ok
                    ? 'ok'
                    : `reverted: ${ownerRemovePreview.preflight.simulation.removeOwnerAtIndex.error ?? 'unknown'}`
                }
              />
            ) : null}
            {ownerRemovePreview.preflight.simulation.removeLastOwner ? (
              <KeyValue
                label="simulation.removeLastOwner"
                value={
                  ownerRemovePreview.preflight.simulation.removeLastOwner.ok
                    ? 'ok'
                    : `reverted: ${ownerRemovePreview.preflight.simulation.removeLastOwner.error ?? 'unknown'}`
                }
              />
            ) : null}
            <KeyValue
              label="highestPopulatedOwnerIndex"
              value={String(ownerRemovePreview.preflight.highestPopulatedOwnerIndex)}
            />
          </div>
        ) : null}
        {ownerRemoveEventLog.length ? (
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">owner remove events</div>
            <div className="rounded border border-zinc-800 bg-black/50 px-2 py-1 font-mono text-[11px] text-zinc-300">
              {ownerRemoveEventLog.join('\n')}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-4">
        <StatusRow title="owner read" state={ownerReadState} />
        <StatusRow title="signature probe" state={signState} />
      </section>

      <section className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">owner slots</div>
        {ownerSlots.length === 0 ? (
          <div className="font-mono text-xs text-zinc-500">no owner slots loaded</div>
        ) : (
          <div className="space-y-2">
            {ownerSlots.map((slot) => (
              <div key={slot.index} className="rounded border border-zinc-800 bg-black/50 p-2 font-mono text-[11px]">
                <div className="text-zinc-200">
                  index={slot.index} type={slot.ownerType} bytes={slot.ownerBytesLength}
                </div>
                <div className="break-all text-zinc-400">ownerAddress={slot.ownerAddress ?? '—'}</div>
                <div className="break-all text-zinc-600">{slot.ownerBytes}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {probeResult && verdict ? (
        <section
          className={`space-y-2 rounded border p-4 ${
            verdict.state === 'green'
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : verdict.state === 'yellow'
                ? 'border-amber-500/40 bg-amber-500/10'
                : verdict.state === 'blue'
                  ? 'border-sky-500/40 bg-sky-500/10'
                  : 'border-rose-500/40 bg-rose-500/10'
          }`}
        >
          <div
            className={`font-mono text-[11px] uppercase tracking-wide ${
              verdict.state === 'green'
                ? 'text-emerald-300'
                : verdict.state === 'yellow'
                  ? 'text-amber-200'
                  : verdict.state === 'blue'
                    ? 'text-sky-300'
                    : 'text-rose-300'
            }`}
          >
            owner-key verdict
          </div>
          <div
            className={`font-mono text-sm ${
              verdict.state === 'green'
                ? 'text-emerald-100'
                : verdict.state === 'yellow'
                  ? 'text-amber-100'
                  : verdict.state === 'blue'
                    ? 'text-sky-100'
                    : 'text-rose-100'
            }`}
          >
            {verdict.label}
          </div>
          <div className="font-mono text-[11px] text-zinc-300">{verdict.detail}</div>
          {verdict.state === 'red' && ephemeralCandidates.length > 0 ? (
            <div className="font-mono text-[11px] text-rose-200">
              Recovered key(s) have no on-chain history (no code, 0 transactions) — this is
              consistent with a Base App session/sub-account key. Use the EOA-owner submission
              lane to sign with one of the on-chain owner addresses instead. Suspect:{' '}
              {ephemeralCandidates.map((s) => s.address).join(', ')}
            </div>
          ) : null}
        </section>
      ) : null}

      {probeResult ? (
        <section className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">signature shape</div>
          <KeyValue
            label="shape"
            value={describeSignatureShape(probeResult.signatureShape, probeResult.signatureByteLength)}
          />
          <div
            className={
              probeResult.signatureByteLength > 256
                ? 'rounded border border-amber-500/40 bg-amber-500/10 p-2 font-mono text-xs font-bold text-amber-100'
                : 'font-mono text-xs'
            }
          >
            <KeyValue
              label="inner signature length (bytes)"
              value={String(probeResult.signatureByteLength)}
            />
          </div>
          {inferredOwner ? (
            <div className="space-y-1 rounded border border-zinc-700 bg-zinc-900 p-2">
              <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">
                inferred owner index (from shape)
              </div>
              <KeyValue
                label="inferredIndex (kind)"
                value={
                  inferredOwner.inferredIndex !== null
                    ? `${inferredOwner.inferredIndex} (${inferredOwner.inferredKind ?? '—'})`
                    : `— (${inferredOwner.inferredKind ?? 'unknown'})`
                }
              />
              <KeyValue
                label="wrapperClaimedIndex"
                value={
                  probeResult.parsedOwnerIndex !== null
                    ? String(probeResult.parsedOwnerIndex)
                    : '—'
                }
              />
              <KeyValue
                label="wrapperAgrees"
                value={`${inferredOwner.wrapperAgrees ? '✅' : '⚠️'} ${String(inferredOwner.wrapperAgrees)}`}
              />
              <KeyValue label="reason" value={inferredOwner.reason} />
              {reverificationState ? (
                <div
                  className={
                    reverificationState.state === 'valid'
                      ? 'rounded border border-emerald-500/40 bg-emerald-500/10 p-2'
                      : reverificationState.state === 'invalid'
                        ? 'rounded border border-rose-500/40 bg-rose-500/10 p-2'
                        : 'rounded border border-zinc-700 bg-zinc-900 p-2'
                  }
                >
                  <KeyValue
                    label="re-verified vs inferred owner"
                    value={`${reverificationState.state} — ${reverificationState.detail}`}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {probeResult.signatureShape.kind === 'webauthn' && probeResult.webauthnChallenge ? (
            <div className="space-y-1 rounded border border-sky-500/30 bg-sky-500/5 p-2">
              <div className="font-mono text-[10px] uppercase tracking-wide text-sky-300">
                passkey challenge view
              </div>
              <KeyValue
                label="clientDataJSON"
                value={prettyPrintJson(probeResult.signatureShape.clientDataJSON)}
              />
              <KeyValue
                label="challenge (base64url)"
                value={probeResult.webauthnChallenge.raw || '— (missing)'}
              />
              <KeyValue
                label="challenge (decoded hex)"
                value={probeResult.webauthnChallenge.decodedHex ?? '— (decode failed)'}
              />
              <KeyValue
                label="challenge matches signed userOpHash?"
                value={String(probeResult.webauthnChallenge.matchesSignedHash)}
              />
              <KeyValue
                label="challenge matches on-chain replaySafeHash?"
                value={
                  probeResult.webauthnChallenge.matchesOnchainReplaySafeHash === null
                    ? '— (on-chain lookup failed)'
                    : String(probeResult.webauthnChallenge.matchesOnchainReplaySafeHash)
                }
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {probeResult ? (
        <section className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">
            recovered vs on-chain owners (side-by-side)
          </div>
          {verdictUsedUnknownWithRecovery && probeResult.signatureShape.kind === 'unknown' ? (
            <div className="font-mono text-[11px] text-zinc-400">
              Note: signature wrapper format not auto-recognized ({probeResult.signatureShape.reason}); evaluating against extracted inner ECDSA.
            </div>
          ) : null}
          <div className="space-y-1">
            <RecoveredVsOwnerRow
              label="recoveredDirect(userOpHash)"
              recovered={probeResult.recoveredDirect}
              ownerSlots={ownerSlots}
              parsedOwnerIndex={probeResult.parsedOwnerIndex}
              parsedOwnerAddress={probeResult.parsedOwnerAddressOnchain}
              ephemeralSignals={ephemeralSignals}
            />
            <RecoveredVsOwnerRow
              label="recoveredAgainstOnchainReplaySafe"
              recovered={probeResult.recoveredAgainstOnchainReplaySafe}
              ownerSlots={ownerSlots}
              parsedOwnerIndex={probeResult.parsedOwnerIndex}
              parsedOwnerAddress={probeResult.parsedOwnerAddressOnchain}
              ephemeralSignals={ephemeralSignals}
            />
            <RecoveredVsOwnerRow
              label="recoveredAgainstReplaySafe(local)"
              recovered={probeResult.recoveredAgainstReplaySafe}
              ownerSlots={ownerSlots}
              parsedOwnerIndex={probeResult.parsedOwnerIndex}
              parsedOwnerAddress={probeResult.parsedOwnerAddressOnchain}
              ephemeralSignals={ephemeralSignals}
            />
            <RecoveredVsOwnerRow
              label="recoveredPrefixed(EIP191(userOpHash))"
              recovered={probeResult.recoveredPrefixed}
              ownerSlots={ownerSlots}
              parsedOwnerIndex={probeResult.parsedOwnerIndex}
              parsedOwnerAddress={probeResult.parsedOwnerAddressOnchain}
              ephemeralSignals={ephemeralSignals}
            />
            <RecoveredVsOwnerRow
              label="recoveredAgainstPrefixedReplaySafe"
              recovered={probeResult.recoveredAgainstPrefixedReplaySafe}
              ownerSlots={ownerSlots}
              parsedOwnerIndex={probeResult.parsedOwnerIndex}
              parsedOwnerAddress={probeResult.parsedOwnerAddressOnchain}
              ephemeralSignals={ephemeralSignals}
            />
          </div>
        </section>
      ) : null}

      {probeResult ? (
        <section className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">probe result</div>
          <KeyValue label="method" value={probeResult.method} />
          <KeyValue label="parsedSignatureKind" value={probeResult.parsedSignatureKind} />
          <KeyValue label="signedHash (passed to wallet)" value={probeResult.signedHash} />
          <KeyValue label="replaySafeHash (computed locally)" value={probeResult.replaySafeHash} />
          <KeyValue label="erc1271MagicValue (returned by CSW)" value={probeResult.erc1271MagicValue ?? '— (call reverted)'} />
          <KeyValue label="erc1271Verified" value={String(probeResult.erc1271Verified)} />
          <KeyValue label="targetOwnerIndex" value={String(probeResult.targetOwnerIndex)} />
          <KeyValue label="targetOwnerAddress" value={probeResult.targetOwnerAddress ?? '—'} />
          <KeyValue label="parsedOwnerIndex" value={probeResult.parsedOwnerIndex !== null ? String(probeResult.parsedOwnerIndex) : '—'} />
          <KeyValue label="parsedOwnerAddress" value={probeResult.parsedOwnerAddress ?? '—'} />
          <KeyValue label="parsedOwnerIndexMatchesTarget" value={String(probeResult.parsedOwnerIndexMatchesTarget)} />
          <KeyValue label="parsedSignatureData" value={probeResult.parsedSignatureData ?? '—'} />
          <KeyValue label="ecdsaSignatureForRecovery" value={probeResult.ecdsaSignatureForRecovery ?? '—'} />
          <KeyValue label="recoveredDirect(hash=signedHash)" value={probeResult.recoveredDirect ?? '—'} />
          <KeyValue label="recoveredPrefixed(hash=EIP191(signedHash))" value={probeResult.recoveredPrefixed ?? '—'} />
          <KeyValue label="recoveredAgainstReplaySafe(hash=replaySafeHash[local])" value={probeResult.recoveredAgainstReplaySafe ?? '—'} />
          <KeyValue label="recoveredAgainstPrefixedReplaySafe(hash=EIP191(replaySafeHash[local]))" value={probeResult.recoveredAgainstPrefixedReplaySafe ?? '—'} />
          <KeyValue label="replaySafeHash(onchain) — CSW.replaySafeHash(challengeHash)" value={probeResult.onchainReplaySafeHash ?? '— (call reverted)'} />
          <KeyValue
            label="localReplaySafeMatchesOnchain"
            value={
              probeResult.localReplaySafeMatchesOnchain === null
                ? '— (on-chain lookup failed)'
                : String(probeResult.localReplaySafeMatchesOnchain)
            }
          />
          <KeyValue label="recoveredAgainstOnchainReplaySafe(hash=replaySafeHash[onchain])" value={probeResult.recoveredAgainstOnchainReplaySafe ?? '—'} />
          <KeyValue label="parsedOwnerAddress(onchain at probe time)" value={probeResult.parsedOwnerAddressOnchain ?? '— (not an EOA / read failed)'} />
          <KeyValue label="parsedOwnerRawBytes(onchain at probe time)" value={probeResult.parsedOwnerRawBytesOnchain ?? '—'} />
          <KeyValue label="directMatchesTarget" value={String(probeResult.directMatchesTarget)} />
          <KeyValue label="prefixedMatchesTarget" value={String(probeResult.prefixedMatchesTarget)} />
          <KeyValue label="signatureData(raw return)" value={probeResult.signature} />
          <KeyValue
            label="wrappedSignature(abi.encode(targetIndex,ecdsaSig))"
            value={probeResult.wrappedSignature === '0x' ? '— (no recoverable 65-byte signature)' : probeResult.wrappedSignature}
          />
          <KeyValue
            label="walletSession (snapshot at sign time)"
            value={
              probeResult.walletSession
                ? JSON.stringify(probeResult.walletSession, null, 2)
                : '— (snapshot unavailable)'
            }
          />
        </section>
      ) : null}
    </div>
  )
}

function describeSignatureShape(shape: SignatureShape, byteLength: number): string {
  if (shape.kind === 'secp256k1') return `secp256k1 (${byteLength} bytes)`
  if (shape.kind === 'webauthn') return `webauthn (${byteLength} bytes, decoded ok)`
  return `unknown (${byteLength} bytes — ${shape.reason})`
}

function prettyPrintJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function StatusRow(props: { title: string; state: StepState }) {
  const color =
    props.state.kind === 'ok'
      ? 'text-emerald-400'
      : props.state.kind === 'err'
        ? 'text-rose-400'
        : props.state.kind === 'pending'
          ? 'text-amber-300'
          : 'text-zinc-500'
  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{props.title}</div>
      <div className={`font-mono text-xs ${color}`}>{props.state.label}</div>
      {props.state.detail ? (
        <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-zinc-500">{props.state.detail}</pre>
      ) : null}
    </div>
  )
}

function RecoveredVsOwnerRow(props: {
  label: string
  recovered: Address | null
  ownerSlots: OwnerSlot[]
  parsedOwnerIndex: number | null
  parsedOwnerAddress: Address | null
  ephemeralSignals: Map<string, EphemeralKeySignal>
}) {
  const recoveredLower = props.recovered?.toLowerCase() ?? null
  const matchedSlot = recoveredLower
    ? props.ownerSlots.find((slot) => slot.ownerAddress?.toLowerCase() === recoveredLower) ?? null
    : null
  const ephemeralSignal = recoveredLower ? props.ephemeralSignals.get(recoveredLower) ?? null : null
  const compareTarget =
    props.parsedOwnerAddress ??
    (props.parsedOwnerIndex !== null
      ? props.ownerSlots.find((slot) => slot.index === props.parsedOwnerIndex)?.ownerAddress ?? null
      : null)
  const matchesParsedOwner =
    recoveredLower !== null && compareTarget !== null && recoveredLower === compareTarget.toLowerCase()
  const ringColor = matchedSlot
    ? 'border-emerald-500/50'
    : props.recovered === null
      ? 'border-zinc-800'
      : 'border-rose-500/40'
  return (
    <div className={`rounded border ${ringColor} bg-black/40 p-2`}>
      <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{props.label}</div>
      <div className="grid gap-1 md:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] text-zinc-500">recovered</div>
          <div className="break-all font-mono text-[11px] text-zinc-200">{props.recovered ?? '— (no recovery)'}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] text-zinc-500">
            owner snapshot (parsedOwnerIndex={props.parsedOwnerIndex !== null ? String(props.parsedOwnerIndex) : '—'})
          </div>
          <div className="break-all font-mono text-[11px] text-zinc-200">{compareTarget ?? '— (not loaded)'}</div>
        </div>
      </div>
      <div className="mt-1 font-mono text-[10px]">
        {matchedSlot ? (
          <span className="text-emerald-300">✓ matches owner[{matchedSlot.index}]</span>
        ) : matchesParsedOwner ? (
          <span className="text-emerald-300">✓ matches parsed owner</span>
        ) : props.recovered === null ? (
          <span className="text-zinc-500">— no recovery for this hash</span>
        ) : (
          <span className="text-rose-300">✗ does not match any on-chain owner</span>
        )}
      </div>
      {ephemeralSignal ? (
        <div
          className={`mt-1 font-mono text-[10px] ${
            ephemeralSignal.isEphemeralCandidate ? 'text-amber-300' : 'text-zinc-500'
          }`}
        >
          code: {ephemeralSignal.code ?? '—'} / txCount:{' '}
          {ephemeralSignal.txCount === null ? '—' : ephemeralSignal.txCount}
          {ephemeralSignal.isEphemeralCandidate ? ' (ephemeral candidate)' : ''}
        </div>
      ) : null}
    </div>
  )
}

function KeyValue(props: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{props.label}</div>
      <div className="break-all rounded border border-zinc-800 bg-black/50 px-2 py-1 font-mono text-[11px] text-zinc-200">
        {props.value}
      </div>
    </div>
  )
}
