import { useMemo, useState } from 'react'
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient } from 'wagmi'
import {
  decodeAbiParameters,
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
  parsedSignatureKind: 'raw-ecdsa' | 'signature-wrapper' | 'signature-wrapper-bytes' | 'unknown'
  parsedOwnerIndex: number | null
  parsedOwnerAddress: Address | null
  parsedOwnerIndexMatchesTarget: boolean
  parsedSignatureData: Hex | null
  ecdsaSignatureForRecovery: Hex | null
  replaySafeHash: Hex
  recoveredDirect: Address | null
  recoveredPrefixed: Address | null
  targetOwnerIndex: number
  targetOwnerAddress: Address | null
  directMatchesTarget: boolean
  prefixedMatchesTarget: boolean
  wrappedSignature: Hex
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

type ParsedWalletSignature = {
  kind: 'raw-ecdsa' | 'signature-wrapper' | 'signature-wrapper-bytes' | 'unknown'
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
    return {
      kind: 'unknown',
      ownerIndex: null,
      signatureData: null,
      ecdsaSignature: null,
    }
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
  const [targetOwnerIndex, setTargetOwnerIndex] = useState(1)
  const [challengeHash, setChallengeHash] = useState<Hex>(() => makeChallengeHash())
  const [ownerReadState, setOwnerReadState] = useState<StepState>(INITIAL_STEP)
  const [signState, setSignState] = useState<StepState>(INITIAL_STEP)
  const [connectState, setConnectState] = useState<StepState>(INITIAL_STEP)
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
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<Hex>)
      | undefined
    if (!request && method !== 'typed_data') {
      setSignState({ kind: 'err', label: 'wallet client request() unavailable' })
      return
    }

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
          params: [connectedAddress, replaySafeHash],
        })
      } else if (method === 'personal_sign') {
        signature = await request!({
          method: 'personal_sign',
          params: [replaySafeHash, connectedAddress],
        })
      } else {
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
      const recoveredDirect = recoverableSignature
        ? await recoverAddress({ hash: replaySafeHash, signature: recoverableSignature }).catch(() => null)
        : null
      const prefixedHash = hashMessage({ raw: replaySafeHash })
      const recoveredPrefixed = recoverableSignature
        ? await recoverAddress({ hash: prefixedHash, signature: recoverableSignature }).catch(() => null)
        : null
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

      setProbeResult({
        method,
        signature,
        parsedSignatureKind: parsedSignature.kind,
        parsedOwnerIndex: parsedSignature.ownerIndex,
        parsedOwnerAddress,
        parsedOwnerIndexMatchesTarget,
        parsedSignatureData: parsedSignature.signatureData,
        ecdsaSignatureForRecovery: recoverableSignature,
        replaySafeHash,
        recoveredDirect,
        recoveredPrefixed,
        targetOwnerIndex,
        targetOwnerAddress,
        directMatchesTarget,
        prefixedMatchesTarget,
        wrappedSignature: wrappedSignature ?? ('0x' as Hex),
      })
      setSignState({
        kind: 'ok',
        label: `${method} signature captured`,
        detail: (() => {
          if (parsedOwnerIndexMatchesTarget) {
            return `Signature wrapper owner index matches target (${targetOwnerIndex}).`
          }
          if (parsedSignature.ownerIndex !== null) {
            return `Signature wrapper owner index=${parsedSignature.ownerIndex}; target=${targetOwnerIndex}.`
          }
          if (directMatchesTarget || prefixedMatchesTarget) {
            return 'Recovered signer matches selected owner index.'
          }
          return 'Recovered signer does not match selected owner index.'
        })(),
      })
    } catch (error) {
      setSignState({ kind: 'err', label: `${method} failed`, detail: describeError(error) })
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 text-sm">
      <header className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">4626 · dev probe</div>
        <h1 className="text-2xl font-medium">CSW owner signature probe</h1>
        <p className="text-zinc-400">
          Loads CSW owner slots, computes replaySafeHash for a test hash, and checks whether Base App signatures
          recover to the selected owner index. This probe does not send transactions.
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
          <KeyValue label="replaySafeHash" value={probeResult.replaySafeHash} />
          <KeyValue label="targetOwnerIndex" value={String(probeResult.targetOwnerIndex)} />
          <KeyValue label="targetOwnerAddress" value={probeResult.targetOwnerAddress ?? '—'} />
          <KeyValue label="parsedOwnerIndex" value={probeResult.parsedOwnerIndex !== null ? String(probeResult.parsedOwnerIndex) : '—'} />
          <KeyValue label="parsedOwnerAddress" value={probeResult.parsedOwnerAddress ?? '—'} />
          <KeyValue label="parsedOwnerIndexMatchesTarget" value={String(probeResult.parsedOwnerIndexMatchesTarget)} />
          <KeyValue label="parsedSignatureData" value={probeResult.parsedSignatureData ?? '—'} />
          <KeyValue label="ecdsaSignatureForRecovery" value={probeResult.ecdsaSignatureForRecovery ?? '—'} />
          <KeyValue label="recoveredDirect(hash=replaySafeHash)" value={probeResult.recoveredDirect ?? '—'} />
          <KeyValue label="recoveredPrefixed(hash=EIP191(replaySafeHash))" value={probeResult.recoveredPrefixed ?? '—'} />
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
