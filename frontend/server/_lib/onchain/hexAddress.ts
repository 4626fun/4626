import { getAddress, isAddress } from 'viem'

/** Normalize a validated EVM address to viem's branded `0x${string}` type. */
export function hexAddress(value: string): `0x${string}` {
  return getAddress(value)
}

export function hexAddressOrNull(value: string | null | undefined): `0x${string}` | null {
  if (!value || !isAddress(value)) return null
  return getAddress(value)
}

export function hexAddresses(values: string[]): `0x${string}`[] {
  return values.filter((value) => isAddress(value)).map((value) => getAddress(value))
}
