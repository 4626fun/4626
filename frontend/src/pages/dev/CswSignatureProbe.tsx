import { useMemo, useState } from 'react'
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
import { _submitOwnerViaPreparedCalls, type OwnerApprovalStageEvent } from '@/lib/wallet/onboardingWallet'

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

const CSW_OWNER_MUTATION_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
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
}

type StepState = { kind: 'idle' | 'pending' | 'ok' | 'err'; label: string; detail?: string }

const INITIAL_STEP: StepState = { kind: 'idle', label: 'not run' }

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
  const [ownerToAddInput, setOwnerToAddInput] = useState('0x2f4ec723ff6add6ab81b7befbec04ce31151613f')
  const [preparedCallsUsePaymaster, setPreparedCallsUsePaymaster] = useState(true)
  const [create2DeployerInput, setCreate2DeployerInput] = useState('0x808f2Cf1b7e7afaC561dd9d2A2aA20be15EEb3fd')
  const [authorizedDeployerInput, setAuthorizedDeployerInput] = useState('0xab6d5c10b03300326cd7fab7267ae192842967b5')
  const [create2ReadState, setCreate2ReadState] = useState<StepState>(INITIAL_STEP)
  const [create2WriteState, setCreate2WriteState] = useState<StepState>(INITIAL_STEP)
  const [create2TxHash, setCreate2TxHash] = useState<string | null>(null)
  const [create2OwnerAddress, setCreate2OwnerAddress] = useState<string | null>(null)
  const [create2IsAuthorized, setCreate2IsAuthorized] = useState<boolean | null>(null)
  const [ownerSlots, setOwnerSlots] = useState<OwnerSlot[]>([])
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null)

  const normalizedCswAddress = useMemo(() => {
    const raw = String(cswInput ?? '').trim()
    if (!isAddress(raw)) return null
    return getAddress(raw)
  }, [cswInput])

  const targetOwnerAddress = useMemo(() => {
    return ownerSlots.find((slot) => slot.index === targetOwnerIndex)?.ownerAddress ?? null
  }, [ownerSlots, targetOwnerIndex])
  const parsedOwnerIndexSuggestion = useMemo(() => {
    if (!probeResult) return null
    if (probeResult.parsedOwnerIndex === null) return null
    if (probeResult.parsedOwnerIndex === targetOwnerIndex) return null
    return probeResult.parsedOwnerIndex
  }, [probeResult, targetOwnerIndex])
  const paymasterUrlForPreparedCalls = useMemo(() => {
    const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
    return resolveCdpPaymasterUrl(paymasterEnv) ?? null
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

  async function runProbe(method: 'eth_sign' | 'personal_sign' | 'typed_data') {
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

    // Hash we ASK the wallet to sign. For Base App CSW sessions the popup
    // applies its own replaySafeHash wrap internally, so we MUST give it the
    // raw challenge hash, not the pre-wrapped replaySafeHash. We still compute
    // replaySafeHash locally for diagnostic comparison.
    const signedHash = challengeHash
    const replaySafeHash = buildReplaySafeHash({
      smartWallet: normalizedCswAddress,
      userOpHash: challengeHash,
    })

    setSignState({ kind: 'pending', label: `awaiting ${method} signature…` })
    setProbeResult(null)
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
          args: [challengeHash],
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
      // wallet (not just the inner ecdsa bytes). The hash argument is the raw
      // challenge hash; the contract’s ERC-1271 implementation applies
      // replaySafeHash internally before verifying.
      let erc1271MagicValue: Hex | null = null
      let erc1271Verified = false
      try {
        const result = await publicClient.readContract({
          address: normalizedCswAddress,
          abi: ERC1271_ABI,
          functionName: 'isValidSignature',
          args: [challengeHash, signature],
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
      })
      setSignState({
        kind: erc1271Verified ? 'ok' : 'err',
        label: `${method} signature ${erc1271Verified ? 'verified' : 'captured (NOT verified)'}`,
        detail: (() => {
          if (erc1271Verified) {
            return 'CSW.isValidSignature returned the EIP-1271 magic value — the bundler will accept this signature shape.'
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
    // Hard self-auth gate: this probe drives `_submitOwnerViaPreparedCalls`,
    // which always calls `personal_sign(hash, sender)` with `sender === CSW`.
    // That shape is only accepted by the Base App popup when the connected
    // account IS the CSW (self-auth session, owner[0]=passkey signing the
    // self-call). For non-self-auth connectors (an EOA owner session) the
    // signing address would have to be the connected EOA, not the CSW —
    // that path is handled by `sendPreparedOwnerTx` in the account-setup
    // controller, not by this probe.
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

    const runId = `probe-${Date.now()}`
    setPreparedCallsTxHash(null)
    setPreparedCallEventLog([])
    setPreparedCallsState({
      kind: 'pending',
      label: `submitting via wallet_prepareCalls${preparedCallsUsePaymaster ? ' (with paymaster)' : ' (no paymaster)'}…`,
    })
    try {
      const appendEvent = (row: string) => {
        setPreparedCallEventLog((prev) => [...prev, row].slice(-10))
      }
      appendEvent(`session:${isSelfAuthSession ? 'self_auth' : 'external_signer'}`)
      const runAttempt = async (params: { paymasterUrl: string | null; attemptLabel: string }) => {
        appendEvent(`attempt:${params.attemptLabel}`)
        return await _submitOwnerViaPreparedCalls({
          walletRequest: async (args) => await request(args),
          chainId: base.id,
          sender: normalizedCswAddress,
          to: normalizedCswAddress,
          data,
          paymasterUrl: params.paymasterUrl,
          approvalRunId: `${runId}-${params.attemptLabel}`,
          executionMode: 'canonicalSmartWallet',
          signerAddress: connectedAddress,
          canonicalCswAddress: normalizedCswAddress,
          onStageEvent: (event: OwnerApprovalStageEvent) => {
            const row = `${event.stage}:${event.status}${event.code ? `:${event.code}` : ''}${event.txHash ? `:${event.txHash}` : ''}`
            appendEvent(row)
          },
        })
      }

      let txHash: `0x${string}`
      try {
        txHash = await runAttempt({
          paymasterUrl: preparedCallsUsePaymaster ? paymasterUrlForPreparedCalls : null,
          attemptLabel: preparedCallsUsePaymaster ? 'with_paymaster' : 'without_paymaster',
        })
      } catch (firstError) {
        const message = describeError(firstError)
        const lower = message.toLowerCase()
        const retryWithoutPaymaster =
          preparedCallsUsePaymaster &&
          (lower.includes('failed to fetch rpc request') ||
            lower.includes('internal error') ||
            lower.includes('failed to fetch'))
        if (!retryWithoutPaymaster) throw firstError
        appendEvent('fallback:retry_without_paymaster')
        txHash = await runAttempt({
          paymasterUrl: null,
          attemptLabel: 'without_paymaster_fallback',
        })
      }

      setPreparedCallsTxHash(txHash)
      setPreparedCallsState({
        kind: 'ok',
        label: 'prepared-calls owner add submitted',
        detail: txHash,
      })
    } catch (error) {
      setPreparedCallsState({
        kind: 'err',
        label: 'prepared-calls owner add failed',
        detail: describeError(error),
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
      </header>

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
        </div>
      </section>

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
          Self-call owner add (prepared calls)
        </div>
        <div className="text-xs text-zinc-500">
          Runs wallet_prepareCalls, then personal_sign, then wallet_sendPreparedCalls against the connected CSW session.
          Use this lane from Base App for addOwnerAddress self-call testing.
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
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={preparedCallsUsePaymaster}
            onChange={(event) => setPreparedCallsUsePaymaster(event.target.checked)}
          />
          include paymaster capability
        </label>
        <div className="text-[11px] text-zinc-500">
          paymasterUrl: <span className="font-mono text-zinc-300">{paymasterUrlForPreparedCalls ?? '(none)'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500"
            onClick={runPreparedCallsOwnerAdd}
          >
            run prepared-calls owner add
          </button>
        </div>
        <StatusRow title="prepared calls lane" state={preparedCallsState} />
        {preparedCallsTxHash ? <KeyValue label="preparedCallsTxHash" value={preparedCallsTxHash} /> : null}
        {preparedCallEventLog.length ? (
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">prepared calls events</div>
            <div className="rounded border border-zinc-800 bg-black/50 px-2 py-1 font-mono text-[11px] text-zinc-300">
              {preparedCallEventLog.join('\n')}
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
        </section>
      ) : null}
    </div>
  )
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
