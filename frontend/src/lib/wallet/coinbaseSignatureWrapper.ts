import { decodeAbiParameters } from 'viem'

export function hexByteLength(value: string): number {
  if (!value || typeof value !== 'string') return 0
  if (!value.startsWith('0x')) return 0
  const hex = value.slice(2)
  return Math.floor(hex.length / 2)
}

export function parseCoinbaseSignatureWrapper(signature: `0x${string}`): {
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
